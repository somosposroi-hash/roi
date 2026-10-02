import { KardexRepository, KardexFilterOptions } from '../repositories/kardex.repository';
import { AppError } from '../domain/errors/app-error';

export class KardexService {
  constructor(private readonly kardexRepo: KardexRepository = new KardexRepository()) {}

  async getKardex(options: KardexFilterOptions) {
    // Ensure initial sample kardex data exists if database is fresh
    await this.kardexRepo.ensureSampleKardexData();
    return this.kardexRepo.findMovements(options);
  }

  async adjustStock(data: {
    productId: string;
    type: string;
    quantity: number;
    unitCost?: number;
    userName?: string;
    reason: string;
  }) {
    if (!data.productId) {
      throw new AppError('El ID del producto es requerido', 400, 'MISSING_PRODUCT_ID');
    }

    if (data.quantity === 0) {
      throw new AppError('La cantidad del movimiento no puede ser cero (0)', 400, 'ZERO_QUANTITY');
    }

    if (!data.reason || !data.reason.trim()) {
      throw new AppError('Debe indicar el concepto o motivo del movimiento', 400, 'MISSING_REASON');
    }

    const validTypes = ['RESTOCK', 'ADJUSTMENT', 'WASTE', 'INITIAL', 'RETURN', 'SALE', 'AUDIT_ADJUSTMENT'];
    const typeUpper = (data.type || 'ADJUSTMENT').toUpperCase();

    if (!validTypes.includes(typeUpper)) {
      throw new AppError(
        `Tipo de movimiento inválido (${data.type}). Tipos permitidos: ${validTypes.join(', ')}`,
        400,
        'INVALID_TYPE'
      );
    }

    // Adjust sign according to movement type if needed
    let finalQty = data.quantity;
    if (typeUpper === 'WASTE' && finalQty > 0) {
      // Waste/merma is an outflow (negative)
      finalQty = -finalQty;
    }

    return this.kardexRepo.adjustStock({
      productId: data.productId,
      type: typeUpper,
      quantity: finalQty,
      unitCost: data.unitCost,
      userName: data.userName || 'Admin',
      reason: data.reason.trim(),
    });
  }
}
