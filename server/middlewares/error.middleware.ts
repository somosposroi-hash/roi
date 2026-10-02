import { Request, Response, NextFunction } from 'express';
import { AppError } from '../domain/errors/app-error';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Prisma unique constraint violation (e.g. sku, barcode, invoiceNumber collision)
  if ('code' in err && (err as { code: string }).code === 'P2002') {
    const meta = (err as any).meta;
    const targetFields = Array.isArray(meta?.target) ? meta.target.join(', ') : String(meta?.target || '');
    let userMsg = 'Conflicto de unicidad en la base de datos';

    if (targetFields.includes('sku')) {
      userMsg = 'El código SKU ingresado ya está asignado a otro producto en el sistema.';
    } else if (targetFields.includes('barcode')) {
      userMsg = 'El código de barras ingresado ya pertenece a otro producto.';
    } else if (targetFields.includes('invoiceNumber')) {
      userMsg = 'El número de factura generado ya existe.';
    }

    res.status(409).json({
      success: false,
      error: {
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: userMsg,
        details: err.message,
      },
    });
    return;
  }

  console.error('[Unhandled Error]', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
    },
  });
}
