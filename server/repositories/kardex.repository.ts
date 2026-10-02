import { PrismaClient, StockMovement, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../config/database';

export interface KardexFilterOptions {
  productId?: string;
  type?: string;
  userName?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class KardexRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  /**
   * Find paginated kardex stock movements with filtering and relations
   */
  async findMovements(options: KardexFilterOptions) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(200, Math.max(1, options.limit || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {};

    if (options.productId) {
      where.productId = options.productId;
    }

    if (options.type && options.type !== 'ALL') {
      where.type = options.type;
    }

    if (options.userName) {
      where.userName = {
        contains: options.userName,
      };
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

    if (options.search && options.search.trim()) {
      const q = options.search.trim();
      where.OR = [
        { product: { name: { contains: q } } },
        { product: { barcode: { contains: q } } },
        { reason: { contains: q } },
        { type: { contains: q } },
        { userName: { contains: q } },
      ];
    }

    const [total, movements] = await Promise.all([
      this.db.stockMovement.count({ where }),
      this.db.stockMovement.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
          sale: {
            include: {
              items: true,
            },
          },
        },
      }),
    ]);

    return {
      movements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Execute atomic stock adjustment (Ajuste, Merma, Reabastecimiento, Carga Inicial)
   */
  async adjustStock(data: {
    productId: string;
    type: string; // RESTOCK, ADJUSTMENT, WASTE, INITIAL, RETURN
    quantity: number; // positive for entry (+), negative for exit (-)
    unitCost?: number;
    userName?: string;
    reason: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: data.productId },
      });

      if (!product) {
        throw new Error(`Producto con ID "${data.productId}" no encontrado`);
      }

      const previousStock = product.stock;
      const newStock = Math.round((previousStock + data.quantity) * 1000) / 1000;

      if (newStock < 0) {
        throw new Error(
          `Ajuste inválido: el stock no puede ser negativo (${newStock} ${product.unit}). Stock actual: ${previousStock}`
        );
      }

      const updatedProduct = await tx.product.update({
        where: { id: data.productId },
        data: { stock: newStock },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: data.productId,
          type: data.type,
          quantity: data.quantity,
          previousStock,
          newStock,
          unitCost: data.unitCost !== undefined ? data.unitCost : product.cost,
          userName: data.userName || 'Admin',
          reason: data.reason,
        },
        include: {
          product: true,
        },
      });

      return { movement, product: updatedProduct };
    });
  }

  /**
   * Ensure sample products and sample kardex records exist for ultra-clear audit demo
   */
  async ensureSampleKardexData() {
    const existingCount = await this.db.stockMovement.count();
    if (existingCount > 0) return;

    // Check or create specific sample products
    const sampleProductsData = [
      {
        barcode: '7591000000010',
        sku: 'CAR-MOL-KG',
        name: 'Carne Molida Primera',
        category: 'Carnicería',
        price: 6.50,
        cost: 5.00,
        stock: 14.9,
        minStock: 5.0,
        unit: 'KG',
      },
      {
        barcode: '7591000000027',
        sku: 'RON-CAC-750',
        name: 'Ron Cacique 0.75L',
        category: 'Licores y Bebidas',
        price: 12.00,
        cost: 10.00,
        stock: 23,
        minStock: 6,
        unit: 'BOT',
        presentationsJson: JSON.stringify([
          { id: 'p1', type: 'COMBO', name: 'Combo #1 (+ 2 Refrescos)', unitsToDeduct: 1, packagePrice: 15.0, enabled: true },
        ]),
      },
      {
        barcode: '7591000000034',
        sku: 'BEB-POL-PIL',
        name: 'Cerveza Polar Pilsen 355ml',
        category: 'Licores y Bebidas',
        price: 1.00,
        cost: 0.50,
        stock: 354,
        minStock: 48,
        unit: 'UND',
        presentationsJson: JSON.stringify([
          { id: 'p1', type: 'CAJA', name: 'Caja de 36 unidades', unitsToDeduct: 36, packagePrice: 32.0, enabled: true },
          { id: 'p2', type: 'SIXPACK', name: 'Sixpack 6 unidades', unitsToDeduct: 6, packagePrice: 5.5, enabled: true },
        ]),
      },
      {
        barcode: '7591000000041',
        sku: 'LIM-DET-LTR',
        name: 'Detergente Líquido Multiuso',
        category: 'Limpieza',
        price: 3.20,
        cost: 2.00,
        stock: 49.75,
        minStock: 10.0,
        unit: 'LTR',
      },
      {
        barcode: '7591000000058',
        sku: 'FER-CAB-MTS',
        name: 'Cable Eléctrico THW #12',
        category: 'Ferretería',
        price: 1.80,
        cost: 1.20,
        stock: 99.55,
        minStock: 20.0,
        unit: 'MTS',
      },
      {
        barcode: '7591000000065',
        sku: 'CHAR-JAM-KG',
        name: 'Jamón Superior Plumrose',
        category: 'Charcutería',
        price: 9.50,
        cost: 7.00,
        stock: 8.15,
        minStock: 3.0,
        unit: 'KG',
      },
    ];

    const createdProds: Record<string, any> = {};

    for (const p of sampleProductsData) {
      let prod = await this.db.product.findUnique({ where: { barcode: p.barcode } });
      if (!prod) {
        prod = await this.db.product.create({ data: p });
      }
      createdProds[p.sku] = prod;
    }

    // Now seed sample Kardex entries with realistic dates
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const sampleMovements = [
      {
        productId: createdProds['CAR-MOL-KG'].id,
        type: 'INITIAL',
        quantity: 15.0,
        previousStock: 0.0,
        newStock: 15.0,
        unitCost: 5.0,
        userName: 'Admin',
        reason: 'Inventario inicial',
        createdAt: new Date(`${todayStr}T08:00:00Z`),
      },
      {
        productId: createdProds['CAR-MOL-KG'].id,
        type: 'SALE',
        quantity: -0.1,
        previousStock: 15.0,
        newStock: 14.9,
        unitCost: 5.0,
        userName: 'Cajero1',
        reason: 'Ticket #NE-0001 (100 g)',
        createdAt: new Date(`${todayStr}T08:30:00Z`),
      },
      {
        productId: createdProds['RON-CAC-750'].id,
        type: 'RESTOCK',
        quantity: 24.0,
        previousStock: 0.0,
        newStock: 24.0,
        unitCost: 10.0,
        userName: 'Admin',
        reason: 'Compra / Factura #441',
        createdAt: new Date(`${todayStr}T09:15:00Z`),
      },
      {
        productId: createdProds['RON-CAC-750'].id,
        type: 'SALE',
        quantity: -1.0,
        previousStock: 24.0,
        newStock: 23.0,
        unitCost: 10.0,
        userName: 'Cajero1',
        reason: 'Venta POS (Combo #1 + 2 Refrescos)',
        createdAt: new Date(`${todayStr}T09:30:00Z`),
      },
      {
        productId: createdProds['BEB-POL-PIL'].id,
        type: 'RESTOCK',
        quantity: 360.0,
        previousStock: 0.0,
        newStock: 360.0,
        unitCost: 0.5,
        userName: 'Admin',
        reason: 'Entrada de 10 Cajas (x36 unid)',
        createdAt: new Date(`${todayStr}T10:00:00Z`),
      },
      {
        productId: createdProds['BEB-POL-PIL'].id,
        type: 'SALE',
        quantity: -6.0,
        previousStock: 360.0,
        newStock: 354.0,
        unitCost: 0.5,
        userName: 'Cajero1',
        reason: 'Venta de 1 Sixpack',
        createdAt: new Date(`${todayStr}T10:30:00Z`),
      },
      {
        productId: createdProds['LIM-DET-LTR'].id,
        type: 'INITIAL',
        quantity: 50.0,
        previousStock: 0.0,
        newStock: 50.0,
        unitCost: 2.0,
        userName: 'Admin',
        reason: 'Llenado de Tanque',
        createdAt: new Date(`${todayStr}T11:00:00Z`),
      },
      {
        productId: createdProds['LIM-DET-LTR'].id,
        type: 'SALE',
        quantity: -0.25,
        previousStock: 50.0,
        newStock: 49.75,
        unitCost: 2.0,
        userName: 'Cajero1',
        reason: 'Recarga (250 ml)',
        createdAt: new Date(`${todayStr}T11:20:00Z`),
      },
      {
        productId: createdProds['FER-CAB-MTS'].id,
        type: 'SALE',
        quantity: -0.45,
        previousStock: 100.0,
        newStock: 99.55,
        unitCost: 1.2,
        userName: 'Cajero1',
        reason: 'Venta de 45 cm',
        createdAt: new Date(`${todayStr}T12:00:00Z`),
      },
      {
        productId: createdProds['CHAR-JAM-KG'].id,
        type: 'WASTE',
        quantity: -0.35,
        previousStock: 8.5,
        newStock: 8.15,
        unitCost: 7.0,
        userName: 'Admin',
        reason: 'Ajuste por Merma (Salida por Punta Vencida)',
        createdAt: new Date(`${todayStr}T13:00:00Z`),
      },
    ];

    for (const mov of sampleMovements) {
      await this.db.stockMovement.create({
        data: mov,
      });
    }
  }
}
