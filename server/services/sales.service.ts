import { ProductRepository } from '../repositories/product.repository';
import { SalesRepository } from '../repositories/sales.repository';
import { CreateSaleRequest, SaleResponse } from '../domain/entities/types';
import { InsufficientStockError } from '../domain/errors/insufficient-stock.error';
import { ProductNotFoundError } from '../domain/errors/product-not-found.error';
import { AppError } from '../domain/errors/app-error';
import { ProductService } from './product.service';
import { BcvService } from './bcv.service';
import { clearDashboardCache } from '../controllers/dashboard.controller';
import { cloudSyncService } from './cloud-sync.service';

interface ProcessedItem {
  productId: string;
  productName: string;
  productBarcode: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  previousStock: number;
  newStock: number;
  totalStockToDeduct: number;
  productCost: number;
  presentationName?: string;
}

export class SalesService {
  private readonly bcvService = new BcvService();

  constructor(
    private readonly salesRepo: SalesRepository = new SalesRepository(),
    private readonly productRepo: ProductRepository = new ProductRepository(),
    private readonly productService?: ProductService
  ) {}

  /**
   * Process a sale with 100% atomic inventory guarantees using Prisma's $transaction.
   * Prevents race conditions by locking and atomically updating stock in an isolated transaction.
   */
  async processSale(saleData: CreateSaleRequest): Promise<SaleResponse> {
    if (!saleData.items || saleData.items.length === 0) {
      throw new AppError('La venta debe contener al menos un producto', 400, 'EMPTY_SALE_ITEMS');
    }

    const cashier = saleData.cashierName || 'Caja 1 - Principal';

    // Execute everything inside an isolated atomic transaction
    const completedSale = await this.salesRepo.runInTransaction(async (tx) => {
      // Generate sequential invoice number: NE-0001, NE-0002...
      const existingCount = await tx.sale.count();
      const invoiceNumber = `NE-${String(existingCount + 1).padStart(4, '0')}`;

      let calculatedSubtotal = 0;
      const processedItems: ProcessedItem[] = [];

      // Sort items by productId to prevent database deadlocks on multi-item concurrent transactions
      const sortedItems = [...saleData.items].sort((a, b) => a.productId.localeCompare(b.productId));

      for (const item of sortedItems) {
        if (item.quantity <= 0) {
          throw new AppError(
            `Cantidad inválida (${item.quantity}) para el producto`,
            400,
            'INVALID_QUANTITY'
          );
        }

        // Fetch current product state inside the transaction
        let product;
        let isVirtual = false;
        const isContainer = item.productId.startsWith('container-');

        if (isContainer) {
          // Find or create a generic container product to satisfy foreign key constraints
          const genericBarcode = 'GENERIC-CONTAINER';
          let genericProduct = await this.productRepo.findByBarcode(genericBarcode, tx);
          
          if (!genericProduct) {
            genericProduct = await tx.product.create({
              data: {
                barcode: genericBarcode,
                sku: 'GENERIC-CONTAINER',
                name: 'Envase/Garantía Genérico',
                category: 'Envases',
                price: 0,
                cost: 0,
                stock: 999999,
                isActive: true,
                unit: 'und'
              }
            });
          }
          
          product = genericProduct;
          isVirtual = true;
        } else {
          product = await this.productRepo.findById(item.productId, tx);
          if (!product || !product.isActive) {
            throw new ProductNotFoundError(item.productId, 'id');
          }
        }

        // Calculate units to deduct and unit price
        const unitsPerItem = item.unitsToDeduct && item.unitsToDeduct > 0 ? item.unitsToDeduct : 1;
        const totalStockToDeduct = item.quantity * unitsPerItem;
        const unitPriceToCharge = item.unitPrice !== undefined ? item.unitPrice : product.price;

        // Pre-check stock (skip for virtual products)
        if (!isVirtual && product.stock < totalStockToDeduct) {
          throw new InsufficientStockError(
            product.name,
            product.stock,
            totalStockToDeduct,
            product.id
          );
        }

        // Atomic decrement in Prisma (skip for virtual products)
        let updatedStock = product.stock;
        if (!isVirtual) {
          const updatedProduct = await this.productRepo.decrementStockAtomic(
            tx,
            product.id,
            totalStockToDeduct
          );
          updatedStock = updatedProduct.stock;

          // Strict post-check: if a concurrent process consumed the stock, roll back immediately!
          if (updatedStock < 0) {
            throw new InsufficientStockError(
              product.name,
              product.stock,
              totalStockToDeduct,
              product.id
            );
          }
        }

        const itemSubtotal = Math.round(unitPriceToCharge * item.quantity * 100) / 100;
        calculatedSubtotal += itemSubtotal;

        // For display name, we use the specific container name if provided in the item
        const displayName = isContainer && item.productName 
          ? item.productName
          : item.presentationName 
            ? `${product.name} (${item.presentationName})`
            : product.name;

        processedItems.push({
          productId: product.id,
          productName: displayName,
          productBarcode: isContainer ? (item.productBarcode || 'ENV-VIRTUAL') : product.barcode,
          unitPrice: unitPriceToCharge,
          quantity: item.quantity,
          subtotal: itemSubtotal,
          previousStock: product.stock,
          newStock: updatedStock,
          totalStockToDeduct: isVirtual ? 0 : totalStockToDeduct,
          productCost: product.cost,
          presentationName: item.presentationName,
        });
      }

      // Find or verify active cash shift for this specific cashier
      const activeShift = await tx.cashShift.findFirst({
        where: {
          status: 'OPEN',
          cashierName: cashier,
        },
        orderBy: { openedAt: 'desc' },
      });

      if (!activeShift) {
        throw new AppError(
          'Para poder realizar cobros en el POS debe abrir un turno en la función de Arqueo de Caja.',
          400,
          'NO_ACTIVE_SHIFT'
        );
      }

      // No tax (IVA removed per user request)
      const tax = 0;
      let total = calculatedSubtotal;

      // Extract adjusted total from METADATA_JSON if present
      if (saleData.notes && saleData.notes.startsWith('METADATA_JSON:')) {
        try {
          const jsonStr = saleData.notes.replace('METADATA_JSON:', '');
          const meta = JSON.parse(jsonStr);
          if (meta.adjustedTotalUsd !== undefined && typeof meta.adjustedTotalUsd === 'number') {
            total = Math.round(meta.adjustedTotalUsd * 100) / 100;
          }
        } catch (e) {
          console.error('Error parsing METADATA_JSON in sales service:', e);
        }
      }

      // Round total to 2 decimal places
      total = Math.round(total * 100) / 100;

      // For electronic and credit methods (DEBIT_CARD, PAGO_MOVIL, CREDIT, BINANCE), amount paid matches total automatically
      let amountPaid = Number(saleData.amountPaid);
      if (isNaN(amountPaid)) amountPaid = total;
      amountPaid = Math.round(amountPaid * 100) / 100;

      const isAutoCovered = saleData.paymentMethod === 'DEBIT_CARD' || 
                            saleData.paymentMethod === 'PAGO_MOVIL' || 
                            saleData.paymentMethod === 'CREDIT' || 
                            saleData.paymentMethod === 'BINANCE';
      if (isAutoCovered) {
        amountPaid = total;
      }

      // If amountPaid has tiny floating point difference (< 2 cents) due to rate conversion, adjust
      if (Math.abs(amountPaid - total) <= 0.02) {
        amountPaid = total;
      }

      // Validate payment amount
      if (amountPaid < total) {
        throw new AppError(
          `Monto pagado ($${amountPaid.toFixed(2)}) es menor al total requerido ($${total.toFixed(2)})`,
          400,
          'INSUFFICIENT_PAYMENT',
          { totalRequired: total, amountPaid }
        );
      }

      const changeDue = Math.round((amountPaid - total) * 100) / 100;

      // Capture the actual currently active effective rate of the system
      const currentRateInfo = await this.bcvService.getRate();
      const historicalBcvRate = currentRateInfo.effectiveRate || activeShift.bcvRate;

      // Persist the sale record
      const sale = await this.salesRepo.createSale(tx, {
        invoiceNumber,
        cashierName: cashier,
        paymentMethod: saleData.paymentMethod,
        subtotal: calculatedSubtotal,
        tax,
        total,
        amountPaid,
        changeDue,
        bcvRate: historicalBcvRate,
        notes: saleData.notes,
        shiftId: activeShift.id,
        items: processedItems,
      });

      // Persist stock movement audit log for each item inside the same transaction
      for (const processed of processedItems) {
        const conceptReason = processed.presentationName
          ? `Ticket #${invoiceNumber} (${processed.presentationName})`
          : `Ticket #${invoiceNumber}`;

        await this.salesRepo.createStockMovement(tx, {
          productId: processed.productId,
          saleId: sale.id,
          type: 'SALE',
          quantity: -processed.totalStockToDeduct,
          previousStock: processed.previousStock,
          newStock: processed.newStock,
          unitCost: processed.productCost,
          userName: cashier,
          reason: conceptReason,
        });
      }

      return { sale, processedItems };
    });

    // Sync to cloud (Out of transaction to avoid blocking local execution)
    (async () => {
      try {
        // Sync Sale
        await cloudSyncService.syncEntity('Sale', completedSale.sale);
        
        // Sync SaleItems
        if (completedSale.sale.items) {
          for (const item of completedSale.sale.items) {
            await cloudSyncService.syncEntity('SaleItem', item);
          }
        }

        // Fetch and Sync StockMovements created for this sale
        const movements = await this.salesRepo.findById(completedSale.sale.id).then(s => s?.stockMovements || []);
        for (const mov of movements) {
          await cloudSyncService.syncEntity('StockMovement', mov);
        }
      } catch (err) {
        console.error('[CloudSync] Error syncing sale data:', err);
      }
    })();

    // Invalidate product in-memory cache to ensure subsequent barcode lookups reflect new stock
    if (this.productService) {
      for (const item of completedSale.processedItems) {
        this.productService.invalidateCache(item.productBarcode);
      }
    }

    return {
      id: completedSale.sale.id,
      invoiceNumber: completedSale.sale.invoiceNumber,
      cashierName: completedSale.sale.cashierName,
      paymentMethod: completedSale.sale.paymentMethod,
      subtotal: completedSale.sale.subtotal,
      tax: completedSale.sale.tax,
      total: completedSale.sale.total,
      amountPaid: completedSale.sale.amountPaid,
      changeDue: completedSale.sale.changeDue,
      bcvRate: completedSale.sale.bcvRate,
      status: completedSale.sale.status,
      createdAt: completedSale.sale.createdAt,
      items: completedSale.processedItems.map((item) => ({
        id: item.productId,
        productId: item.productId,
        productName: item.productName,
        productBarcode: item.productBarcode,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
    };
  }

  /**
   * Void / Cancel a completed sale with complete transactional guarantee:
   * 1. Returns all product stock back to inventory.
   * 2. Logs positive RETURN stock movement in the Kardex for immutable auditing.
   * 3. Sets sale status to 'VOIDED' with reason, cashier and timestamp in audit notes.
   * 4. Invalidates in-memory barcode lookup cache.
   */
  async voidSale(saleId: string, reason: string, voidedBy = 'Administrador'): Promise<any> {
    if (!reason || !reason.trim()) {
      throw new AppError('Debe especificar un motivo obligatorio para anular la venta', 400, 'REASON_REQUIRED');
    }

    const completedVoid = await this.salesRepo.runInTransaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          items: true,
          stockMovements: true,
        },
      });

      if (!sale) {
        throw new AppError(`Venta con ID "${saleId}" no encontrada`, 404, 'SALE_NOT_FOUND');
      }

      if (sale.status === 'VOIDED') {
        throw new AppError(`La nota de entrega "${sale.invoiceNumber}" ya se encuentra anulada.`, 400, 'ALREADY_VOIDED');
      }

      // 1. Return each item stock back to inventory and log in Kardex
      const itemsToInvalidate: Array<{ barcode: string }> = [];

      for (const item of sale.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (product) {
          // Find original deducted quantity from the sale's stock movements
          const originalSaleMovement = sale.stockMovements.find(
            (m) => m.productId === item.productId && m.type === 'SALE'
          );
          const unitsToReturn = originalSaleMovement 
            ? Math.abs(originalSaleMovement.quantity) 
            : item.quantity;

          const previousStock = product.stock;
          const newStock = Math.round((previousStock + unitsToReturn) * 1000) / 1000;

          // Increment stock back
          await tx.product.update({
            where: { id: product.id },
            data: { stock: newStock },
          });

          // Create Kardex entry movement (RETURN / Anulación)
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              saleId: sale.id,
              type: 'RETURN',
              quantity: unitsToReturn, // Positive value: item returned to inventory
              previousStock,
              newStock,
              unitCost: product.cost,
              userName: voidedBy,
              reason: `Devolución por Anulación de Ticket #${sale.invoiceNumber} - Motivo: ${reason.trim()}`,
            },
          });

