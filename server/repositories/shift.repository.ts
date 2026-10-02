import { PrismaClient, CashShift } from '@prisma/client';
import { prisma } from '../config/database';

export class ShiftRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findActiveShift(cashierName?: string): Promise<CashShift | null> {
    const where: any = {
      status: 'OPEN',
    };
    if (cashierName) {
      where.cashierName = cashierName;
    }
    return this.client.cashShift.findFirst({
      where,
      orderBy: {
        openedAt: 'desc',
      },
    });
  }

  async findById(id: string): Promise<CashShift | null> {
    return this.client.cashShift.findUnique({
      where: { id },
      include: {
        sales: {
          include: {
            items: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        outflows: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async createOutflow(data: {
    shiftId: string;
    amountUsd?: number;
    amountBs?: number;
    reason: string;
    authorizedBy?: string;
  }) {
    return this.client.cashOutflow.create({
      data: {
        shiftId: data.shiftId,
        amountUsd: data.amountUsd || 0,
        amountBs: data.amountBs || 0,
        reason: data.reason,
        authorizedBy: data.authorizedBy || 'Administrador',
      },
    });
  }

  async createShift(data: {
    cashierName?: string;
    registerName?: string;
    bcvRate: number;
    initialCashUsd?: number;
    initialCashBs?: number;
    notes?: string;
  }): Promise<CashShift> {
    const totalCount = await this.client.cashShift.count();
    const shiftNumber = totalCount + 1;

    return this.client.cashShift.create({
      data: {
        shiftNumber,
        cashierName: data.cashierName || 'Caja 1 - Principal',
        registerName: data.registerName || 'Caja Principal',
        status: 'OPEN',
        openedAt: new Date(),
        bcvRate: data.bcvRate,
        initialCashUsd: data.initialCashUsd || 0,
        initialCashBs: data.initialCashBs || 0,
        notes: data.notes || '',
      },
    });
  }

  async closeShift(id: string, notes?: string): Promise<any> {
    return this.client.cashShift.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        notes: notes !== undefined ? notes : undefined,
      },
      include: {
        sales: true,
        outflows: true,
      },
    });
  }

  async findAllShifts(dateFilter?: string): Promise<CashShift[]> {
    const where: any = {};

    if (dateFilter) {
      // YYYY-MM-DD format
      const startDate = new Date(`${dateFilter}T00:00:00.000Z`);
      const endDate = new Date(`${dateFilter}T23:59:59.999Z`);
      where.openedAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    return this.client.cashShift.findMany({
      where,
      orderBy: {
        openedAt: 'desc',
      },
      include: {
        sales: true,
        outflows: true,
      },
    });
  }

  async findAllShiftsPaginated(options: {
    dateFilter?: string;
    page?: number;
    limit?: number;
    cashierName?: string;
  }) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Math.min(Number(options.limit) || 30, 200));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options.dateFilter) {
      const startDate = new Date(`${options.dateFilter}T00:00:00.000Z`);
      const endDate = new Date(`${options.dateFilter}T23:59:59.999Z`);
      where.openedAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (options.cashierName) {
      where.cashierName = { contains: options.cashierName };
    }

    const [total, shifts] = await Promise.all([
      this.client.cashShift.count({ where }),
      this.client.cashShift.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          openedAt: 'desc',
        },
        include: {
          sales: true,
          outflows: true,
        },
      }),
    ]);

    return {
      shifts,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
