import { ShiftRepository } from '../repositories/shift.repository';
import { AppError } from '../domain/errors/app-error';
import { BcvService } from './bcv.service';
import { cloudSyncService } from './cloud-sync.service';

export interface ShiftReport {
  shift: any;
  salesCount: number;
  bcvRate: number;
  initialCashUsd: number;
  initialCashBs: number;
  breakdown: {
    bsMethods: {
      debitCardBs: number;
      debitCardUsdEq: number;
      pagoMovilBs: number;
      pagoMovilUsdEq: number;
      cashBs: number;
      cashBsUsdEq: number;
      totalBs: number;
      totalBsUsdEq: number;
    };
    usdMethods: {
      cashUsd: number;
      totalUsd: number;
    };
    usdtMethods: {
      binanceUsdt: number;
      totalUsdt: number;
    };
    creditMethods: {
      creditUsd: number;
      totalCreditUsd: number;
    };
    changeGiven: {
      totalChangeUsd: number;
      totalChangeBs: number;
    };
    outflows: {
      totalOutflowsUsd: number;
      totalOutflowsBs: number;
      list: any[];
    };
    cajaChica: {
      initialUsd: number;
      initialBs: number;
      cashInflowUsd: number;
      cashInflowBs: number;
      changeGivenUsd: number;
      changeGivenBs: number;
      outflowsUsd: number;
      outflowsBs: number;
      finalUsd: number;
      finalBs: number;
      finalTotalUsdEq: number;
    };
    grandTotalUsd: number;
  };
  sales: any[];
  outflows: any[];
}

export class ShiftService {
  constructor(
    private readonly shiftRepo: ShiftRepository = new ShiftRepository(),
    private readonly bcvService: BcvService = new BcvService()
  ) {}

  async getActiveShift(cashierName?: string) {
    return this.shiftRepo.findActiveShift(cashierName);
  }

  async openShift(data: {
    cashierName?: string;
    registerName?: string;
    initialCashUsd?: number;
    initialCashBs?: number;
    notes?: string;
    bcvRate?: number;
  }) {
    // Check if an open shift already exists
    const active = await this.shiftRepo.findActiveShift(data.cashierName);
    if (active) {
      return active;
    }

    let rate = data.bcvRate;
    if (!rate || rate <= 0) {
      const bcvInfo = await this.bcvService.getRate();
      rate = bcvInfo.effectiveRate || bcvInfo.usdRate || 849.56;
    }

    const shift = await this.shiftRepo.createShift({
      ...data,
      bcvRate: rate,
    });

    // Sync to cloud
    cloudSyncService.syncEntity('CashShift', shift);

    return shift;
  }

  async closeShift(id: string, notes?: string) {
    const shift = await this.shiftRepo.findById(id);
    if (!shift) {
      throw new AppError(`Turno con ID "${id}" no encontrado`, 404, 'SHIFT_NOT_FOUND');
    }

    if (shift.status === 'CLOSED') {
      return shift;
    }

    const closedShift = await this.shiftRepo.closeShift(id, notes);

    // Sync to cloud
    cloudSyncService.syncEntity('CashShift', closedShift);

    return closedShift;
  }

  async listShifts(options?: { dateFilter?: string; page?: number; limit?: number; cashierName?: string } | string) {
    if (typeof options === 'string' || options === undefined) {
      return this.shiftRepo.findAllShifts(options);
    }
    return this.shiftRepo.findAllShiftsPaginated(options);
  }

  async createOutflow(data: {
    shiftId: string;
    amountUsd?: number;
    amountBs?: number;
    reason: string;
    authorizedBy?: string;
  }) {
    const shift = await this.shiftRepo.findById(data.shiftId);
    if (!shift) {
      throw new AppError(`Turno con ID "${data.shiftId}" no encontrado`, 404, 'SHIFT_NOT_FOUND');
    }
    const outflow = await this.shiftRepo.createOutflow(data);

    // Sync to cloud
    cloudSyncService.syncEntity('CashOutflow', outflow);

    return outflow;
  }