          itemsToInvalidate.push({ barcode: product.barcode });
        }
      }

      // 2. Mark sale as VOIDED with audit note
      const voidAuditNote = `[ANULADA por ${voidedBy} - Motivo: ${reason.trim()} - Fecha: ${new Date().toLocaleString('es-VE')}]`;
      const updatedNotes = sale.notes ? `${sale.notes}\n${voidAuditNote}` : voidAuditNote;

      const updatedSale = await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: 'VOIDED',
          notes: updatedNotes,
        },
        include: {
          items: true,
        },
      });

      return { updatedSale, itemsToInvalidate };
    });

    // Invalidate RAM cache so scanners immediately read the restored stock
    if (this.productService) {
      for (const p of completedVoid.itemsToInvalidate) {
        this.productService.invalidateCache(p.barcode);
      }
    }

    // Clear dashboard analytical cache so metrics update instantly
    clearDashboardCache();

    // Sync updated sale status and new RETURN movement to cloud
    (async () => {
      try {
        await cloudSyncService.syncEntity('Sale', completedVoid.updatedSale);
        
        // Find and sync the new RETURN movements
        const movements = await this.salesRepo.findById(completedVoid.updatedSale.id).then(s => s?.stockMovements || []);
        const returnMovements = movements.filter(m => m.type === 'RETURN');
        for (const mov of returnMovements) {
          await cloudSyncService.syncEntity('StockMovement', mov);
        }
      } catch (err) {
        console.error('[CloudSync] Error syncing voided sale:', err);
      }
    })();

    return completedVoid.updatedSale;
  }
}

