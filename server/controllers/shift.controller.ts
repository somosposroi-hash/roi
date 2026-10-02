import { Request, Response, NextFunction } from 'express';
import { ShiftService } from '../services/shift.service';

export class ShiftController {
  constructor(private readonly shiftService: ShiftService = new ShiftService()) {}

  getActiveShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cashierName = req.query.cashierName ? String(req.query.cashierName) : undefined;
      const shift = await this.shiftService.getActiveShift(cashierName);
      res.json({
        success: true,
        data: shift,
      });
    } catch (err) {
      next(err);
    }
  };

  openShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { cashierName, registerName, initialCashUsd, initialCashBs, notes, bcvRate } = req.body;
      const shift = await this.shiftService.openShift({
        cashierName,
        registerName,
        initialCashUsd: Number(initialCashUsd) || 0,
        initialCashBs: Number(initialCashBs) || 0,
        notes,
        bcvRate: Number(bcvRate) || undefined,
      });
      res.status(201).json({
        success: true,
        message: 'Turno de caja abierto exitosamente',
        data: shift,
      });
    } catch (err) {
      next(err);
    }
  };

  closeShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const shift = await this.shiftService.closeShift(id, notes);
      res.json({
        success: true,
        message: 'Turno de caja cerrado exitosamente',
        data: shift,
      });
    } catch (err) {
      next(err);
    }
  };

  listShifts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dateFilter = req.query.date ? String(req.query.date) : undefined;
      const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const cashierName = req.query.cashierName ? String(req.query.cashierName) : undefined;

      if (page !== undefined || limit !== undefined) {
        const result = (await this.shiftService.listShifts({
          dateFilter,
          page: page || 1,
          limit: limit || 30,
          cashierName,
        })) as any;

        res.json({
          success: true,
          data: result.shifts,
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
          },
        });
        return;
      }

      const shifts = await this.shiftService.listShifts(dateFilter);
      res.json({
        success: true,
        data: shifts,
      });
    } catch (err) {
      next(err);
    }
  };

  getShiftReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const report = await this.shiftService.getShiftReport(id);
      res.json({
        success: true,
        data: report,
      });
    } catch (err) {
      next(err);
    }
  };

  createOutflow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { amountUsd, amountBs, reason, authorizedBy } = req.body;
      if (!reason || (!amountUsd && !amountBs)) {
        res.status(400).json({
          success: false,
          error: 'Debe proporcionar un motivo y al menos un monto (USD o Bs) para la salida de caja.',
        });
        return;
      }

      const outflow = await this.shiftService.createOutflow({
        shiftId: id,
        amountUsd: Number(amountUsd) || 0,
        amountBs: Number(amountBs) || 0,
        reason: String(reason),
        authorizedBy: authorizedBy ? String(authorizedBy) : 'Administrador',
      });

      res.status(201).json({
        success: true,
        message: 'Salida de caja chica registrada exitosamente',
        data: outflow,
      });
    } catch (err) {
      next(err);
    }
  };
}
