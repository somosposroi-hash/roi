import React, { useState } from 'react';
import { 
  Zap, 
  ShieldCheck, 
  AlertOctagon, 
  Play, 
  Cpu, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Clock,
  Layers
} from 'lucide-react';
import { Product, ConcurrencyTestResponse } from '../types';

interface ConcurrencySimulatorProps {
  products: Product[];
  onRefresh: () => void;
}

export const ConcurrencySimulator: React.FC<ConcurrencySimulatorProps> = ({
  products,
  onRefresh,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [concurrentCount, setConcurrentCount] = useState<number>(8);
  const [quantityPerRequest, setQuantityPerRequest] = useState<number>(1);
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<ConcurrencyTestResponse | null>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  const handleRunTest = async () => {
    if (!selectedProduct) return;
    setIsRunning(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/v1/sales/test-concurrency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          concurrentRequests: concurrentCount,
          quantityPerRequest,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult(data.data);
        onRefresh();
      } else {
        alert(data.error?.message || 'Error en test de concurrencia');
      }
    } catch {
      alert('Fallo de red al ejecutar test de concurrencia');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Educational Architecture Banner */}
      <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 text-blue-600">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Laboratorio de Concurrencia y Transacciones Atómicas ($transaction)
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              En un bodegón de alto flujo de ventas, múltiples terminales o cajas pueden intentar vender la última unidad al mismo microsegundo.
              Este laboratorio simula <strong className="text-blue-700">N peticiones HTTP simultáneas en paralelo</strong> usando{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-700 font-mono">Promise.all()</code> para demostrar cómo la transacción atómica de Prisma y SQLite WAL previene condiciones de carrera (Race Conditions) y sobreventas.
            </p>
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-600" />
          Configuración del Experimento de Carga Concurrente
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Product selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Producto Objetivo para el Test:
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock actual: {p.stock} {p.unit})
                </option>
              ))}
            </select>
            {selectedProduct && (
              <div className="text-[11px] text-slate-500 mt-1">
                Stock inicial: <span className="font-bold text-blue-700 font-mono">{selectedProduct.stock}</span> • Precio: ${selectedProduct.price}
              </div>
            )}
          </div>

          {/* Concurrent Requests Count */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Hilos / Peticiones Simultáneas en Paralelo:
            </label>
            <div className="flex gap-2">
              {[4, 8, 12, 20].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setConcurrentCount(count)}
                  className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-xl border transition-colors cursor-pointer ${
                    concurrentCount === count
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {count}x
                </button>
              ))}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Se dispararán {concurrentCount} solicitudes POST en el mismo milisegundo
            </div>
          </div>

          {/* Quantity per request */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Cantidad Solicitada por Hilo:
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={quantityPerRequest}
              onChange={(e) => setQuantityPerRequest(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              Demanda total simultánea: {concurrentCount * quantityPerRequest} unidades
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Mecanismo: <span className="text-blue-700 font-mono font-bold">prisma.$transaction(tx) + Decrement Atómico + Mutex de Cola</span>
          </div>

          <button
            id="btn-run-concurrency-test"
            type="button"
            onClick={handleRunTest}
            disabled={isRunning || !selectedProduct}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm shadow-blue-500/20 active:scale-95 disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Ejecutando {concurrentCount} Hilos en Paralelo...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Disparar {concurrentCount} Ventas Concurrentes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results View */}
      {testResult && (
        <div className="space-y-4 animate-fade-in">
          {/* Result Banner */}
          <div
            className={`p-5 rounded-2xl border flex items-center justify-between ${
              testResult.raceConditionDetected
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-3">
              {testResult.raceConditionDetected ? (
                <AlertOctagon className="w-8 h-8 text-rose-600 shrink-0" />
              ) : (
                <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
              )}
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  {testResult.raceConditionDetected
                    ? 'Inconsistencia Detectada'
                    : 'Consistencia Atómica Perfecta (0 Race Conditions)'}
                </h4>
                <p className="text-xs opacity-90 mt-0.5">{testResult.guaranteeNote}</p>
              </div>
            </div>

            <div className="text-right font-mono text-xs">
              <span className="text-slate-500 block">TIEMPO TOTAL:</span>
              <span className="text-lg font-bold text-slate-900">{testResult.durationMs} ms</span>
            </div>
          </div>

          {/* Metric Comparison Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-2xl text-center shadow-xs">
              <span className="text-xs text-slate-500 font-medium">Stock Inicial</span>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {testResult.initialStock}
              </div>
            </div>

            <div className="bg-white border border-emerald-200 p-4 rounded-2xl text-center shadow-xs bg-emerald-50/20">
              <span className="text-xs text-emerald-700 font-medium">Ventas Aprobadas</span>
              <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                {testResult.successful}
              </div>
            </div>

            <div className="bg-white border border-amber-200 p-4 rounded-2xl text-center shadow-xs bg-amber-50/20">
              <span className="text-xs text-amber-700 font-medium">Rechazadas (Stock 0)</span>
              <div className="text-2xl font-bold font-mono text-amber-700 mt-1">
                {testResult.failed}
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl text-center shadow-xs">
              <span className="text-xs text-slate-500 font-medium">Stock Final en BD</span>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {testResult.finalStock}
              </div>
            </div>
          </div>

          {/* Per-Thread Audit Log Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Auditoría de Hilos de Ejecución ({testResult.logs.length} solicitudes)</span>
              <span className="text-slate-500 font-mono">SQLite WAL Mode</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto font-mono text-xs">
              {testResult.logs.map((log) => (
                <div
                  key={log.attempt}
                  className="p-2.5 px-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">Hilo #{log.attempt}</span>
                    {log.success ? (
                      <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Venta Atómica Aprobada (201 Created)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-700">
                        <XCircle className="w-4 h-4 text-amber-600" /> 409 InsufficientStock (Transacción Abortada)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-slate-500">
                    <span className="text-[11px]">{log.timeMs} ms</span>
                    {log.error && (
                      <span className="text-[11px] text-slate-400 truncate max-w-xs" title={typeof log.error === 'string' ? log.error : JSON.stringify(log.error)}>
                        {typeof log.error === 'string' ? log.error : (log.error as any).message || (log.error as any).error || JSON.stringify(log.error)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
