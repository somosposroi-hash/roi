import { Request, Response, NextFunction } from 'express';
import { KardexService } from '../services/kardex.service';

export class KardexController {
  constructor(private readonly kardexService: KardexService = new KardexService()) {}

  /**
   * GET /api/v1/kardex
   * Query params: productId, type, userName, startDate, endDate, search, page, limit
   */
  getKardex = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId, type, userName, startDate, endDate, search, page, limit } = req.query;

      const result = await this.kardexService.getKardex({
        productId: productId ? String(productId) : undefined,
        type: type ? String(type) : undefined,
        userName: userName ? String(userName) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        search: search ? String(search) : undefined,
        page: page ? parseInt(String(page), 10) : 1,
        limit: limit ? parseInt(String(limit), 10) : 50,
      });

      res.status(200).json({
        ok: true,
        success: true,
        data: result.movements,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/kardex/adjust
   * Body: { productId, type, quantity, unitCost, userName, reason }
   */
  adjustStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId, type, quantity, unitCost, userName, reason } = req.body;

      const result = await this.kardexService.adjustStock({
        productId,
        type,
        quantity: parseFloat(quantity),
        unitCost: unitCost !== undefined ? parseFloat(unitCost) : undefined,
        userName: userName || 'Admin',
        reason,
      });

      res.status(201).json({
        ok: true,
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
