import { PrismaClient, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../config/database';

export class AuditRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async findAll(status?: string, limit = 50) {
    const where: Prisma.InventoryAuditWhereInput = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    return this.db.inventoryAudit.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  }

  async findById(id: string) {
    const audit = await this.db.inventoryAudit.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [
            { categoryName: 'asc' },
            { productName: 'asc' },
          ],
          include: {
            product: true,
          },
        },
      },
    });

    if (!audit) return null;

    // Fetch movements that occurred for these products between audit.startedAt and now (or completedAt)
    const productIds = audit.items.map((it) => it.productId);
    const endBoundary = audit.completedAt || new Date();

    const movements = await this.db.stockMovement.findMany({
      where: {
        productId: { in: productIds },
        createdAt: {
          gte: audit.startedAt,
          lte: endBoundary,
        },
      },
      select: {
        productId: true,
        type: true,
        quantity: true,
      },
    });

    // Aggregate movements per product
    const statsByProduct: Record<string, { sales: number; inbound: number; outbound: number }> = {};
    for (const pid of productIds) {
      statsByProduct[pid] = { sales: 0, inbound: 0, outbound: 0 };
    }

    for (const mov of movements) {
      const pStats = statsByProduct[mov.productId];
      if (!pStats) continue;

      if (mov.type === 'SALE' || mov.quantity < 0 && mov.type !== 'WASTE' && mov.type !== 'AUDIT_ADJUSTMENT') {
        pStats.sales += Math.abs(mov.quantity);
      } else if (mov.type === 'RESTOCK' || mov.type === 'INITIAL' || (mov.quantity > 0 && mov.type !== 'AUDIT_ADJUSTMENT')) {
        pStats.inbound += Math.abs(mov.quantity);
      } else if (mov.type === 'WASTE' || mov.type === 'ADJUSTMENT') {
        pStats.outbound += Math.abs(mov.quantity);
      }
    }

    // Attach dynamic movement stats to each audit item
    const enrichedItems = audit.items.map((item) => {
      const stats = statsByProduct[item.productId] || { sales: 0, inbound: 0, outbound: 0 };
      return {
        ...item,
        salesQty: Math.round(stats.sales * 1000) / 1000,
        inboundQty: Math.round(stats.inbound * 1000) / 1000,
        outboundQty: Math.round(stats.outbound * 1000) / 1000,
      };
    });

    return {
      ...audit,
      items: enrichedItems,
    };
  }

  async createAudit(data: {
    type: string;
    categoryFilter?: string;
    createdBy?: string;
    products: Array<{
      id: string;
      name: string;
      category?: string | null;
      unit: string;
      stock: number;
      cost: number;
    }>;
  }) {
    const lastAudit = await this.db.inventoryAudit.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const nextCode = (lastAudit?.code || 0) + 1;

    return this.db.inventoryAudit.create({
      data: {
        code: nextCode,
        type: data.type,
        categoryFilter: data.categoryFilter || (data.type === 'ALL' ? 'Todos los Productos' : 'Selección Manual'),
        createdBy: data.createdBy || 'Admin',
        status: 'IN_PROGRESS',
        items: {
          create: data.products.map((prod) => ({
            productId: prod.id,
            productName: prod.name,
            categoryName: prod.category || 'General',
            unit: prod.unit || 'UND',
            systemStock: prod.stock,
            costPrice: prod.cost || 0,
            countedStock: null,
            differenceQty: 0,
            differenceCost: 0,
            status: 'PENDING',
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async saveProgress(
    auditId: string,
    items: Array<{ itemId: string; countedStock: number | null }>
  ) {
    return this.db.$transaction(async (tx) => {
      const audit = await tx.inventoryAudit.findUnique({
        where: { id: auditId },
        include: { items: true },
      });

      if (!audit) throw new Error(`Auditoría "${auditId}" no encontrada`);
      if (audit.status !== 'IN_PROGRESS') {
        throw new Error('Solo se pueden guardar avances en auditorías en curso');
      }

      for (const item of items) {
        const existing = audit.items.find((i) => i.id === item.itemId);
        if (!existing) continue;

        if (item.countedStock === null || item.countedStock === undefined) {
          await tx.inventoryAuditItem.update({
            where: { id: item.itemId },
            data: {
              countedStock: null,
              differenceQty: 0,
              differenceCost: 0,
              status: 'PENDING',
            },
          });
        } else {
          const counted = Number(item.countedStock);
          const diffQty = Math.round((counted - existing.systemStock) * 1000) / 1000;
          const diffCost = Math.round((diffQty * existing.costPrice) * 100) / 100;

          let status = 'MATCHED';
          if (diffQty < 0) status = 'MISSING';
          else if (diffQty > 0) status = 'SURPLUS';

          await tx.inventoryAuditItem.update({
            where: { id: item.itemId },
            data: {
              countedStock: counted,
              differenceQty: diffQty,
              differenceCost: diffCost,
              status,
            },
          });
        }
      }

      return tx.inventoryAudit.findUnique({
        where: { id: auditId },
        include: { items: true },
      });
    });
  }

  async closeAudit(
    auditId: string,
    data: {
      itemsCounts: Array<{ itemId: string; countedStock: number }>;
      completedBy: string;
    }
  ) {
    return this.db.$transaction(async (tx) => {
      const audit = await tx.inventoryAudit.findUnique({
        where: { id: auditId },
        include: { items: true },
      });

      if (!audit) {
        throw new Error(`Auditoría "${auditId}" no encontrada`);
      }

      if (audit.status !== 'IN_PROGRESS') {
        throw new Error('Esta auditoría ya fue cerrada o cancelada previamente');
      }

      let totalLoss = 0;
      let totalSurplus = 0;

      for (const itemInput of data.itemsCounts) {
        const auditItem = audit.items.find((i) => i.id === itemInput.itemId);
        if (!auditItem) continue;

        const counted = Number(itemInput.countedStock);
        const diffQty = Math.round((counted - auditItem.systemStock) * 1000) / 1000;
        const diffCost = Math.round((diffQty * auditItem.costPrice) * 100) / 100;

        let status = 'MATCHED';
        if (diffQty < 0) {
          status = 'MISSING';
          totalLoss += Math.abs(diffCost);
        } else if (diffQty > 0) {
          status = 'SURPLUS';
          totalSurplus += diffCost;
        }

        // 1. Update audit item record
        await tx.inventoryAuditItem.update({
          where: { id: auditItem.id },
          data: {
            countedStock: counted,
            differenceQty: diffQty,
            differenceCost: diffCost,
            status,
          },
        });

        // 2. If there's a discrepancy, adjust product stock and create Kardex entry
        if (diffQty !== 0) {
          const product = await tx.product.findUnique({
            where: { id: auditItem.productId },
          });

          if (product) {
            const previousStock = product.stock;
            // Formula: Add the difference (countedStock - snapshotStock) to the live stock!
            const newStock = Math.max(0, Math.round((previousStock + diffQty) * 1000) / 1000);

            // Update live product stock
            await tx.product.update({
              where: { id: auditItem.productId },
              data: { stock: newStock },
            });

            // Create detailed Kardex StockMovement record
            const reasonPrefix = diffQty > 0 ? 'Sobrante +' : 'Faltante ';
            await tx.stockMovement.create({
              data: {
                productId: auditItem.productId,
                type: 'AUDIT_ADJUSTMENT',
                quantity: diffQty,
                previousStock,
                newStock,
                unitCost: auditItem.costPrice,
                userName: data.completedBy || 'Auditor',
                reason: `Ajuste por Auditoría #${String(audit.code).padStart(3, '0')} (${reasonPrefix}${diffQty.toFixed(2)} ${auditItem.unit})`,
              },
            });
          }
        }
      }

      totalLoss = Math.round(totalLoss * 100) / 100;
      totalSurplus = Math.round(totalSurplus * 100) / 100;
      const netDifference = Math.round((totalSurplus - totalLoss) * 100) / 100;

      // 3. Finalize the audit record
      const completedAudit = await tx.inventoryAudit.update({
        where: { id: auditId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedBy: data.completedBy || 'Auditor',
          totalLossCost: totalLoss,
          totalSurplusCost: totalSurplus,
          netDifferenceCost: netDifference,
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      return completedAudit;
    });
  }

  async cancelAudit(auditId: string) {
    const audit = await this.db.inventoryAudit.findUnique({
      where: { id: auditId },
    });
    if (!audit) throw new Error('Auditoría no encontrada');
    if (audit.status !== 'IN_PROGRESS') {
      throw new Error('Solo se pueden cancelar auditorías en progreso');
    }

    return this.db.inventoryAudit.update({
      where: { id: auditId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });
  }
}
