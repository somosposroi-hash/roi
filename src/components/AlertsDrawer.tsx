import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  RotateCw, 
  Play, 
  CheckCircle2, 
  PackageCheck, 
  ArrowRight,
  ShieldAlert,
  Layers,
  Database
} from 'lucide-react';
import { RestockAlert } from '../types';
import { safeFetchJson } from '../utils/api';

interface AlertsDrawerProps {
  alerts: RestockAlert[];
  cronStatus: {
    isRunning: boolean;
    frequency: string;
    totalRuns: number;
    recentLogs: Array<{
      timestamp: string;
      durationMs: number;
      criticalCount: number;
      warningCount: number;
      resolvedCount: number;
    }>;
  } | null;
  onRefreshAlerts: () => void;
  onRefreshProducts: () => void;
}

export const AlertsDrawer: React.FC<AlertsDrawerProps> = ({
  alerts,
  cronStatus,
  onRefreshAlerts,
  onRefreshProducts,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);
  const [restockingId, setRestockingId] = useState<string | null>(null);

  // 60-second visual countdown synced with node-cron schedule
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 1 ? 60 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleTriggerNow = async () => {
    setIsTriggering(true);
    setTriggerResult(null);

    try {
      const result = await safeFetchJson<any>('/api/v1/cron/trigger', { method: 'POST' });

      if (result.ok && result.data) {
        setTriggerResult(
          `Evaluación ejecutada en ${result.data.durationMs}ms. Críticos: ${result.data.criticalCount}, Advertencias: ${result.data.warningCount}, Resueltos: ${result.data.resolvedCount}`
        );
        setSecondsRemaining(60);
        onRefreshAlerts();
        onRefreshProducts();
      } else {
        setTriggerResult(result.error || 'Error al forzar cron de evaluación');
      }
    } catch {
      setTriggerResult('Error al forzar cron de evaluación');
    } finally {
      setIsTriggering(false);
    }
  };

  const handleQuickRestock = async (productId: string, quantity = 20) => {
    setRestockingId(productId);
    try {
      const result = await safeFetchJson(`/api/v1/products/${productId}/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity,
          reason: 'Reabastecimiento rápido desde módulo de Alertas Cron',
        }),
      });

      if (result.ok) {
        onRefreshAlerts();
        onRefreshProducts();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('inventory-sync', { detail: { type: 'restock', productId, timestamp: Date.now() } }));
          try {
            localStorage.setItem('nubly_last_inventory_sync', Date.now().toString());
          } catch {}
        }
      }
    } catch {
      alert('Error al reabastecer');
    } finally {
      setRestockingId(null);
    }
  };

  const criticalAlerts = alerts.filter((a) => a.severity === 'CRITICAL');
  const warningAlerts = alerts.filter((a) => a.severity === 'WARNING');

  return (
    <div className="space-y-6">
      {/* Node-Cron Daemon Status Card - White Theme */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Módulo Interno de Tareas Programadas (node-cron cada 60s)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Monitoreo continuo de stock contra puntos de reorden en segundo plano dentro del servidor local
            </p>
          </div>

          <button
            type="button"
            onClick={handleTriggerNow}
            disabled={isTriggering}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm shadow-blue-500/20 active:scale-95 disabled:opacity-50"
          >
            {isTriggering ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Forzar Evaluación Ahora</span>
          </button>
        </div>

        {/* Cron Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <span className="text-slate-500 block mb-1">Próxima Evaluación:</span>
            <div className="font-mono font-bold text-blue-600 text-base flex items-center gap-1.5">
              <span>{secondsRemaining}s</span>
              <span className="text-[10px] text-slate-400 font-normal">regresivo</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <span className="text-slate-500 block mb-1">Frecuencia Cron:</span>
            <div className="font-mono font-bold text-slate-900 text-base">
              * * * * * <span className="text-[10px] text-slate-400 font-normal">(60 seg)</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <span className="text-slate-500 block mb-1">Total Evaluaciones:</span>
            <div className="font-mono font-bold text-slate-900 text-base">
              {cronStatus?.totalRuns ?? 1} corridas
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <span className="text-slate-500 block mb-1">Última Duración:</span>
            <div className="font-mono font-bold text-blue-600 text-base">
              {cronStatus?.recentLogs?.[0]?.durationMs ?? 0.8} ms
            </div>
          </div>
        </div>

        {triggerResult && (
          <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
            <span>{triggerResult}</span>
          </div>
        )}
      </div>

      {/* Active Alerts List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            Alertas de Reabastecimiento Activas ({alerts.length})
          </h3>
          <div className="flex gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
              {criticalAlerts.length} Críticos (Stock 0)
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-semibold">
              {warningAlerts.length} Advertencias (Bajo Mínimo)
            </span>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-xs">
            <PackageCheck className="w-12 h-12 mx-auto mb-3 text-emerald-600" />
            <h4 className="text-base font-bold text-slate-900">¡Inventario 100% Abastecido!</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              El evaluador por minuto verificó que todos los productos superan su stock mínimo de seguridad.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((alert) => {
              const isCritical = alert.severity === 'CRITICAL';
              const isRestocking = restockingId === alert.productId;

              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-2xl border shadow-xs transition-all ${
                    isCritical
                      ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                      : 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {isCritical ? (
                        <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {alert.product?.name || 'Producto'}
                        </h4>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          Código: {alert.product?.barcode} • SKU: {alert.product?.sku}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isCritical
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isCritical ? 'Agotado (0)' : 'Stock Bajo'}
                    </span>
                  </div>

                  {/* Stock Comparison Meter */}
                  <div className="mt-3 p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">STOCK ACTUAL:</span>
                      <span className={`font-mono font-bold text-base ${isCritical ? 'text-rose-600' : 'text-amber-600'}`}>
                        {alert.currentStock} unidades
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-400" />

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">STOCK MÍNIMO:</span>
                      <span className="font-mono font-bold text-slate-700 text-base">
                        {alert.minStock} unidades
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">DÉFICIT:</span>
                      <span className="font-mono font-bold text-rose-600 text-base">
                        -{Math.max(0, alert.minStock - alert.currentStock)}
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="mt-3 flex items-center justify-between gap-3 pt-1">
                    <span className="text-[11px] text-slate-500">
                      Detectado: {new Date(alert.evaluatedAt).toLocaleTimeString()}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleQuickRestock(alert.productId, 20)}
                      disabled={isRestocking}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-sm shadow-blue-500/20"
                    >
                      {isRestocking ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <PackageCheck className="w-3.5 h-3.5" />
                      )}
                      <span>+20 Reabastecer</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cron Execution History Log */}
      {cronStatus?.recentLogs && cronStatus.recentLogs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Historial de Ejecución del Evaluador (Últimas evaluaciones)
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto font-mono text-xs">
            {cronStatus.recentLogs.slice(0, 5).map((log, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span className="font-semibold">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className="text-slate-400">({log.durationMs}ms)</span>
                </div>
                <div className="flex gap-3 text-[11px] font-semibold">
                  <span className="text-rose-600">{log.criticalCount} críticos</span>
                  <span className="text-amber-600">{log.warningCount} bajo stock</span>
                  <span className="text-emerald-700">{log.resolvedCount} resueltos</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
