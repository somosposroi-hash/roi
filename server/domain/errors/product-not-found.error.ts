import { AppError } from './app-error';

export class ProductNotFoundError extends AppError {
  constructor(identifier: string, by: 'barcode' | 'id' | 'sku' = 'barcode') {
    super(
      `Producto no encontrado con ${by}: "${identifier}"`,
      404,
      'PRODUCT_NOT_FOUND',
      { identifier, by }
    );
  }
}