  async getShiftReport(id: string): Promise<ShiftReport> {
    const shift = await this.shiftRepo.findById(id);
    if (!shift) {
      throw new AppError(`Turno con ID "${id}" no encontrado`, 404, 'SHIFT_NOT_FOUND');
    }

    const rate = shift.bcvRate > 0 ? shift.bcvRate : 849.56;
    const sales = (shift as any).sales || [];
    const outflowsList = (shift as any).outflows || [];

    let debitCardBs = 0;
    let pagoMovilBs = 0;
    let cashBs = 0;

    let cashUsd = 0;
    let binanceUsdt = 0;
    let creditUsd = 0;

    let totalChangeUsd = 0;
    let totalChangeBs = 0;

    let totalCashReceivedUsd = 0;
    let totalCashReceivedBs = 0;

    for (const sale of sales) {
      if (sale.status === 'VOIDED') continue;

      const saleTotalUsd = sale.total;
      const saleTotalBs = Math.round(saleTotalUsd * rate * 100) / 100;

      if (sale.paymentMethod === 'DEBIT_CARD') {
        debitCardBs += saleTotalBs;
      } else if (sale.paymentMethod === 'PAGO_MOVIL') {
        pagoMovilBs += saleTotalBs;
      } else if (sale.paymentMethod === 'CASH_BS') {
        cashBs += saleTotalBs;
        const paidBs = (sale.amountPaid || saleTotalUsd) * rate;
        const changeBs = (sale.changeDue || 0) * rate;
        totalCashReceivedBs += paidBs;
        totalChangeBs += changeBs;
      } else if (sale.paymentMethod === 'CASH_USD') {
        cashUsd += saleTotalUsd;
        const paidUsd = sale.amountPaid || saleTotalUsd;
        const changeUsd = sale.changeDue || 0;
        totalCashReceivedUsd += paidUsd;
        totalChangeUsd += changeUsd;
      } else if (sale.paymentMethod === 'BINANCE') {
        binanceUsdt += saleTotalUsd;
      } else if (sale.paymentMethod === 'CREDIT') {
        creditUsd += saleTotalUsd;
      } else if (sale.paymentMethod === 'SPLIT') {
        let handled = false;
        if (sale.notes && sale.notes.includes('Pago Mixto')) {
          const matches = sale.notes.matchAll(/([A-Z_]+):\s*(\$|Bs\.)\s*([0-9.]+)/g);
          for (const match of matches) {
            const method = match[1];
            const curr = match[2];
            const amt = parseFloat(match[3]);
            if (!isNaN(amt)) {
              handled = true;
              if (method === 'DEBIT_CARD') debitCardBs += curr === 'BS' || curr === 'Bs.' ? amt : amt * rate;
              else if (method === 'PAGO_MOVIL') pagoMovilBs += curr === 'BS' || curr === 'Bs.' ? amt : amt * rate;
              else if (method === 'CASH_BS') {
                const bsAmt = curr === 'BS' || curr === 'Bs.' ? amt : amt * rate;
                cashBs += bsAmt;
                totalCashReceivedBs += bsAmt;
              } else if (method === 'CASH_USD') {
                const usdAmt = curr === 'USD' || curr === '$' ? amt : amt / rate;
                cashUsd += usdAmt;
                totalCashReceivedUsd += usdAmt;
              } else if (method === 'BINANCE') binanceUsdt += curr === 'USD' || curr === '$' ? amt : amt / rate;
              else if (method === 'CREDIT') creditUsd += curr === 'USD' || curr === '$' ? amt : amt / rate;
            }
          }
        }

        if (sale.changeDue && sale.changeDue > 0) {
          totalChangeUsd += sale.changeDue;
        }

        if (!handled) {
          cashUsd += saleTotalUsd;
          totalCashReceivedUsd += sale.amountPaid || saleTotalUsd;
          if (sale.changeDue) totalChangeUsd += sale.changeDue;
        }
      }
    }

    // Outflows sum
    let totalOutflowsUsd = 0;
    let totalOutflowsBs = 0;
    for (const out of outflowsList) {
      totalOutflowsUsd += out.amountUsd || 0;
      totalOutflowsBs += out.amountBs || 0;
    }

    // Rounding calculations
    debitCardBs = Math.round(debitCardBs * 100) / 100;
    pagoMovilBs = Math.round(pagoMovilBs * 100) / 100;
    cashBs = Math.round(cashBs * 100) / 100;
    const totalBs = Math.round((debitCardBs + pagoMovilBs + cashBs) * 100) / 100;

    const debitCardUsdEq = Math.round((debitCardBs / rate) * 100) / 100;
    const pagoMovilUsdEq = Math.round((pagoMovilBs / rate) * 100) / 100;
    const cashBsUsdEq = Math.round((cashBs / rate) * 100) / 100;
    const totalBsUsdEq = Math.round((totalBs / rate) * 100) / 100;

    cashUsd = Math.round(cashUsd * 100) / 100;
    binanceUsdt = Math.round(binanceUsdt * 100) / 100;
    creditUsd = Math.round(creditUsd * 100) / 100;

    totalChangeUsd = Math.round(totalChangeUsd * 100) / 100;
    totalChangeBs = Math.round(totalChangeBs * 100) / 100;
    totalOutflowsUsd = Math.round(totalOutflowsUsd * 100) / 100;
    totalOutflowsBs = Math.round(totalOutflowsBs * 100) / 100;

    totalCashReceivedUsd = Math.round(totalCashReceivedUsd * 100) / 100;
    totalCashReceivedBs = Math.round(totalCashReceivedBs * 100) / 100;

    const initialUsd = shift.initialCashUsd || 0;
    const initialBs = shift.initialCashBs || 0;

    const finalUsd = Math.max(0, Math.round((initialUsd + cashUsd - totalOutflowsUsd) * 100) / 100);
    const finalBs = Math.max(0, Math.round((initialBs + cashBs - totalOutflowsBs) * 100) / 100);
    const finalTotalUsdEq = Math.round((finalUsd + (finalBs / rate)) * 100) / 100;

    const grandTotalUsd = Math.round((totalBsUsdEq + cashUsd + binanceUsdt) * 100) / 100;

    return {
      shift,
      salesCount: sales.filter((s: any) => s.status !== 'VOIDED').length,
      bcvRate: rate,
      initialCashUsd: initialUsd,
      initialCashBs: initialBs,
      breakdown: {
        bsMethods: {
          debitCardBs,
          debitCardUsdEq,
          pagoMovilBs,
          pagoMovilUsdEq,
          cashBs,
          cashBsUsdEq,
          totalBs,
          totalBsUsdEq,
        },
        usdMethods: {
          cashUsd,
          totalUsd: cashUsd,
        },
        usdtMethods: {
          binanceUsdt,
          totalUsdt: binanceUsdt,
        },
        creditMethods: {
          creditUsd,
          totalCreditUsd: creditUsd,
        },
        changeGiven: {
          totalChangeUsd,
          totalChangeBs,
        },
        outflows: {
          totalOutflowsUsd,
          totalOutflowsBs,
          list: outflowsList,
        },
        cajaChica: {
          initialUsd,
          initialBs,
          cashInflowUsd: cashUsd,
          cashInflowBs: cashBs,
          changeGivenUsd: totalChangeUsd,
          changeGivenBs: totalChangeBs,
          outflowsUsd: totalOutflowsUsd,
          outflowsBs: totalOutflowsBs,
          finalUsd,
          finalBs,
          finalTotalUsdEq,
        },
        grandTotalUsd,
      },
      sales,
      outflows: outflowsList,
    };
  }
}
