import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  Calendar,
  Globe,
  Edit3,
  ShieldCheck,
  Clock,
  Zap,
  ArrowRight,
  Sliders
} from 'lucide-react';
import { BcvRateInfo } from '../types';

interface BcvRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  bcvData: BcvRateInfo | null;
  onSyncLiveRate: () => Promise<void>;
  onUpdateManualRate: (newRate: number) => Promise<void>;
  onSelectActiveCurrency?: (currency: 'USD' | 'EUR' | 'USDT' | 'SCHEDULED' | 'CUSTOM') => Promise<void>;
  isSyncing: boolean;
  onOpenRateHistory?: () => void;
  onOpenScheduleConfig?: () => void;
}

export const BcvRateModal: React.FC<BcvRateModalProps> = ({
  isOpen,
  onClose,
  bcvData,
  onSyncLiveRate,
  onUpdateManualRate,
  onSelectActiveCurrency,
  isSyncing,
  onOpenRateHistory,
  onOpenScheduleConfig,
}) => {
  const [manualRateInput, setManualRateInput] = useState(bcvData?.usdRate ? bcvData.usdRate.toString() : '');
  const [isEditingManual, setIsEditingManual] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [isChangingMode, setIsChangingMode] = useState(false);

  if (!isOpen) return null;

  const currentUsdRate = bcvData?.usdRate || 849.56;
  const currentEurRate = bcvData?.eurRate || Math.round(currentUsdRate * 1.092 * 100) / 100;
  const currentUsdtRate = bcvData?.usdtRate || Math.round(currentUsdRate * 1.045 * 100) / 100;
  const activeMode = bcvData?.activeCurrency || 'USD';
  const effectiveRate = bcvData?.effectiveRate || currentUsdRate;

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(manualRateInput);
    if (!val || isNaN(val) || val <= 0) {
      setFeedbackMsg('Por favor ingrese una tasa válida mayor a 0');
      return;
    }

    try {
      await onUpdateManualRate(val);
      setFeedbackMsg(`Tasa cambiaria fijada en Bs. ${val.toFixed(2)} exitosamente`);
      setIsEditingManual(false);
    } catch {
      setFeedbackMsg('Error guardando la tasa manual');
    }
  };

  const handleSyncFromApi = async () => {
    setFeedbackMsg(null);
    try {
      await onSyncLiveRate();
      setFeedbackMsg('Tasas oficiales (USD, EUR, USDT) sincronizadas en tiempo real desde la API Base44');
    } catch {
      setFeedbackMsg('Error al sincronizar con la API externa');
    }
  };

  const handleChangeCurrencyMode = async (mode: 'USD' | 'EUR' | 'USDT' | 'SCHEDULED' | 'CUSTOM') => {
    if (!onSelectActiveCurrency) return;
    setIsChangingMode(true);
    setFeedbackMsg(null);
    try {
      await onSelectActiveCurrency(mode);
      const labels: Record<string, string> = {
        USD: 'Dólar Oficial BCV fijado como tasa activa en ventas y POS',
        EUR: 'Euro Oficial fijado como tasa activa en ventas y POS',
        USDT: 'USDT Paralelo fijado como tasa activa en ventas y POS',
        SCHEDULED: 'Modo Programador por Horario activado: la tasa cambiará automáticamente según el cronograma (ej. 09:00 a 10:00 Euro, luego BCV)',
        CUSTOM: 'Tasa personalizada fijada',
      };
      setFeedbackMsg(labels[mode] || 'Moneda activa actualizada');
    } catch {
      setFeedbackMsg('Error al cambiar la moneda activa');
    } finally {
      setIsChangingMode(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Centro de Tasas Cambiarias y Horarios
            </h3>
            <p className="text-xs text-slate-500">
              Banco Central de Venezuela • Multimoneda • Automatización
            </p>
          </div>
        </div>

        {/* Active Currency Selector Tabs */}
        <div className="mt-4">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Seleccionar Tasa Activa para Ventas y Cobros:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => handleChangeCurrencyMode('USD')}
              disabled={isChangingMode}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                activeMode === 'USD'
                  ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <div className="flex items-center gap-1">
                <span>Dólar BCV</span>
                <span className="text-[10px] font-mono px-1 py-0.2 bg-blue-100 text-blue-700 rounded">$</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 font-normal">
                Bs. {currentUsdRate.toFixed(2)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleChangeCurrencyMode('EUR')}
              disabled={isChangingMode}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                activeMode === 'EUR'
                  ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <div className="flex items-center gap-1">
                <span>Euro Oficial</span>
                <span className="text-[10px] font-mono px-1 py-0.2 bg-indigo-100 text-indigo-700 rounded">€</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 font-normal">
                Bs. {currentEurRate.toFixed(2)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleChangeCurrencyMode('USDT')}
              disabled={isChangingMode}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                activeMode === 'USDT'
                  ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <div className="flex items-center gap-1">
                <span>USDT Cripto</span>
                <span className="text-[10px] font-mono px-1 py-0.2 bg-emerald-100 text-emerald-700 rounded">₮</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 font-normal">
                Bs. {currentUsdtRate.toFixed(2)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleChangeCurrencyMode('SCHEDULED')}
              disabled={isChangingMode}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                activeMode === 'SCHEDULED'
                  ? 'bg-amber-500 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
              }`}
            >
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-300 animate-bounce" />
                <span>Horarios</span>
              </div>
              <span className={`text-[10px] font-normal ${activeMode === 'SCHEDULED' ? 'text-amber-100' : 'text-slate-500'}`}>
                Auto Script
              </span>
            </button>
          </div>
        </div>

        {/* Current Active Rate Spotlight Card */}
        <div className={`mt-3 border rounded-xl p-4 text-center space-y-1 relative overflow-hidden ${
          activeMode === 'SCHEDULED'
            ? 'bg-gradient-to-br from-amber-50 via-orange-50 to-white border-amber-300'
            : activeMode === 'EUR'
            ? 'bg-gradient-to-br from-indigo-50/80 via-blue-50/50 to-white border-indigo-200'
            : activeMode === 'USDT'
            ? 'bg-gradient-to-br from-emerald-50/80 via-teal-50/50 to-white border-emerald-200'
            : 'bg-gradient-to-br from-blue-50/80 via-slate-50 to-white border-blue-200'
        }`}>
          {activeMode === 'SCHEDULED' && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider mb-1">
              <Zap className="w-3 h-3" />
              <span>Ejecución Dinámica por Script</span>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Tasa Activa en Sistema ({
                activeMode === 'SCHEDULED'
                  ? (bcvData?.activeScheduleName || 'Script Horario Activo')
                  : activeMode === 'EUR'
                  ? 'Euro Oficial BCV (€)'
                  : activeMode === 'USDT'
                  ? 'USDT Paralelo (₮)'
                  : 'Dólar Oficial BCV ($)'
              }):
            </span>
          </div>

          <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900">
            Bs. {effectiveRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>

          <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5 pt-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{bcvData?.dateLabel || 'Oficial BCV'}</span>
            <span className="text-slate-300">•</span>
            <Clock className="w-3.5 h-3.5" />
            <span>{bcvData?.lastUpdated ? new Date(bcvData.lastUpdated).toLocaleTimeString() : 'Hoy'}</span>
          </div>
        </div>

        {/* Multi-rate Cards Overview */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className={`p-2.5 rounded-xl border text-center transition-all ${
            activeMode === 'USD' ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400/20' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className="text-slate-500 font-semibold block text-[10px]">Dólar BCV ($)</span>
            <span className="font-mono font-bold text-slate-900 block mt-0.5">Bs. {currentUsdRate.toFixed(2)}</span>
            {activeMode === 'USD' && <span className="text-[9px] text-blue-600 font-bold block mt-0.5">✓ Activa</span>}
          </div>

          <div className={`p-2.5 rounded-xl border text-center transition-all ${
            activeMode === 'EUR' ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-400/20' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className="text-slate-500 font-semibold block text-[10px]">Euro BCV (€)</span>
            <span className="font-mono font-bold text-slate-900 block mt-0.5">Bs. {currentEurRate.toFixed(2)}</span>
            {activeMode === 'EUR' && <span className="text-[9px] text-indigo-600 font-bold block mt-0.5">✓ Activa</span>}
          </div>

          <div className={`p-2.5 rounded-xl border text-center transition-all ${
            activeMode === 'USDT' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/20' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className="text-slate-500 font-semibold block text-[10px]">USDT Cripto (₮)</span>
            <span className="font-mono font-bold text-slate-900 block mt-0.5">Bs. {currentUsdtRate.toFixed(2)}</span>
            {activeMode === 'USDT' && <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">✓ Activa</span>}
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-2.5 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 space-y-2">
          {/* Sync Button */}
          <button
            type="button"
            onClick={handleSyncFromApi}
            disabled={isSyncing}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Consultando API Base44...' : 'Sincronizar en Vivo desde API Base44'}</span>
          </button>

          {/* Schedule Config Shortcut Button */}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenScheduleConfig) onOpenScheduleConfig();
              else if (onOpenRateHistory) onOpenRateHistory();
            }}
            className="w-full py-2 px-4 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Configurar Scripts y Horarios de Tasas</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
          </button>

          {/* Toggle Manual Edit */}
          {!isEditingManual ? (
            <button
              type="button"
              onClick={() => {
                setIsEditingManual(true);
                setManualRateInput(currentUsdRate.toString());
              }}
              className="w-full py-2 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Ajustar Tasa Manualmente</span>
            </button>
          ) : (
            <form onSubmit={handleSaveManual} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-fade-in">
              <label htmlFor="input-modal-manual-bcv" className="text-xs font-bold text-slate-700 block">
                Fijar Tasa Manual (Bs. por USD):
              </label>
              <div className="flex gap-2">
                <input
                  id="input-modal-manual-bcv"
                  type="number"
                  step="0.01"
                  required
                  value={manualRateInput}
                  onChange={(e) => setManualRateInput(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 focus:border-blue-600 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingManual(false)}
                  className="px-2 py-1.5 text-slate-500 hover:text-slate-700 text-xs rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {onOpenRateHistory && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRateHistory();
              }}
              className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              <span>Ver Historial Diario Completo</span>
            </button>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <span>Fuente: {bcvData?.source || 'simuladordeprecios.base44.app'}</span>
          <span>Detección automática: Activa</span>
        </div>
      </div>
    </div>
  );
};
