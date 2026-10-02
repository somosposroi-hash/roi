import { PrismaClient, RestockAlert } from '@prisma/client';
import { prisma as defaultPrisma } from '../config/database';

export class AlertRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async getActiveAlerts(): Promise<Array<RestockAlert & { product: { name: string; barcode: string; sku: string; category: string } }>> {
    return this.db.restockAlert.findMany({
      where: { status: 'ACTIVE' },
      include: {
        product: {
          select: {
            name: true,
            barcode: true,
            sku: true,
            category: true,
          },
        },
      },
      orderBy: [
        { severity: 'asc' }, // CRITICAL first
        { currentStock: 'asc' },
      ],
    });
  }

  async upsertAlert(
    productId: string,
    currentStock: number,
    minStock: number,
    severity: 'CRITICAL' | 'WARNING'
  ): Promise<RestockAlert> {
    const existing = await this.db.restockAlert.findFirst({
      where: { productId, status: 'ACTIVE' },
    });

    if (existing) {
      return this.db.restockAlert.update({
        where: { id: existing.id },
        data: {
          currentStock,
          minStock,
          severity,
          evaluatedAt: new Date(),
        },
      });
    }

    return this.db.restockAlert.create({
      data: {
        productId,
        currentStock,
        minStock,
        severity,
        status: 'ACTIVE',
      },
    });
  }

  async resolveAlertsForHealthyProducts(healthyProductIds: string[]): Promise<number> {
    if (healthyProductIds.length === 0) return 0;
    const result = await this.db.restockAlert.updateMany({
      where: {
        productId: { in: healthyProductIds },
        status: 'ACTIVE',
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
    return result.count;
  }
}
