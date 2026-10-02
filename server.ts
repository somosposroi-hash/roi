import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import authRoutes from './server/routes/auth.routes';
import { prisma, initializeDatabasePragmas } from './server/config/database';
import { ProductRepository } from './server/repositories/product.repository';
import { SalesRepository } from './server/repositories/sales.repository';
import { ProductService } from './server/services/product.service';
import { CronService } from './server/services/cron.service';
import { BcvService } from './server/services/bcv.service';
import { SalesController } from './server/controllers/sales.controller';
import { ProductController } from './server/controllers/product.controller';
import { AlertController } from './server/controllers/alert.controller';
import { BcvController } from './server/controllers/bcv.controller';
import { ShiftController } from './server/controllers/shift.controller';
import { KardexController } from './server/controllers/kardex.controller';
import { AuditController } from './server/controllers/audit.controller';
import { DashboardController } from './server/controllers/dashboard.controller';
import { ComboController } from './server/controllers/combo.controller';
import { SystemController } from './server/controllers/system.controller';
import { SystemService } from './server/services/system.service';
import { systemConfigService } from './server/services/system-config.service';
import { requireModule } from './server/middlewares/module.middleware';
import { errorHandler } from './server/middlewares/error.middleware';
import { responseTiming } from './server/middlewares/timing.middleware';
import { runAllUnitTests } from './server/tests/run-tests';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy for secure headers (necessary when behind Cloud Run / reverse proxies)
  app.set('trust proxy', 1);

  // Basic middlewares
  app.use(express.json({ limit: '10mb' }));
  
  // Security Headers with helmet (configured to allow iframe embedding in AI Studio)
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false, // Allow iframe embedding in AI Studio preview
  }));

  app.use(cookieParser());
  app.use(responseTiming);

  // Initialize SQLite WAL mode and SQLite pragmas for high concurrency
  await initializeDatabasePragmas();

  // Initialize System Configuration (modular activation and resource optimization cache)
  await systemConfigService.initialize();

  // Instantiate clean architecture services & controllers
  const productRepo = new ProductRepository(prisma);
  const productService = new ProductService(productRepo);
  const cronService = new CronService(productRepo);
  const bcvService = new BcvService();

  // React to modular status changes (zero background CPU overhead)
  systemConfigService.onModuleStatusChange((moduleId, isEnabled) => {
    if (moduleId === 'alerts') {
      if (isEnabled) {
        console.log('[SystemConfig] Reactive event: Enabling stock alert cron worker...');
        cronService.start();
      } else {
        console.log('[SystemConfig] Reactive event: Stopping stock alert cron worker...');
        cronService.stop();
      }
    }
  });

  // Fetch initial live BCV rate in the background
  bcvService.fetchLiveRate().catch((err) => {
    console.warn('[BcvService] Fallback to default BCV rate:', err);
  });

  // Pre-warm barcode memory cache for sub-millisecond lookups
  const cachedCount = await productService.warmupCache();
  console.log(`[ProductService] In-memory cache warmed up with ${cachedCount} products.`);

  // Start 60-second background cron job for inventory stock evaluation (only if alerts module is active)
  cronService.start();

  // Start sales backfill to correct any historical rate assignments asynchronously on startup
  const salesRepo = new SalesRepository(prisma);
  salesRepo.backfillSalesBcvRates().catch((err) => {
    console.error('[Startup] Failed to run bcvRate backfill for sales:', err);
  });

  // Backfill products activation status (ensuring nulls are true)
  productRepo.backfillActiveStatus().then((count) => {
    if (count > 0) console.log(`[Startup] Backfilled isActive for ${count} existing products.`);
  }).catch((err) => {
    console.error('[Startup] Failed to backfill product status:', err);
  });

  const salesController = new SalesController(productService);
  const productController = new ProductController(productService);
  const alertController = new AlertController(cronService);
  const bcvController = new BcvController(bcvService);
  const shiftController = new ShiftController();
  const kardexController = new KardexController();
  const auditController = new AuditController();
  const dashboardController = new DashboardController();
  const comboController = new ComboController();
  const systemService = new SystemService(prisma);
  const systemController = new SystemController(systemService);

  // ==========================================
  // API ROUTES (Mounted before Vite middleware)
  // ==========================================

  // System Management
  app.post('/api/v1/system/purge', systemController.purgeAll);
  app.get('/api/v1/system/cloud-config', systemController.getCloudConfig);
  app.post('/api/v1/system/cloud-config', systemController.updateCloudConfig);

  // Authentication Routes
  app.use('/api/auth', authRoutes);

  // Control Tower Dashboard Endpoints (Native SQLite Aggregations)
  app.get('/api/v1/dashboard/stats', dashboardController.getStats);

  // Combos & Promotional Bundles Endpoints (Protected by combos module)
  app.get('/api/v1/combos', comboController.getAll);
  app.get('/api/v1/combos/:id', comboController.getById);
  app.post('/api/v1/combos', requireModule('combos'), comboController.upsert);
  app.put('/api/v1/combos/:id', requireModule('combos'), comboController.upsert);
  app.delete('/api/v1/combos/:id', requireModule('combos'), comboController.delete);

  // Physical Inventory Audits Endpoints (Protected by audits module optimization)
  app.use('/api/v1/audits', requireModule('audits'));
  app.get('/api/v1/audits', auditController.listAudits);
  app.get('/api/v1/audits/:id', auditController.getAudit);
  app.post('/api/v1/audits/start', auditController.startAudit);
  app.put('/api/v1/audits/:id/save-progress', auditController.saveProgress);
  app.post('/api/v1/audits/:id/close', auditController.closeAudit);
  app.post('/api/v1/audits/:id/cancel', auditController.cancelAudit);

  // Kardex & Audit Trail Endpoints (Protected by kardex module optimization)
  app.use('/api/v1/kardex', requireModule('kardex'));
  app.get('/api/v1/kardex', kardexController.getKardex);
  app.post('/api/v1/kardex/adjust', kardexController.adjustStock);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      engine: 'Bodegón POS High-Speed Engine',
      database: 'SQLite (WAL mode enabled)',
      timestamp: new Date().toISOString(),
    });
  });

  // Shifts & Arqueo de Caja Endpoints (Protected by shifts module optimization)
  app.use('/api/v1/shifts', requireModule('shifts'));
  app.get('/api/v1/shifts/active', shiftController.getActiveShift);
  app.post('/api/v1/shifts/open', shiftController.openShift);
  app.post('/api/v1/shifts/:id/close', shiftController.closeShift);
  app.post('/api/v1/shifts/:id/outflows', shiftController.createOutflow);
  app.get('/api/v1/shifts', shiftController.listShifts);
  app.get('/api/v1/shifts/:id/report', shiftController.getShiftReport);

  // BCV Official Live Exchange Rate, History, Schedules & Dynamic Scripts Endpoints
  app.get('/api/v1/bcv/rate', bcvController.getRate);
  app.post('/api/v1/bcv/sync', bcvController.syncRate);
  app.post('/api/v1/bcv/rate', bcvController.updateRate);
  app.post('/api/v1/bcv/manual', bcvController.updateRate);
  app.get('/api/v1/bcv/history', bcvController.getHistory);
  app.post('/api/v1/bcv/history', bcvController.addHistoryEntry);
  app.delete('/api/v1/bcv/history/:id', bcvController.deleteHistoryEntry);
  app.get('/api/v1/bcv/config', bcvController.getConfig);
  app.post('/api/v1/bcv/config', bcvController.updateConfig);
  app.get('/api/v1/bcv/schedules', bcvController.getSchedules);
  app.post('/api/v1/bcv/schedules', bcvController.createSchedule);
  app.put('/api/v1/bcv/schedules/:id', bcvController.updateSchedule);
  app.patch('/api/v1/bcv/schedules/:id/toggle', bcvController.toggleSchedule);
  app.delete('/api/v1/bcv/schedules/:id', bcvController.deleteSchedule);
  app.get('/api/v1/bcv/evaluate', bcvController.evaluateRate);

  // Product & Ultra-Fast Barcode Endpoints (Core)
  app.get('/api/v1/products', productController.getAll);
  app.post('/api/v1/products', productController.create);
  app.get('/api/v1/products/barcode/:barcode', productController.getByBarcode);
  app.patch('/api/v1/products/:id', productController.update);
  app.put('/api/v1/products/:id', productController.update);
  app.delete('/api/v1/products/:id', productController.deleteProduct);
  app.post('/api/v1/products/:id/restock', productController.restock);
  app.get('/api/v1/products/cache/stats', productController.getCacheStats);

  // Sales & Concurrency Endpoints
  app.post('/api/v1/sales', salesController.createSale);
  app.post('/api/v1/sales/cxc-payment', requireModule('cxc'), async (req, res, next) => {
    try {
      const { cashierName, paymentMethod, amountPaid, notes } = req.body;
      if (!paymentMethod) {
        return res.status(400).json({ success: false, error: 'Debe especificar un método de pago' });
      }
      const existingCount = await prisma.sale.count({ where: { invoiceNumber: { startsWith: 'ABO-' } } });
      const invoiceNumber = `ABO-${String(existingCount + 1).padStart(4, '0')}`;
      const sale = await prisma.sale.create({
        data: {
          invoiceNumber,
          cashierName: cashierName || 'Caja 1 - Principal',
          paymentMethod,
          subtotal: Number(amountPaid),
          tax: 0,
          total: Number(amountPaid),
          amountPaid: Number(amountPaid),
          changeDue: 0,
          notes: notes || '',
          status: 'COMPLETED'
        },
        include: {
          items: true
        }
      });
      res.status(201).json({
        success: true,
        message: 'Abono procesado exitosamente',
        data: sale
      });
    } catch (err) {
      next(err);
    }
  });

  // Recent Sales & History (Protected by sales module optimization)
  app.get('/api/v1/sales', requireModule('sales'), salesController.getRecentSales);
  app.get('/api/v1/sales/stats/summary', requireModule('sales'), salesController.getStats);
  app.get('/api/v1/sales/:id', requireModule('sales'), salesController.getSaleById);
  app.post('/api/v1/sales/:id/void', requireModule('sales'), salesController.voidSale);
  app.post('/api/v1/sales/test-concurrency', salesController.testConcurrency);

  // Restock Alerts & Cron Job Endpoints (Protected by alerts module optimization)
  app.use('/api/v1/alerts', requireModule('alerts'));
  app.use('/api/v1/cron', requireModule('alerts'));
  app.get('/api/v1/alerts', alertController.getActiveAlerts);
  app.post('/api/v1/cron/trigger', alertController.triggerCron);
  app.get('/api/v1/cron/status', alertController.getStatus);

  // System Configuration & Modular Optimization Endpoints
  app.get('/api/v1/system/config', (req, res) => {
    res.json({
      success: true,
      data: systemConfigService.getModulesStatus()
    });
  });

  // Pre-check verification before deactivating a module
  app.post('/api/v1/system/modules/pre-check', async (req, res, next) => {
    try {
      const { moduleId, context } = req.body;
      if (!moduleId) {
        return res.status(400).json({
          success: false,
          error: 'Debe especificar el moduleId a verificar.'
        });
      }
      const checkResult = await systemConfigService.canDisableModule(moduleId, context);
      res.json({
        success: true,
        data: checkResult
      });
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/v1/system/modules', async (req, res, next) => {
    try {
      const { enabledModules, context } = req.body;
      if (!Array.isArray(enabledModules)) {
        return res.status(400).json({
          success: false,
          error: 'enabledModules debe ser un arreglo de identificadores de módulos.'
        });
      }
      const updated = await systemConfigService.updateEnabledModules(enabledModules, context);
      res.json({
        success: true,
        message: 'Configuración modular del sistema actualizada exitosamente.',
        data: updated
      });
    } catch (err: any) {
      if (err.code === 'MODULE_HAS_PENDING_PROCESSES') {
        return res.status(400).json({
          success: false,
          error: err.message,
          code: err.code,
          details: err.details
        });
      }
      next(err);
    }
  });

  // Unit Test Runner API (Run tests directly from the UI!)
  app.post('/api/v1/tests/run', async (req, res, next) => {
    try {
      const results = await runAllUnitTests();
      res.json({
        success: true,
        data: results,
      });
    } catch (err) {
      next(err);
    }
  });

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  // 404 handler for all /api routes so they NEVER fall through to Vite SPA index.html
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `Ruta de API no encontrada: ${req.method} ${req.originalUrl}`,
    });
  });

  // ==========================================
  // Vite Middleware / Static Files
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Graceful shutdown
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[POS Engine] Bodegón POS Server running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = async () => {
    console.log('\n[POS Engine] Gracefully shutting down...');
    cronService.stop();
    await prisma.$disconnect();
    server.close(() => {
      console.log('[POS Engine] Server terminated.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('[POS Engine] Fatal server startup error:', err);
  process.exit(1);
});
