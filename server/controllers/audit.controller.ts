import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/audit.service';

export class AuditController {
  constructor(private readonly auditService: AuditService = new AuditService()) {}

  /**
   * GET /api/v1/audits
   * Query: status
   */
  listAudits = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.query;
      const audits = await this.auditService.listAudits(status ? String(status) : undefined);
      res.status(200).json({
        ok: true,
        success: true,
        data: audits,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/audits/:id
   */
  getAudit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const audit = await this.auditService.getAudit(id);
      res.status(200).json({
        ok: true,
        success: true,
        data: audit,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/audits/start
   * Body: { type: 'CATEGORY'|'MANUAL'|'ALL', category?: string, productIds?: string[], createdBy?: string }
   */
  startAudit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, category, productIds, createdBy } = req.body;
      const audit = await this.auditService.startAudit({
        type,
        category,
        productIds,
        createdBy,
      });
      res.status(201).json({
        ok: true,
        success: true,
        message: 'Auditoría iniciada correctamente',
        data: audit,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/audits/:id/save-progress
   * Body: { items: Array<{ itemId: string; countedStock: number | null }> }
   */
  saveProgress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { items } = req.body;
      const result = await this.auditService.saveProgress(id, items);
      res.status(200).json({
        ok: true,
        success: true,
        message: 'Avance guardado con éxito',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/audits/:id/close
   * Body: { itemsCounts: Array<{ itemId: string; countedStock: number }>, completedBy: string }
   */
  closeAudit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { itemsCounts, completedBy } = req.body;
      const closedAudit = await this.auditService.closeAudit(id, {
        itemsCounts,
        completedBy,
      });
      res.status(200).json({
        ok: true,
        success: true,
        message: 'Auditoría cerrada con éxito y stock actualizado en Kardex',
        data: closedAudit,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/audits/:id/cancel
   */
  cancelAudit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const cancelled = await this.auditService.cancelAudit(id);
      res.status(200).json({
        ok: true,
        success: true,
        message: 'Auditoría cancelada',
        data: cancelled,
      });
    } catch (error) {
      next(error);
    }
  };
}
