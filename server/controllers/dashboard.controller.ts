import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

export class DashboardController {
  private cache = new Map<string, { data: any; cachedAt: number }>();
  private CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache

  /**
   * GET /api/v1/dashboard/stats
   * Native SQLite high-speed aggregations for POS Control Tower
   */
  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const period = String(req.query.period || 'today');
      const customStart = req.query.startDate ? String(req.query.startDate) : undefined;
      const customEnd = req.query.endDate ? String(req.query.endDate) : undefined;
      const forceRefresh = req.query.force === 'true';

      const cacheKey = `${period}_${customStart || ''}_${customEnd || ''}`;

      if (!forceRefresh && this.cache.has(cacheKey)) {
        const entry = this.cache.get(cacheKey)!;
        if (Date.now() - entry.cachedAt < this.CACHE_TTL_MS) {
          res.json(entry.data);
          return;
        }
      }

      const { currentStart, currentEnd, prevStart, prevEnd } = this.calculateDateRanges(
        period,
        customStart,
        customEnd
      );

      // Execute native parallel SQLite queries via Prisma $queryRaw
      const [
        currentSalesRaw,
        prevSalesRaw,
        currentProfitRaw,
        prevProfitRaw,
        paymentMethodsRaw,
        topProductsRaw,
        peakHoursRaw,
      ] = await Promise.all([
        // 1. Current Period Sales & Transactions
        prisma.$queryRaw<Array<{ count: bigint; totalRevenue: number; totalSubtotal: number }>>`
          SELECT 
            COUNT(s.id) as count,
            COALESCE(SUM(s.total), 0) as totalRevenue,
            COALESCE(SUM(s.subtotal), 0) as totalSubtotal
          FROM Sale s
          WHERE s.status = 'COMPLETED'
            AND s.createdAt >= ${currentStart}
            AND s.createdAt <= ${currentEnd}
        `,

        // 2. Previous Period Sales for Trend Comparison
        prisma.$queryRaw<Array<{ count: bigint; totalRevenue: number }>>`
          SELECT 
            COUNT(s.id) as count,
            COALESCE(SUM(s.total), 0) as totalRevenue
          FROM Sale s
          WHERE s.status = 'COMPLETED'
            AND s.createdAt >= ${prevStart}
            AND s.createdAt <= ${prevEnd}
        `,

        // 3. Current Net Profit: sum((unitPrice - cost) * quantity)
        prisma.$queryRaw<Array<{ netProfit: number; itemsRevenue: number; totalCost: number }>>`
          SELECT 
            COALESCE(SUM((si.unitPrice - COALESCE(p.cost, 0)) * si.quantity), 0) as netProfit,
            COALESCE(SUM(si.subtotal), 0) as itemsRevenue,
            COALESCE(SUM(COALESCE(p.cost, 0) * si.quantity), 0) as totalCost
          FROM SaleItem si
          JOIN Product p ON si.productId = p.id
          JOIN Sale s ON si.saleId = s.id
          WHERE s.status = 'COMPLETED'
            AND s.createdAt >= ${currentStart}
            AND s.createdAt <= ${currentEnd}
        `,

        // 4. Previous Period Net Profit for Trend Comparison
        prisma.$queryRaw<Array<{ netProfit: number }>>`
          SELECT 
            COALESCE(SUM((si.unitPrice - COALESCE(p.cost, 0)) * si.quantity), 0) as netProfit
          FROM SaleItem si
          JOIN Product p ON si.productId = p.id
          JOIN Sale s ON si.saleId = s.id
          WHERE s.status = 'COMPLETED'
            AND s.createdAt >= ${prevStart}
            AND s.createdAt <= ${prevEnd}
        `,

        // 5. Payment Methods Breakdown in Current Period
        prisma.$queryRaw<Array<{ paymentMethod: string; count: bigint; total: number }>>`
          SELECT 
            s.paymentMethod,
            COUNT(s.id) as count,
            COALESCE(SUM(s.total), 0) as total
          FROM Sale s
          WHERE s.status = 'COMPLETED'
            AND s.createdAt >= ${currentStart}
            AND s.createdAt <= ${currentEnd}
          GROUP BY s.paymentMethod
          ORDER BY total DESC
        `,

        // 6. Top 5 Most Sold Products & Profit Margin Contribution ($M_p$)
        prisma.$queryRaw<Array<{
          productId: string;
          productName: string;
          category: string;
          currentStock: number;
          totalQuantity: number;
          totalRevenue: number;
          unitCost: number;
          totalMargin: number;
        }>>`
          SELECT 
            si.productId,
            si.productName,
            COALESCE(p.category, 'General') as category,
            COALESCE(p.stock, 0) as currentStock,
            SUM(si.quantity) as totalQuantity,
            SUM(si.subtotal) as totalRevenue,
            COALESCE(p.cost, 0) as unitCost,
            SUM((si.unitPrice - COALESCE(p.cost, 0)) * si.quantity) as totalMargin
          FROM SaleItem si
          JOIN Product p ON si.productId = p.id
          JOIN Sale s ON si.saleId = s.id
          WHERE s.status = 'COMPLETED'
            AND s.createdAt >= ${currentStart}
            AND s.createdAt <= ${currentEnd}
          GROUP BY si.productId, si.productName
          ORDER BY totalQuantity DESC
          LIMIT 5
        `,

        // 7. Peak Sales Hours (Hourly breakdown in SQLite)
        prisma.$queryRaw<Array<{
          hour: bigint;
          transactionsCount: bigint;
          totalSales: number;
        }>>`
          SELECT 
            CAST(strftime('%H', s.createdAt / 1000, 'unixepoch', 'localtime') AS INTEGER) as hour,
            COUNT(s.id) as transactionsCount,
            COALESCE(SUM(s.total), 0) as totalSales
          FROM Sale s
          WHERE s.status = 'COMPLETED'
            AND s.createdAt >= ${currentStart}
            AND s.createdAt <= ${currentEnd}
          GROUP BY hour
          ORDER BY hour ASC
        `,
      ]);

