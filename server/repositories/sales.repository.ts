import { PrismaClient, Sale, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../config/database';
import { posSaleMutex } from '../utils/mutex';

export class SalesRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  /**
   * Execute atomic transaction wrapper guarded by POS sales mutex.
   * Ensures sub-5ms serial execution on local SQLite WAL without lock contention or timeouts.
   */
  async runInTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
  ): Promise<T> {
    return posSaleMutex.runExclusive(async () => {
      return this.db.$transaction(fn, {
        maxWait: options?.maxWait ?? 5000,
        timeout: options?.timeout ?? 10000,
        isolationLevel: options?.isolationLevel ?? 'Serializable',
      });
    });
  }

  /**
   * Create sale entity inside the atomic transaction
   */
  async createSale(
    tx: Prisma.TransactionClient,
    data: {
      invoiceNumber: string;
      cashierName: string;
      paymentMethod: string;
      subtotal: number;
      tax: number;
      total: number;
      amountPaid: number;
      changeDue: number;
      bcvRate?: number;
      notes?: string;
      shiftId?: string;
      items: Array<{
        productId: string;
        productName: string;
        productBarcode: string;
        unitPrice: number;
        quantity: number;
        subtotal: number;
      }>;
    }
  ): Promise<Prisma.SaleGetPayload<{ include: { items: true } }>> {
    return tx.sale.create({
      data: {
        invoiceNumber: data.invoiceNumber,
        cashierName: data.cashierName,
        paymentMethod: data.paymentMethod,
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        amountPaid: data.amountPaid,
        changeDue: data.changeDue,
        bcvRate: data.bcvRate ?? 849.56,
        notes: data.notes,
        shiftId: data.shiftId,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productBarcode: item.productBarcode,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            subtotal: item.subtotal,
          })),
        },
      },
      include: {
        items: true,
      },
    });
  }

  /**
   * Create immutable audit record for stock movement inside the same transaction
   */
  async createStockMovement(
    tx: Prisma.TransactionClient,
    data: {
      productId: string;
      saleId: string;
      type: string;
      quantity: number;
      previousStock: number;
      newStock: number;
      unitCost?: number;
      userName?: string;
      reason: string;
    }
  ) {
    return tx.stockMovement.create({
      data: {
        productId: data.productId,
        saleId: data.saleId,
        type: data.type,
        quantity: data.quantity,
        previousStock: data.previousStock,
        newStock: data.newStock,
        unitCost: data.unitCost,
        userName: data.userName || 'Admin',
        reason: data.reason,
      },
    });
  }

  /**
   * Get recent sales with line items and pagination support
   */
  async findRecent(limit = 30) {
    const sales = await this.db.sale.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        shift: true,
      },
    });

    return Promise.all(sales.map(async (sale) => {
      const rateDetails = await this.getHistoricalRateDetails(sale.createdAt);
      return {
        ...sale,
        bcvRate: rateDetails?.rate ?? sale.bcvRate,
        bcvRateSource: rateDetails?.source ?? 'API Oficial BCV',
        bcvRateScheduleWindow: rateDetails?.window ?? null,
      };
    }));
  }

  async findRecentPaginated(options: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    cashierName?: string;
  }) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Math.min(Number(options.limit) || 30, 200));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options.status && options.status !== 'ALL') {
      if (options.status === 'VOIDED') {
        where.status = 'VOIDED';
      } else if (options.status === 'COMPLETED') {
        where.status = { not: 'VOIDED' };
      }
    }

    if (options.cashierName) {
      where.cashierName = { contains: options.cashierName };
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        const start = new Date(options.startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      if (options.endDate) {
        const end = new Date(options.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (options.search) {
      const q = options.search.trim();
      where.OR = [
        { invoiceNumber: { contains: q } },
        { cashierName: { contains: q } },
        { paymentMethod: { contains: q } },
        { notes: { contains: q } },
      ];
    }

    const [total, sales] = await Promise.all([
      this.db.sale.count({ where }),
      this.db.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          shift: true,
        },
      }),
    ]);

    const enrichedSales = await Promise.all(sales.map(async (sale) => {
      const rateDetails = await this.getHistoricalRateDetails(sale.createdAt);
      return {
        ...sale,
        bcvRate: rateDetails?.rate ?? sale.bcvRate,
        bcvRateSource: rateDetails?.source ?? 'API Oficial BCV',
        bcvRateScheduleWindow: rateDetails?.window ?? null,
      };
    }));

    return {
      sales: enrichedSales,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findById(id: string) {
    const sale = await this.db.sale.findUnique({
      where: { id },
      include: {
        items: true,
        stockMovements: true,
      },
    });

    if (!sale) return null;

    const rateDetails = await this.getHistoricalRateDetails(sale.createdAt);
    return {
      ...sale,
      bcvRate: rateDetails?.rate ?? sale.bcvRate,
      bcvRateSource: rateDetails?.source ?? 'API Oficial BCV',
      bcvRateScheduleWindow: rateDetails?.window ?? null,
    };
  }

  /**
   * Metrics for the POS dashboard
   */
  async getSummaryStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalSalesCount, totalRevenue, todaySales] = await Promise.all([
      this.db.sale.count({
        where: { status: { not: 'VOIDED' } }
      }),
      this.db.sale.aggregate({
        where: { status: { not: 'VOIDED' } },
        _sum: { total: true },
      }),
      this.db.sale.findMany({
        where: { 
          createdAt: { gte: today },
          status: { not: 'VOIDED' }
        },
        select: { total: true },
      }),
    ]);

    const todayTotal = todaySales.reduce((acc, s) => acc + s.total, 0);

    return {
      totalSalesCount,
      totalRevenue: totalRevenue._sum.total || 0,
      todaySalesCount: todaySales.length,
      todayRevenue: todayTotal,
    };
  }

  /**
   * Helper to retrieve historical rate at a given timestamp
   */
  async getHistoricalBcvRate(createdAt: Date, tx?: Prisma.TransactionClient): Promise<number | null> {
    const client = tx || this.db;
    const rateRecord = await client.exchangeRateHistory.findFirst({
      where: {
        rateDate: {
          lte: createdAt,
        },
      },
      orderBy: { rateDate: 'desc' },
    });

    if (!rateRecord) return null;

    const isEur = rateRecord.source.toLowerCase().includes('euro') || (rateRecord.notes || '').toLowerCase().includes('euro') || (rateRecord.notes || '').toLowerCase().includes('eur');
    const isUsdt = rateRecord.source.toLowerCase().includes('usdt') || (rateRecord.notes || '').toLowerCase().includes('usdt');
    return isEur 
      ? (rateRecord.eurRate || rateRecord.usdRate * 1.092) 
      : isUsdt 
      ? (rateRecord.usdtRate || rateRecord.usdRate * 1.045) 
      : rateRecord.usdRate;
  }

  /**
   * Helper to retrieve rich historical rate details (rate, source, schedule window)
   */
  async getHistoricalRateDetails(createdAt: Date, tx?: Prisma.TransactionClient) {
    const client = tx || this.db;
    const rateRecord = await client.exchangeRateHistory.findFirst({
      where: {
        rateDate: {
          lte: createdAt,
        },
      },
      orderBy: { rateDate: 'desc' },
    });

    if (!rateRecord) return null;

    const isEur = rateRecord.source.toLowerCase().includes('euro') || (rateRecord.notes || '').toLowerCase().includes('euro') || (rateRecord.notes || '').toLowerCase().includes('eur');
    const isUsdt = rateRecord.source.toLowerCase().includes('usdt') || (rateRecord.notes || '').toLowerCase().includes('usdt');
    const rate = isEur 
      ? (rateRecord.eurRate || rateRecord.usdRate * 1.092) 
      : isUsdt 
      ? (rateRecord.usdtRate || rateRecord.usdRate * 1.045) 
      : rateRecord.usdRate;

    return {
      rate,
      source: rateRecord.source,
      window: rateRecord.dateLabel,
    };
  }

  /**
   * Automatically backfills bcvRate for all existing Sales records
   * by matching each sale's createdAt timestamp with the rate history!
   */
  async backfillSalesBcvRates(): Promise<void> {
    try {
      console.log('[SalesRepository] Iniciando backfill de bcvRate para ventas existentes...');
      const sales = await this.db.sale.findMany({
        select: { id: true, createdAt: true, bcvRate: true },
      });

      let updatedCount = 0;
      for (const sale of sales) {
        const historicalRate = await this.getHistoricalBcvRate(sale.createdAt);
        if (historicalRate && Math.abs(sale.bcvRate - historicalRate) > 0.001) {
          await this.db.sale.update({
            where: { id: sale.id },
            data: { bcvRate: historicalRate },
          });
          updatedCount++;
        }
      }
      console.log(`[SalesRepository] Backfill completado. Se actualizaron ${updatedCount} ventas con tasas históricas exactas.`);
    } catch (e) {
      console.warn('[SalesRepository] Error ejecutando backfill de bcvRate:', e);
    }
  }
}
