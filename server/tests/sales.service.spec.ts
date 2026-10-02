import { PrismaClient } from '@prisma/client';
import { SalesService } from '../services/sales.service';
import { SalesRepository } from '../repositories/sales.repository';
import { ProductRepository } from '../repositories/product.repository';
import { InsufficientStockError } from '../domain/errors/insufficient-stock.error';

const prisma = new PrismaClient();

export async function runSalesServiceTests(): Promise<{
  suite: string;
  total: number;
  passed: number;
  failed: number;
  results: Array<{ name: string; passed: boolean; durationMs: number; error?: string }>;
}> {
  const results: Array<{ name: string; passed: boolean; durationMs: number; error?: string }> = [];
  const salesRepo = new SalesRepository(prisma);
  const productRepo = new ProductRepository(prisma);
  const salesService = new SalesService(salesRepo, productRepo);

  // Setup test active shift for cashier 'Test Runner'
  await prisma.cashShift.upsert({
    where: { id: 'test-runner-shift' },
    update: { status: 'OPEN' },
    create: {
      id: 'test-runner-shift',
      shiftNumber: 999,
      cashierName: 'Test Runner',
      registerName: 'Caja Test',
      status: 'OPEN',
      bcvRate: 850.0,
      initialCashUsd: 100,
      initialCashBs: 50000,
    }
  });

  // Setup test product in database
  const testBarcode = 'TEST-UNIT-' + Date.now();
  const testSku = 'SKU-TEST-' + Date.now();
  const testProduct = await prisma.product.create({
    data: {
      barcode: testBarcode,
      sku: testSku,
      name: 'Producto Test Transacción Atómica',
      category: 'Test',
      price: 10.0,
      cost: 6.0,
      stock: 5,
      minStock: 2,
    },
  });

  // TEST 1: Atomic sale execution and stock decrement
  {
    const start = Date.now();
    try {
      const sale = await salesService.processSale({
        cashierName: 'Test Runner',
        paymentMethod: 'CASH_USD',
        amountPaid: 25.0,
        items: [{ productId: testProduct.id, quantity: 2 }],
      });

      const updated = await prisma.product.findUnique({ where: { id: testProduct.id } });
      const movement = await prisma.stockMovement.findFirst({
        where: { saleId: sale.id },
      });

      if (!updated || updated.stock !== 3) {
        throw new Error(`Stock esperado: 3, encontrado: ${updated?.stock}`);
      }

      if (!movement || movement.quantity !== -2 || movement.previousStock !== 5 || movement.newStock !== 3) {
        throw new Error('El registro de auditoría de StockMovement no coincide');
      }

      results.push({
        name: 'Debe procesar la venta dentro de $transaction y decrementar stock con auditoría',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (err: unknown) {
      results.push({
        name: 'Debe procesar la venta dentro de $transaction y decrementar stock con auditoría',
        passed: false,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // TEST 2: Rollback on Insufficient Stock
  {
    const start = Date.now();
    try {
      let errorCaught = false;

      try {
        // Current stock is 3, attempting to sell 10
        await salesService.processSale({
          cashierName: 'Test Runner',
          paymentMethod: 'CASH_USD',
          amountPaid: 200.0,
          items: [{ productId: testProduct.id, quantity: 10 }],
        });
      } catch (err) {
        if (err instanceof InsufficientStockError) {
          errorCaught = true;
        } else {
          throw err;
        }
      }

      if (!errorCaught) {
        throw new Error('Se esperaba InsufficientStockError pero la venta fue permitida');
      }

      // Verify stock was untouched due to transaction rollback
      const current = await prisma.product.findUnique({ where: { id: testProduct.id } });
      if (current?.stock !== 3) {
        throw new Error(`El rollback falló: stock cambió a ${current?.stock} (debía ser 3)`);
      }

      results.push({
        name: 'Debe abortar la transacción (Rollback) si el stock es insuficiente sin alterar inventario',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (err: unknown) {
      results.push({
        name: 'Debe abortar la transacción (Rollback) si el stock es insuficiente sin alterar inventario',
        passed: false,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // TEST 3: Concurrency protection (Race Condition Prevention)
  {
    const start = Date.now();
    try {
      // Stock is currently 3. We launch 6 parallel transactions wanting 1 unit each.
      // Exactly 3 MUST succeed, and exactly 3 MUST fail with 409 InsufficientStock.
      // Final stock MUST be exactly 0, never negative!
      const attempts = Array.from({ length: 6 }).map((_, i) =>
        salesService
          .processSale({
            cashierName: 'Test Runner',
            paymentMethod: 'CASH_USD',
            amountPaid: 15.0,
            items: [{ productId: testProduct.id, quantity: 1 }],
          })
          .then(() => ({ success: true }))
          .catch((err) => ({
            success: false,
            isInsufficientStock: err instanceof InsufficientStockError,
          }))
      );

      const outcomes = await Promise.all(attempts);
      const successes = outcomes.filter((o) => o.success).length;
      const failures = outcomes.filter((o) => !o.success).length;

      const finalProduct = await prisma.product.findUnique({ where: { id: testProduct.id } });

      if (successes !== 3 || failures !== 3) {
        throw new Error(
          `Condición de carrera: ${successes} ventas exitosas, ${failures} fallidas (se esperaban exactamente 3 y 3)`
        );
      }

      if (!finalProduct || finalProduct.stock !== 0) {
        throw new Error(`Stock final inconsistente: ${finalProduct?.stock} (se esperaba 0)`);
      }

      results.push({
        name: 'Debe prevenir condiciones de carrera en ventas altamente concurrentes ($transaction atómica)',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (err: unknown) {
      results.push({
        name: 'Debe prevenir condiciones de carrera en ventas altamente concurrentes ($transaction atómica)',
        passed: false,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Cleanup test product
  await prisma.stockMovement.deleteMany({ where: { productId: testProduct.id } });
  await prisma.saleItem.deleteMany({ where: { productId: testProduct.id } });
  await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {});

  const passed = results.filter((r) => r.passed).length;
  return {
    suite: 'SalesService & Concurrency Tests',
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
