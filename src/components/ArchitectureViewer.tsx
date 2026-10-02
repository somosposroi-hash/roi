import React, { useState } from 'react';
import { 
  FolderTree, 
  FileCode, 
  CheckCircle2, 
  Play, 
  Layers, 
  Database, 
  Terminal, 
  Shield, 
  RotateCw, 
  Code2
} from 'lucide-react';
import { UnitTestResult } from '../types';

export const ArchitectureViewer: React.FC = () => {
  const [activeCodeTab, setActiveCodeTab] = useState<'schema' | 'controller' | 'service' | 'cron'>('schema');
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testSuites, setTestSuites] = useState<UnitTestResult[] | null>(null);
  const [testSummary, setTestSummary] = useState<{ total: number; passed: number; durationMs: number } | null>(null);

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/v1/tests/run', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestSuites(data.data.suites);
        setTestSummary({
          total: data.data.totalTests,
          passed: data.data.totalPassed,
          durationMs: data.data.durationMs,
        });
      }
    } catch {
      alert('Error ejecutando suite de pruebas unitarias');
    } finally {
      setIsRunningTests(false);
    }
  };

  const schemaPrismaSnippet = `// prisma/schema.prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Product {
  id             String          @id @default(cuid())
  barcode        String          @unique // Búsqueda sub-milisegundo indexada
  sku            String          @unique
  name           String
  category       String
  price          Float
  cost           Float
  stock          Int             // Protegido por $transaction
  minStock       Int             @default(5)
  unit           String          @default("UND")
  imageUrl       String?         // Foto opcional del producto
  isActive       Boolean         @default(true)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  saleItems      SaleItem[]
  stockMovements StockMovement[]
  restockAlerts  RestockAlert[]

  @@index([barcode])
  @@index([stock, minStock])
}

model Sale {
  id             String          @id @default(cuid())
  invoiceNumber  String          @unique
  cashierName    String          @default("Caja 1")
  paymentMethod  String          // CASH_USD, CASH_BS, DEBIT_CARD, PAGO_MOVIL
  subtotal       Float
  tax            Float           // IVA 16%
  total          Float
  amountPaid     Float
  changeDue      Float           @default(0)
  status         String          @default("COMPLETED")
  createdAt      DateTime        @default(now())

  items          SaleItem[]
  stockMovements StockMovement[]
}

model SaleItem {
  id             String   @id @default(cuid())
  saleId         String
  sale           Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  productId      String
  product        Product  @relation(fields: [productId], references: [id])
  productName    String
  productBarcode String
  unitPrice      Float
  quantity       Int
  subtotal       Float
}`;

  const salesControllerSnippet = `// server/controllers/sales.controller.ts
export class SalesController {
  constructor(private readonly productService: ProductService) {}

  createSale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { cashierName, paymentMethod, amountPaid, items, notes } = req.body;
      
      // Validación estricta DTO
      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new AppError('El ticket de venta debe contener al menos un producto', 400);
      }

      // Ejecución atómica delegada al servicio
      const sale = await this.productService.executeSaleTransaction({
        cashierName,
        paymentMethod,
        amountPaid: Number(amountPaid),
        items,
        notes,
      });

      res.status(201).json({
        success: true,
        data: sale,
        meta: {
          timestamp: new Date().toISOString(),
          engine: 'Bodegón POS High-Speed Engine',
          isolationLevel: 'SERIALIZABLE via Prisma $transaction',
        },
      });
    } catch (error) {
      next(error);
    }
  };
}`;

  const salesServiceSnippet = `// server/services/product.service.ts
export class ProductService {
  /**
   * REQUERIMIENTO #1: Concurrencia e Inventario.
   * Ejecutado dentro de prisma.$transaction para garantizar atomicidad estricta y evitar race conditions.
   */
  async executeSaleTransaction(dto: CreateSaleDto): Promise<SaleWithItems> {
    return await this.prisma.$transaction(
      async (tx) => {
        // 1. Verificar stock actual dentro del contexto transaccional
        for (const item of dto.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new AppError(\`Producto con ID \${item.productId} no encontrado\`, 404);
          }

          if (product.stock < item.quantity) {
            throw new InsufficientStockError(product.name, product.stock, item.quantity);
          }

          // 2. Descuento atómico de inventario
          await tx.product.update({
            where: { id: product.id },
            data: {
              stock: { decrement: item.quantity },
            },
          });
        }

        // 3. Crear registro maestro de Venta
        const sale = await tx.sale.create({
          data: { ... },
          include: { items: true },
        });

        return sale;
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );
  }
}`;

  const cronServiceSnippet = `// server/services/cron.service.ts
import cron from 'node-cron';

export class CronService {
  /**
   * REQUERIMIENTO #2: Tareas por Minuto (Cron Job Local) con node-cron.
   * Evalúa cada 60 segundos el stock contra el stock mínimo de reabastecimiento.
   */
  start(): void {
    // Expresión '* * * * *' = Cada 60 segundos
    this.cronTask = cron.schedule('* * * * *', async () => {
      await this.evaluateStockLevels();
    });
    console.log('[CronService] Tarea local inicializada (cada 60 segundos)');
  }
}`;

  return (
    <div className="space-y-6">
      {/* Top Architecture Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Arquitectura del Sistema POS & Suite de Pruebas Unitarias
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Clean Architecture (Domain, Repositories, Services, Controllers) + SQLite WAL Mode + node-cron + In-Memory Fast Cache
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunTests}
            disabled={isRunningTests}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm shadow-blue-500/20 active:scale-95 disabled:opacity-50"
          >
            {isRunningTests ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Ejecutar Tests de Servidor</span>
          </button>
        </div>

        {/* System Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-xs">
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1">
            <span className="text-slate-400 uppercase font-bold text-[10px]">1. Concurrencia e Inventario</span>
            <div className="font-bold text-slate-900 text-sm">Prisma $transaction Atómico</div>
            <p className="text-slate-500 text-[11px]">
              Decremento atómico de stock. Previene race conditions y ventas sobre stock 0.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1">
            <span className="text-slate-400 uppercase font-bold text-[10px]">2. Cron Job Local (60s)</span>
            <div className="font-bold text-slate-900 text-sm">node-cron en Background</div>
            <p className="text-slate-500 text-[11px]">
              Evaluador por minuto que genera alertas de reabastecimiento automáticamente.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1">
            <span className="text-slate-400 uppercase font-bold text-[10px]">3. Optimización Barcode</span>
            <div className="font-bold text-slate-900 text-sm">Búsqueda RAM &lt; 0.5 ms</div>
            <p className="text-slate-500 text-[11px]">
              Caché en memoria sincronizado + índices B-Tree en SQLite WAL.
            </p>
          </div>
        </div>
      </div>

      {/* Unit Test Results Banner (If run) */}
      {testSummary && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Resultados de la Suite de Pruebas Unitarias ({testSummary.passed}/{testSummary.total} Pasadas)
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Duración: {testSummary.durationMs} ms
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {testSuites?.map((suite, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2">
                <div className="font-bold text-slate-900 flex justify-between">
                  <span>{suite.suite}</span>
                  <span className="text-emerald-700 font-mono font-semibold">{suite.passed}/{suite.results.length} OK</span>
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  {suite.results.map((t, tIdx) => (
                    <div key={tIdx} className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {t.name}
                      </span>
                      <span className="text-slate-400">{t.durationMs}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Folder Structure Tree (Left) & Code Viewer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Folder Structure Tree (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs font-mono text-xs text-slate-700">
          <div className="flex items-center gap-2 text-slate-700 font-bold uppercase text-[11px] pb-3 border-b border-slate-100 mb-3">
            <FolderTree className="w-4 h-4 text-blue-600" />
            Estructura de Carpetas Clean Architecture
          </div>

          <div className="space-y-1 text-[11px] leading-relaxed">
            <div className="text-blue-700 font-bold">📁 prisma/</div>
            <div className="pl-4 text-slate-700">📄 schema.prisma</div>
            <div className="pl-4 text-slate-500">📄 seed.ts</div>
            <div className="pl-4 text-slate-400">🗄️ dev.db (SQLite WAL)</div>

            <div className="text-blue-700 font-bold pt-2">📁 server/</div>
            <div className="pl-4 text-amber-700 font-semibold">📁 config/</div>
            <div className="pl-8 text-slate-600">database.ts (Pragmas WAL)</div>
            <div className="pl-8 text-slate-600">env.ts</div>

            <div className="pl-4 text-amber-700 font-semibold pt-1">📁 domain/</div>
            <div className="pl-8 text-slate-600">entities/types.ts</div>
            <div className="pl-8 text-slate-600">errors/app-error.ts</div>
            <div className="pl-8 text-slate-600">errors/insufficient-stock.error.ts</div>

            <div className="pl-4 text-amber-700 font-semibold pt-1">📁 repositories/</div>
            <div className="pl-8 text-slate-600">sales.repository.ts</div>
            <div className="pl-8 text-slate-600">product.repository.ts</div>
            <div className="pl-8 text-slate-600">alert.repository.ts</div>

            <div className="pl-4 text-amber-700 font-semibold pt-1">📁 services/</div>
            <div className="pl-8 text-blue-700 font-medium">sales.service.ts ($transaction)</div>
            <div className="pl-8 text-blue-700 font-medium">product.service.ts (Cache &lt;1ms)</div>
            <div className="pl-8 text-blue-700 font-medium">cron.service.ts (node-cron 60s)</div>

            <div className="pl-4 text-amber-700 font-semibold pt-1">📁 controllers/</div>
            <div className="pl-8 text-slate-700">sales.controller.ts</div>
            <div className="pl-8 text-slate-700">product.controller.ts</div>
            <div className="pl-8 text-slate-700">alert.controller.ts</div>

            <div className="pl-4 text-amber-700 font-semibold pt-1">📁 middlewares/</div>
            <div className="pl-8 text-slate-600">error.middleware.ts</div>
            <div className="pl-8 text-slate-600">timing.middleware.ts</div>

            <div className="pl-4 text-amber-700 font-semibold pt-1">📁 tests/</div>
            <div className="pl-8 text-emerald-700 font-medium">sales.service.spec.ts</div>
            <div className="pl-8 text-emerald-700 font-medium">barcode.spec.ts</div>
            <div className="pl-8 text-slate-600">run-tests.ts</div>

            <div className="text-slate-800 font-bold pt-2">📄 server.ts</div>
            <div className="text-slate-600">📄 package.json</div>
          </div>
        </div>

        {/* Right: Code Viewer (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          {/* Tabs */}
          <div className="bg-slate-50 border-b border-slate-200 p-2 flex gap-2 overflow-x-auto">
            {[
              { id: 'schema', label: 'schema.prisma', icon: Database },
              { id: 'controller', label: 'sales.controller.ts', icon: Code2 },
              { id: 'service', label: 'sales.service.ts ($transaction)', icon: Shield },
              { id: 'cron', label: 'cron.service.ts (node-cron)', icon: Terminal },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCodeTab(tab.id as typeof activeCodeTab)}
                  className={`text-xs px-3 py-1.5 rounded-xl border font-mono flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    activeCodeTab === tab.id
                      ? 'bg-blue-600 border-blue-600 text-white font-semibold shadow-xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Code Body */}
          <div className="p-4 bg-slate-900 font-mono text-xs text-slate-200 overflow-x-auto max-h-[500px]">
            <pre className="leading-relaxed">
              {activeCodeTab === 'schema' && schemaPrismaSnippet}
              {activeCodeTab === 'controller' && salesControllerSnippet}
              {activeCodeTab === 'service' && salesServiceSnippet}
              {activeCodeTab === 'cron' && cronServiceSnippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
