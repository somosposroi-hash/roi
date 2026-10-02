import { Request, Response, NextFunction } from 'express';
import { SalesService } from '../services/sales.service';
import { SalesRepository } from '../repositories/sales.repository';
import { ProductRepository } from '../repositories/product.repository';
import { ProductService } from '../services/product.service';
import { CreateSaleRequest } from '../domain/entities/types';
import { AppError } from '../domain/errors/app-error';

export class SalesController {
  private readonly salesService: SalesService;
  private readonly salesRepo: SalesRepository;
  private readonly productRepo: ProductRepository;

  constructor(productService?: ProductService) {
    this.salesRepo = new SalesRepository();
    this.productRepo = new ProductRepository();
    this.salesService = new SalesService(this.salesRepo, this.productRepo, productService);
  }

  /**
   * POST /api/v1/sales
   * Process sale with atomic transaction and race-condition prevention
   */
  createSale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { cashierName, paymentMethod, amountPaid, items, notes } = req.body as CreateSaleRequest;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new AppError('Debe incluir una lista de productos válida para la venta', 400, 'INVALID_ITEMS');
      }

      if (!paymentMethod) {
        throw new AppError('Debe especificar un método de pago válido', 400, 'INVALID_PAYMENT_METHOD');
      }

      const isAutoCovered = paymentMethod === 'DEBIT_CARD' || paymentMethod === 'PAGO_MOVIL' || paymentMethod === 'CREDIT' || paymentMethod === 'BINANCE';
      let parsedAmountPaid = Number(amountPaid);
      if (isAutoCovered && (amountPaid === undefined || amountPaid === null || isNaN(parsedAmountPaid) || parsedAmountPaid <= 0)) {
        parsedAmountPaid = 0; // Handled by service as full total
      } else if (isNaN(parsedAmountPaid)) {
        throw new AppError('Monto pagado no es válido', 400, 'INVALID_AMOUNT_PAID');
      }

      const sale = await this.salesService.processSale({
        cashierName,
        paymentMethod,
        amountPaid: parsedAmountPaid,
        items,
        notes,
      });

      res.status(201).json({
        success: true,
        message: 'Venta procesada exitosamente con transacción atómica',
        data: sale,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/sales
   * Retrieve recent sales history with fast pagination (30 per page by default)
   */
  getRecentSales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 30;
      const search = req.query.search ? String(req.query.search) : undefined;
      const status = req.query.status ? String(req.query.status) : undefined;
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
      const cashierName = req.query.cashierName ? String(req.query.cashierName) : undefined;

      const result = await this.salesRepo.findRecentPaginated({
        page,
        limit,
        search,
        status,
        startDate,
        endDate,
        cashierName,
      });

      res.json({
        success: true,
        data: result.sales,
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
   * GET /api/v1/sales/:id
   * Retrieve sale details with line items and stock audit log
   */
  getSaleById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const sale = await this.salesRepo.findById(id);

      if (!sale) {
        throw new AppError(`Venta con ID "${id}" no encontrada`, 404, 'SALE_NOT_FOUND');
      }

      res.json({
        success: true,
        data: sale,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/sales/:id/void
   * Void / cancel sale, return items to stock, and log in Kardex
   */
  voidSale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason, voidedBy } = req.body;

      if (!reason || !String(reason).trim()) {
        throw new AppError('Debe ingresar un motivo obligatorio para anular la venta', 400, 'REASON_REQUIRED');
      }

      const updatedSale = await this.salesService.voidSale(
        id, 
        String(reason).trim(), 
        voidedBy ? String(voidedBy) : 'Administrador'
      );

      res.json({
        success: true,
        message: 'Venta anulada exitosamente y productos devueltos al inventario.',
        data: updatedSale,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/sales/stats/summary
   * POS sales totals and daily metrics
   */
  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.salesRepo.getSummaryStats();
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/sales/test-concurrency
   * Live demonstration of atomic transactions and race-condition safety.
   * Simulates N simultaneous concurrent sale requests attempting to purchase stock.
   */
  testConcurrency = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { productId, concurrentRequests = 5, quantityPerRequest = 1 } = req.body;

      const product = await this.productRepo.findById(productId);
      if (!product) {
        throw new AppError(`Producto no encontrado para la prueba`, 404, 'PRODUCT_NOT_FOUND');
      }

      const initialStock = product.stock;
      const startTime = Date.now();

      // Launch N promises concurrently in parallel to test Prisma $transaction isolation
      const tasks = Array.from({ length: concurrentRequests }).map(async (_, idx) => {
        const reqStart = Date.now();
        try {
          await this.salesService.processSale({
            cashierName: `Cajero Concurrente #${idx + 1}`,
            paymentMethod: 'CASH_USD',
            amountPaid: 1000,
            items: [{ productId, quantity: quantityPerRequest }],
            notes: `Test de concurrencia hilo ${idx + 1}`,
          });

          return {
            attempt: idx + 1,
            success: true,
            timeMs: Date.now() - reqStart,
          };
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          return {
            attempt: idx + 1,
            success: false,
            error: errorMsg,
            timeMs: Date.now() - reqStart,
          };
        }
      });

      const results = await Promise.all(tasks);
      const totalTimeMs = Date.now() - startTime;

      // Verify final stock
      const updatedProduct = await this.productRepo.findById(productId);
      const finalStock = updatedProduct ? updatedProduct.stock : 0;

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      // Mathematical verification of zero race conditions
      const expectedReduction = successful * quantityPerRequest;
      const actualReduction = initialStock - finalStock;
      const raceConditionDetected = actualReduction !== expectedReduction || finalStock < 0;

      res.json({
        success: true,
        data: {
          totalRequests: concurrentRequests,
          successful,
          failed,
          initialStock,
          finalStock,
          durationMs: totalTimeMs,
          raceConditionDetected,
          guaranteeNote: raceConditionDetected
            ? '¡PELIGRO! Se detectó una inconsistencia de stock.'
            : 'ÉXITO: La transacción atómica de Prisma garantizó consistencia perfecta. 0 sobreventas y stock final exacto.',
          logs: results,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
