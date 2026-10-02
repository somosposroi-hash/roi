import { Request, Response, NextFunction } from 'express';
import { BcvService } from '../services/bcv.service';

export class BcvController {
  constructor(private readonly bcvService: BcvService) {}

  getRate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const force = req.query.force === 'true';
      const clientTime = req.query.clientTime ? String(req.query.clientTime) : undefined;
      const dayOfWeek = req.query.dayOfWeek !== undefined ? Number(req.query.dayOfWeek) : undefined;
      const rateData = await this.bcvService.fetchLiveRate(force, { clientTime, dayOfWeek });
      res.json({
        success: true,
        data: rateData,
      });
    } catch (error) {
      next(error);
    }
  };

  syncRate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rateData = await this.bcvService.fetchLiveRate(true);
      res.json({
        success: true,
        data: rateData,
        message: 'Tasa oficial BCV sincronizada en vivo con la API oficial y registrada en el historial',
      });
    } catch (error) {
      next(error);
    }
  };

  updateRate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { rate, usdRate, eurRate, usdtRate, userName, notes, customDate } = req.body;
      const targetRate = rate !== undefined ? rate : usdRate;
      const parsedRate = Number(targetRate);
      if (isNaN(parsedRate) || parsedRate <= 0) {
        res.status(400).json({
          success: false,
          error: 'Tasa cambiaria inválida. Debe ser un número positivo.',
        });
        return;
      }
      const rateData = await this.bcvService.setManualRate(parsedRate, {
        userName: userName || (req as any).user?.name || 'Administrador',
        notes,
        eurRate: eurRate ? Number(eurRate) : undefined,
        usdtRate: usdtRate ? Number(usdtRate) : undefined,
        customDate,
      });
      res.json({
        success: true,
        data: rateData,
        message: `Tasa cambiaria fijada manualmente a Bs. ${rateData.usdRate} y guardada en el historial`,
      });
    } catch (error) {
      next(error);
    }
  };

  getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { startDate, endDate, source, search, limit, page } = req.query;
      const result = await this.bcvService.getRateHistory({
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        source: source ? String(source) : undefined,
        search: search ? String(search) : undefined,
        limit: limit ? Number(limit) : 30,
        page: page ? Number(page) : 1,
      });
      res.json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
        stats: result.stats,
      });
    } catch (error) {
      next(error);
    }
  };

  addHistoryEntry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { rateDate, usdRate, eurRate, usdtRate, userName, notes } = req.body;
      if (!usdRate || Number(usdRate) <= 0) {
        res.status(400).json({
          success: false,
          error: 'Debe ingresar una tasa USD válida mayor a 0.',
        });
        return;
      }
      if (!rateDate) {
        res.status(400).json({
          success: false,
          error: 'Debe indicar la fecha correspondiente a la tasa.',
        });
        return;
      }

      const created = await this.bcvService.addManualHistoricalRate({
        rateDate,
        usdRate: Number(usdRate),
        eurRate: eurRate ? Number(eurRate) : null,
        usdtRate: usdtRate ? Number(usdtRate) : null,
        userName: userName || (req as any).user?.name || 'Administrador',
        notes: notes || 'Registro manual de tasa histórica',
      });

      res.status(201).json({
        success: true,
        message: 'Tasa de cambio histórica registrada exitosamente',
        data: created,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Error al registrar tasa histórica',
      });
    }
  };

  deleteHistoryEntry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID de registro requerido.',
        });
        return;
      }
      await this.bcvService.deleteHistoricalRate(id);
      res.json({
        success: true,
        message: 'Registro de tasa eliminado del historial',
      });
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // CONFIGURATION & RATE SCHEDULE CONTROLLERS
  // ==========================================

  getConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const config = await this.bcvService.getRateConfig();
      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  };

  updateConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { activeCurrency, customFixedRate, autoSyncEnabled, syncIntervalMin, fallbackCurrency } = req.body;
      const result = await this.bcvService.updateRateConfig({
        activeCurrency,
        customFixedRate: customFixedRate !== undefined ? Number(customFixedRate) : undefined,
        autoSyncEnabled,
        syncIntervalMin: syncIntervalMin !== undefined ? Number(syncIntervalMin) : undefined,
        fallbackCurrency,
      });
      res.json({
        success: true,
        data: result,
        message: 'Configuración de tasa cambiaria actualizada correctamente',
      });
    } catch (error) {
      next(error);
    }
  };

  getSchedules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schedules = await this.bcvService.getSchedules();
      res.json({
        success: true,
        data: schedules,
      });
    } catch (error) {
      next(error);
    }
  };

  createSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        name,
        currencyTarget,
        customRateValue,
        startTime,
        endTime,
        durationType,
        startDate,
        endDate,
        daysOfWeek,
        isActive,
        priority,
        notes,
      } = req.body;

      const created = await this.bcvService.createSchedule({
        name,
        currencyTarget,
        customRateValue,
        startTime,
        endTime,
        durationType,
        startDate,
        endDate,
        daysOfWeek,
        isActive,
        priority,
        notes,
      });

      res.status(201).json({
        success: true,
        data: created,
        message: 'Script de horario de tasa creado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Error al crear script de horario',
      });
    }
  };

  updateSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updated = await this.bcvService.updateSchedule(id, req.body);
      res.json({
        success: true,
        data: updated,
        message: 'Script de horario actualizado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Error actualizando script de horario',
      });
    }
  };

  toggleSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const updated = await this.bcvService.toggleSchedule(id, Boolean(isActive));
      res.json({
        success: true,
        data: updated,
        message: `Script ${isActive ? 'activado' : 'desactivado'} exitosamente`,
      });
    } catch (error: any) {
      next(error);
    }
  };

  deleteSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.bcvService.deleteSchedule(id);
      res.json({
        success: true,
        message: 'Script de horario de tasa eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  };

  evaluateRate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientTime = req.query.clientTime ? String(req.query.clientTime) : undefined;
      const dayOfWeek = req.query.dayOfWeek !== undefined ? Number(req.query.dayOfWeek) : undefined;
      const evalResult = await this.bcvService.evaluateCurrentEffectiveRate({ clientTime, dayOfWeek });
      res.json({
        success: true,
        data: evalResult,
      });
    } catch (error) {
      next(error);
    }
  };
}
