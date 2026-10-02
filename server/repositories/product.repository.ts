import { PrismaClient, Product, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../config/database';

export class ProductRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  /**
   * Fast indexed barcode lookup
   */
  async findByBarcode(barcode: string, tx?: Prisma.TransactionClient): Promise<Product | null> {
    const client = tx || this.db;
    return client.product.findUnique({
      where: { barcode },
    });
  }

  async findBySku(sku: string, tx?: Prisma.TransactionClient): Promise<Product | null> {
    const client = tx || this.db;
    return client.product.findUnique({
      where: { sku },
    });
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<Product | null> {
    const client = tx || this.db;
    return client.product.findUnique({
      where: { id },
    });
  }

  async findByIds(ids: string[], tx?: Prisma.TransactionClient): Promise<Product[]> {
    const client = tx || this.db;
    return client.product.findMany({
      where: {
        id: { in: ids },
        isActive: true,
      },
    });
  }

  async findAll(includeInactive = false): Promise<Product[]> {
    const where = includeInactive ? {} : { isActive: true };
    return this.db.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Query low stock products for the 60-second cron job
   */
  async findLowStockProducts(): Promise<Product[]> {
    // In SQLite/Prisma we can query products where stock <= minStock
    // Using raw or structured query
    return this.db.$queryRaw<Product[]>`
      SELECT * FROM "Product" 
      WHERE "stock" <= "minStock" AND "isActive" = 1
      ORDER BY "stock" ASC
    `;
  }

  /**
   * Atomic decrement using Prisma with safety check
   */
  async decrementStockAtomic(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number
  ): Promise<Product> {
    return tx.product.update({
      where: { id: productId },
      data: {
        stock: {
          decrement: quantity,
        },
      },
    });
  }

  /**
   * Restock product inventory
   */
  async addStock(productId: string, quantity: number, reason = 'Restock'): Promise<Product> {
    return this.db.$transaction(async (tx) => {
      const current = await tx.product.findUnique({ where: { id: productId } });
      if (!current) throw new Error(`Producto no encontrado: ${productId}`);

      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: quantity } },
      });

      await tx.stockMovement.create({
        data: {
          productId,
          type: 'RESTOCK',
          quantity,
          previousStock: current.stock,
          newStock: updated.stock,
          reason,
        },
      });

      return updated;
    });
  }

  /**
   * Update product properties (including imageUrl)
   */
  async update(id: string, data: Prisma.ProductUpdateInput): Promise<Product> {
    return this.db.product.update({
      where: { id },
      data,
    });
  }

  /**
   * Create a new product (with optional photo)
   */
  async create(data: Prisma.ProductCreateInput): Promise<Product> {
    return this.db.product.create({
      data,
    });
  }

  async delete(id: string): Promise<Product> {
    // Soft delete to preserve sales history and data integrity
    const product = await this.db.product.findUnique({ where: { id } });
    if (!product) throw new Error('Product not found');
    
    return this.db.product.update({
      where: { id },
      data: { 
        isActive: false,
        // Append timestamp to barcode/sku to free up the originals for new products
        barcode: `DELETED-${Date.now()}-${product.barcode}`,
        sku: `DELETED-${Date.now()}-${product.sku}`
      },
    });
  }

  /**
   * Backfill method to ensure all products have isActive set to true if NULL
   */
  async backfillActiveStatus(): Promise<number> {
    try {
      // Using raw query to be absolutely sure we catch NULLs in SQLite correctly
      const result = await this.db.$executeRawUnsafe(
        'UPDATE Product SET isActive = 1 WHERE isActive IS NULL;'
      );
      return result;
    } catch (err) {
      console.error('[ProductRepository] Error in backfillActiveStatus:', err);
      return 0;
    }
  }
}
