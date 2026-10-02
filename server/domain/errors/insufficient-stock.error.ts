import { AppError } from './app-error';

export class InsufficientStockError extends AppError {
  constructor(
    public readonly productName: string,
    public readonly availableStock: number,
    public readonly requestedQuantity: number,
    public readonly productId?: string
  ) {
    super(
      `Stock insuficiente para "${productName}". Disponible: ${availableStock}, Solicitado: ${requestedQuantity}`,
      409,
      'INSUFFICIENT_STOCK',
      {
        productName,
        availableStock,
        requestedQuantity,
        productId,
      }
    );
  }
}