      // Parse and normalize results
      const currentRevenue = Number(currentSalesRaw[0]?.totalRevenue || 0);
      const currentTxCount = Number(currentSalesRaw[0]?.count || 0);
      const prevRevenue = Number(prevSalesRaw[0]?.totalRevenue || 0);
      const prevTxCount = Number(prevSalesRaw[0]?.count || 0);

      const currentProfit = Number(currentProfitRaw[0]?.netProfit || 0);
      const currentCost = Number(currentProfitRaw[0]?.totalCost || 0);
      const prevProfit = Number(prevProfitRaw[0]?.netProfit || 0);

      // Percentage changes
      const salesChangePercent = this.calcPercentChange(currentRevenue, prevRevenue);
      const profitChangePercent = this.calcPercentChange(currentProfit, prevProfit);
      const profitMarginPercent = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;

      // Format payment methods with readable labels
      const paymentMethods = paymentMethodsRaw.map((pm) => ({
        method: pm.paymentMethod,
        label: this.formatPaymentMethodLabel(pm.paymentMethod),
        count: Number(pm.count),
        total: Number(pm.total || 0),
        percentage: currentRevenue > 0 ? (Number(pm.total || 0) / currentRevenue) * 100 : 0,
      }));

      // Format Top 5 products
      let topProducts = topProductsRaw.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        category: item.category,
        currentStock: Number(item.currentStock),
        totalQuantity: Number(item.totalQuantity),
        totalRevenue: Number(item.totalRevenue),
        unitCost: Number(item.unitCost),
        totalMargin: Number(item.totalMargin),
        marginPercent: item.totalRevenue > 0 ? (Number(item.totalMargin) / Number(item.totalRevenue)) * 100 : 0,
        revenueSharePercent: currentRevenue > 0 ? (Number(item.totalRevenue) / currentRevenue) * 100 : 0,
      }));

      // If current period has no sales, provide historical top 5 as preview fallback
      if (topProducts.length === 0) {
        const fallbackTop = await prisma.$queryRaw<Array<{
          productId: string;
          productName: string;
          category: string;
          currentStock: number;
          totalQuantity: number;
          totalRevenue: number;
          unitCost: number;
          totalMargin: number;
        }>>`
          SELECT 
            si.productId,
            si.productName,
            COALESCE(p.category, 'General') as category,
            COALESCE(p.stock, 0) as currentStock,
            SUM(si.quantity) as totalQuantity,
            SUM(si.subtotal) as totalRevenue,
            COALESCE(p.cost, 0) as unitCost,
            SUM((si.unitPrice - COALESCE(p.cost, 0)) * si.quantity) as totalMargin
          FROM SaleItem si
          JOIN Product p ON si.productId = p.id
          JOIN Sale s ON si.saleId = s.id
          WHERE s.status = 'COMPLETED'
          GROUP BY si.productId, si.productName
          ORDER BY totalQuantity DESC
          LIMIT 5
        `;
        topProducts = fallbackTop.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          category: item.category,
          currentStock: Number(item.currentStock),
          totalQuantity: Number(item.totalQuantity),
          totalRevenue: Number(item.totalRevenue),
          unitCost: Number(item.unitCost),
          totalMargin: Number(item.totalMargin),
          marginPercent: item.totalRevenue > 0 ? (Number(item.totalMargin) / Number(item.totalRevenue)) * 100 : 0,
          revenueSharePercent: 0,
        }));
      }

      // Build 24h Hourly Spectrum for smooth bar chart
      const hoursMap = new Map<number, { hour: number; hourLabel: string; transactions: number; sales: number }>();
      for (let h = 7; h <= 22; h++) {
        const formattedHour = `${String(h).padStart(2, '0')}:00`;
        hoursMap.set(h, {
          hour: h,
          hourLabel: formattedHour,
          transactions: 0,
          sales: 0,
        });
      }

      peakHoursRaw.forEach((row) => {
        const h = Number(row.hour);
        const existing = hoursMap.get(h);
        if (existing) {
          existing.transactions = Number(row.transactionsCount);
          existing.sales = Number(row.totalSales || 0);
        } else if (!isNaN(h) && h >= 0 && h <= 23) {
          hoursMap.set(h, {
            hour: h,
            hourLabel: `${String(h).padStart(2, '0')}:00`,
            transactions: Number(row.transactionsCount),
            sales: Number(row.totalSales || 0),
          });
        }
      });

      const hourlySales = Array.from(hoursMap.values()).sort((a, b) => a.hour - b.hour);

      // Determine peak hour
      let peakHourInfo: { hourLabel: string; sales: number; transactions: number } | null = null;
      let maxSales = 0;
      for (const item of hourlySales) {
        if (item.sales > maxSales) {
          maxSales = item.sales;
          peakHourInfo = {
            hourLabel: item.hourLabel,
            sales: item.sales,
            transactions: item.transactions,
          };
        }
      }

      const responsePayload = {
        success: true,
        data: {
          period,
          dateRange: {
            currentStart: currentStart.toISOString(),
            currentEnd: currentEnd.toISOString(),
            prevStart: prevStart.toISOString(),
            prevEnd: prevEnd.toISOString(),
          },
          kpis: {
            revenue: {
              current: currentRevenue,
              previous: prevRevenue,
              changePercent: salesChangePercent,
              transactionsCount: currentTxCount,
              prevTransactionsCount: prevTxCount,
            },
            profit: {
              current: currentProfit,
              previous: prevProfit,
              changePercent: profitChangePercent,
              totalCost: currentCost,
              marginPercent: profitMarginPercent,
            },
            paymentBreakdown: paymentMethods,
          },
          topProducts,
          hourlySales,
          peakHourInfo,
        },
      };

      this.cache.set(cacheKey, { data: responsePayload, cachedAt: Date.now() });
      res.json(responsePayload);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Helper to compute percentage change
   */
  private calcPercentChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  /**
   * Format payment method codes to human-readable names
   */
  private formatPaymentMethodLabel(code: string): string {
    switch (code) {
      case 'CASH_USD':
        return 'Efectivo Dólares ($)';
      case 'CASH_BS':
        return 'Efectivo Bolívares (Bs)';
      case 'DEBIT_CARD':
        return 'Tarjeta / Débito (POS)';
      case 'PAGO_MOVIL':
        return 'Pago Móvil';
      case 'TRANSFER':
        return 'Transferencia Bancaria';
      case 'CREDIT':
        return 'Venta a Crédito / Fiado';
      case 'BINANCE':
        return 'Binance Pay (USDT)';
      case 'SPLIT':
        return 'Pago Mixto / Combinado';
      default:
        return code;
    }
  }

  /**
   * Helper to compute ISO start/end for periods
   */
  private calculateDateRanges(period: string, customStart?: string, customEnd?: string) {
    const now = new Date();

    if (period === 'custom' && customStart && customEnd) {
      const cStart = new Date(customStart);
      cStart.setHours(0, 0, 0, 0);
      const cEnd = new Date(customEnd);
      cEnd.setHours(23, 59, 59, 999);

      const durationMs = cEnd.getTime() - cStart.getTime();
      const pEnd = new Date(cStart.getTime() - 1);
      const pStart = new Date(pEnd.getTime() - durationMs);

      return {
        currentStart: cStart,
        currentEnd: cEnd,
        prevStart: pStart,
        prevEnd: pEnd,
      };
    }

    if (period === 'yesterday') {
      const cStart = new Date(now);
      cStart.setDate(cStart.getDate() - 1);
      cStart.setHours(0, 0, 0, 0);

      const cEnd = new Date(now);
      cEnd.setDate(cEnd.getDate() - 1);
      cEnd.setHours(23, 59, 59, 999);

      const pStart = new Date(cStart);
      pStart.setDate(pStart.getDate() - 1);
      const pEnd = new Date(cEnd);
      pEnd.setDate(pEnd.getDate() - 1);

      return {
        currentStart: cStart,
        currentEnd: cEnd,
        prevStart: pStart,
        prevEnd: pEnd,
      };
    }

    if (period === 'week') {
      // Last 7 days
      const cStart = new Date(now);
      cStart.setDate(cStart.getDate() - 7);
      cStart.setHours(0, 0, 0, 0);

      const cEnd = new Date(now);
      cEnd.setHours(23, 59, 59, 999);

      const pEnd = new Date(cStart.getTime() - 1);
      const pStart = new Date(pEnd);
      pStart.setDate(pStart.getDate() - 7);

      return {
        currentStart: cStart,
        currentEnd: cEnd,
        prevStart: pStart,
        prevEnd: pEnd,
      };
    }

    if (period === 'month') {
      // 1st of current month
      const cStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const cEnd = new Date(now);
      cEnd.setHours(23, 59, 59, 999);

      const pStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const pEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      return {
        currentStart: cStart,
        currentEnd: cEnd,
        prevStart: pStart,
        prevEnd: pEnd,
      };
    }

    // Default: 'today'
    const cStart = new Date(now);
    cStart.setHours(0, 0, 0, 0);

    const cEnd = new Date(now);
    cEnd.setHours(23, 59, 59, 999);

    const pStart = new Date(now);
    pStart.setDate(pStart.getDate() - 1);
    pStart.setHours(0, 0, 0, 0);

    const pEnd = new Date(now);
    pEnd.setDate(pEnd.getDate() - 1);
    pEnd.setHours(23, 59, 59, 999);

    return {
      currentStart: cStart,
      currentEnd: cEnd,
      prevStart: pStart,
      prevEnd: pEnd,
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

let globalDashboardController: DashboardController | null = null;
export function getDashboardController(): DashboardController {
  if (!globalDashboardController) {
    globalDashboardController = new DashboardController();
  }
  return globalDashboardController;
}
export function clearDashboardCache(): void {
  if (globalDashboardController) {
    globalDashboardController.clearCache();
  }
}
