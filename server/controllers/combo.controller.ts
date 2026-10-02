import { Request, Response, NextFunction } from 'express';
import { ComboService } from '../services/combo.service';
import { AppError } from '../domain/errors/app-error';

export class ComboController {
  constructor(private readonly comboService: ComboService = new ComboService()) {}

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const combos = await this.comboService.getAllCombos();
      res.json({
        success: true,
        data: combos
      });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const combo = await this.comboService.getComboById(id);
      if (!combo) {
        throw new AppError(`Combo con ID "${id}" no encontrado`, 404, 'COMBO_NOT_FOUND');
      }
      res.json({
        success: true,
        data: combo
      });
    } catch (err) {
      next(err);
    }
  };

  upsert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const comboData = req.body;
      if (!comboData.id || !comboData.name || comboData.price === undefined) {
        throw new AppError('El combo debe contener id, nombre y precio válido.', 400, 'INVALID_COMBO_DATA');
      }
      const saved = await this.comboService.upsertCombo(comboData);
      res.status(200).json({
        success: true,
        message: 'Combo guardado exitosamente.',
        data: saved
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const deleted = await this.comboService.deleteCombo(id);
      res.json({
        success: true,
        message: deleted ? 'Combo eliminado correctamente.' : 'Combo no encontrado para eliminar.',
        data: { id, deleted }
      });
    } catch (err) {
      next(err);
    }
  };
}
