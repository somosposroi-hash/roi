import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Database, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  RefreshCw,
  Zap,
  Boxes,
  Bell,
  Coins,
  Receipt,
  ClipboardCheck,
  FileSpreadsheet,
  History,
  Contact,
  ShoppingCart,
  Package,
  Settings,
  Flame,
  Check,
  AlertTriangle,
  X,
  Gift,
  Wine,
  Tag
} from 'lucide-react';
import { 
  CORE_MODULE_IDS, 
  OPTIONAL_MODULE_IDS, 
  SYSTEM_MODULES_CATALOG,
  getLocalEnabledModules,
  saveSystemModulesToBackend,
  syncSystemModules,
  checkCanDisableModule,
  OptionalModuleId
} from '../utils/systemModules';
import { getClientsList, getPOSConfig, savePOSConfig } from '../utils/configHelper';
import { getSuppliersList } from '../utils/cxpHelper';

interface SystemModulesConfigProps {
  onModulesSaved?: (newModules: string[]) => void;
}

export function SystemModulesConfig({ onModulesSaved }: SystemModulesConfigProps) {
  const [enabledModules, setEnabledModules] = useState<string[]>(getLocalEnabledModules);
  const [posConfig, setPosConfig] = useState(() => getPOSConfig());
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string; details?: any } | null>(null);
  const [isChecking, setIsChecking] = useState<string | null>(null);
  const [blockedModuleWarning, setBlockedModuleWarning] = useState<{ moduleId: string; reason: string; details?: any } | null>(null);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (Array.isArray(detail)) {
        // Deep equality check to prevent infinite loops
        setEnabledModules(prev => {
          const isSame = prev.length === detail.length && prev.every(m => detail.includes(m));
          return isSame ? prev : [...detail];
        });
      }
    };
    window.addEventListener('system-modules-updated', handleUpdate);
    
    // We don't call syncSystemModules here because App.tsx already does it on mount
    // and this component reacts to the event if App.tsx updates it.

    return () => {
      window.removeEventListener('system-modules-updated', handleUpdate);
    };
  }, []);

  const handleToggle = async (moduleId: string) => {
    if (CORE_MODULE_IDS.includes(moduleId as any)) {
      return; // Core modules are immutable
    }

    const isCurrentlyEnabled = enabledModules.includes(moduleId);

    // If trying to turn OFF an active module, run pre-check validation first!
    if (isCurrentlyEnabled) {
      setIsChecking(moduleId);
      try {
        const clients = getClientsList();
        const suppliers = getSuppliersList();
        const checkResult = await checkCanDisableModule(moduleId, { clients, suppliers });

        if (!checkResult.canDisable) {
          setBlockedModuleWarning({
            moduleId,
            reason: checkResult.reason || 'No se puede desactivar el módulo debido a procesos pendientes.',
            details: checkResult.details
          });
          setIsChecking(null);
          return;
        }
      } catch (e) {
        console.warn('Pre-check error:', e);
      } finally {
        setIsChecking(null);
      }

      // Safe to disable
      const nextModules = enabledModules.filter(m => m !== moduleId);
      setEnabledModules(nextModules);
      localStorage.setItem('bodegon_enabled_modules', JSON.stringify(nextModules));
      window.dispatchEvent(new CustomEvent('system-modules-updated', { detail: nextModules }));
    } else {
      // Enabling is always allowed
      const nextModules = Array.from(new Set([...enabledModules, moduleId]));
      setEnabledModules(nextModules);
      localStorage.setItem('bodegon_enabled_modules', JSON.stringify(nextModules));
      window.dispatchEvent(new CustomEvent('system-modules-updated', { detail: nextModules }));
    }
  };

  const handleSelectAll = () => {
    const all = [...CORE_MODULE_IDS, ...OPTIONAL_MODULE_IDS];
    setEnabledModules(all);
    localStorage.setItem('bodegon_enabled_modules', JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('system-modules-updated', { detail: all }));
  };

  const handleSelectMinimal = () => {
    // Only core modules
    const minimal = [...CORE_MODULE_IDS];
    setEnabledModules(minimal);
    localStorage.setItem('bodegon_enabled_modules', JSON.stringify(minimal));
    window.dispatchEvent(new CustomEvent('system-modules-updated', { detail: minimal }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    setBlockedModuleWarning(null);

    try {
      const clients = getClientsList();
      const suppliers = getSuppliersList();

      const result = await saveSystemModulesToBackend(enabledModules, { clients, suppliers });

      if (result.success) {
        setFeedback({
          type: 'success',
          message: '¡Configuración modular guardada exitosamente! Las tablas históricas se mantienen 100% intactas y los procesos inactivos han sido optimizados.'
        });
        if (onModulesSaved) {
          onModulesSaved(enabledModules);
        }
      } else {
        setFeedback({
          type: 'error',
          message: result.error || 'No se pudo guardar la configuración modular en el servidor.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error inesperado al guardar la configuración.'
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        setFeedback(prev => (prev?.type === 'success' ? null : prev));
      }, 7000);
    }
  };

  const activeOptionalCount = enabledModules.filter(m => OPTIONAL_MODULE_IDS.includes(m as any)).length;
  const totalOptionalCount = OPTIONAL_MODULE_IDS.length;
  const disabledOptionalCount = totalOptionalCount - activeOptionalCount;
  const estimatedResourceSavings = Math.round((disabledOptionalCount / totalOptionalCount) * 100);

  const getModuleIcon = (id: string) => {
    switch (id) {
      case 'auth': return ShieldCheck;
      case 'pos': return ShoppingCart;
      case 'inventory': return Package;
      case 'config': return Settings;
      case 'combos': return Gift;
      case 'cxc': return Coins;
      case 'cxp': return Receipt;
      case 'audits': return ClipboardCheck;
      case 'alerts': return Bell;
      case 'clients': return Contact;
      case 'kardex': return FileSpreadsheet;
      case 'shifts': return Coins;
      case 'sales': return History;
      case 'envases': return Wine;
      case 'open_price': return Tag;
      default: return Boxes;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3 h-3 text-blue-400 animate-pulse" />
                <span>Zero-Resource Overhead Engine</span>
              </div>
              <div className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3 h-3 text-emerald-400" />
                <span>Integridad Histórica Preservada</span>
              </div>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">
              Arquitectura Modular & Control de Recursos
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Personalice su experiencia desactivando módulos que su negocio no utilice. Los módulos inactivos entran en <span className="text-blue-300 font-semibold">Modo Solo Lectura</span> para reportes y liberan memoria RAM, sockets, workers en segundo plano y transacciones en disco <span className="text-emerald-300 font-semibold">sin borrar ningún dato histórico ni romper claves foráneas</span>.
            </p>
          </div>

          {/* Quick Metrics & Preset Action */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
            <div className="text-left sm:text-right">
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Ahorro de Carga Estimado</div>
              <div className="text-2xl font-black text-emerald-400 flex items-center sm:justify-end gap-1">
                <span>{estimatedResourceSavings}%</span>
                <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                Activar Todos
              </button>
              <button
                type="button"
                onClick={handleSelectMinimal}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
              >
                Solo Núcleo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Blocked Module Pre-check Alert Dialog */}
      {blockedModuleWarning && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 shadow-sm flex items-start gap-4 animate-in fade-in duration-200">
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-amber-950 flex items-center gap-2">
                <span>Desactivación Bloqueada por Pre-Check de Seguridad</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold">
                  Proceso Pendiente
                </span>
              </h4>
              <button
                type="button"
                onClick={() => setBlockedModuleWarning(null)}
                className="p-1 rounded-lg text-amber-700 hover:bg-amber-200/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed font-medium">
              {blockedModuleWarning.reason}
            </p>
            <div className="text-[11px] text-amber-800 bg-amber-100/60 p-2.5 rounded-lg border border-amber-200">
              💡 <strong>Regla de Integridad de Datos:</strong> Para proteger el arqueo financiero y no dejar transacciones a medias, complete, concilie o cierre los procesos pendientes antes de apagar este módulo.
            </div>
          </div>
        </div>
      )}

      {/* Feedback Alerts */}
      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-semibold ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="flex-1">{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded hover:bg-black/5 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECCIÓN 1: FUNCIONES NÚCLEO / OBLIGATORIAS (PROTEGIDAS) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Funciones Núcleo / Obligatorias</h3>
              <p className="text-[11px] text-slate-500">Son la base del sistema. No se pueden desactivar ni eliminar para garantizar la operatividad de cobro.</p>
            </div>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" /> Siempre Activo
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {CORE_MODULE_IDS.map(moduleId => {
            const def = SYSTEM_MODULES_CATALOG[moduleId];
            const Icon = getModuleIcon(moduleId);
            return (
              <div 
                key={moduleId}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start gap-3 relative overflow-hidden"
              >
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 shrink-0 shadow-xs">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0 pr-12">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900">{def?.name || moduleId}</h4>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                      Núcleo
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    {def?.description}
                  </p>
                  <div className="text-[10px] text-emerald-700 font-medium mt-1.5 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{def?.resourceImpact}</span>
                  </div>
                </div>

                {/* Permanent Active Switch Display */}
                <div className="absolute top-4 right-4">
                  <div 
                    title="Función núcleo protegida: no se puede desactivar"
                    className="w-11 h-6 bg-emerald-500 rounded-full p-0.5 flex items-center justify-end cursor-not-allowed opacity-90 shadow-inner"
                  >
                    <div className="w-5 h-5 bg-white rounded-full shadow-xs flex items-center justify-center">
                      <Lock className="w-2.5 h-2.5 text-emerald-600" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECCIÓN 2: MÓDULOS OPCIONALES Y OPTIMIZACIÓN DE RECURSOS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Módulos Opcionales Adaptables</h3>
              <p className="text-[11px] text-slate-500">
                Active o desactive según el flujo operativo de su negocio para ahorrar memoria RAM, ciclos de CPU y peticiones SQLite.
              </p>
            </div>
          </div>
          
          <div className="text-[11px] font-semibold text-slate-500">
            {activeOptionalCount} activos / {disabledOptionalCount} desactivados
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OPTIONAL_MODULE_IDS.map(moduleId => {
            const def = SYSTEM_MODULES_CATALOG[moduleId];
            const isEnabled = enabledModules.includes(moduleId);
            const Icon = getModuleIcon(moduleId);
            const isCheckingThis = isChecking === moduleId;

            return (
              <div 
                key={moduleId}
                onClick={() => handleToggle(moduleId)}
                className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3.5 relative ${
                  isEnabled 
                    ? 'border-blue-200 bg-blue-50/20 hover:border-blue-300 hover:bg-blue-50/40 shadow-xs' 
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 opacity-75'
                }`}
              >
                <div className={`p-2.5 rounded-xl border shrink-0 transition-colors ${
                  isEnabled 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                    : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0 pr-14">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-xs font-bold ${isEnabled ? 'text-slate-900' : 'text-slate-600'}`}>
                      {def?.name || moduleId}
                    </h4>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      isEnabled 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {isEnabled ? 'Activo' : 'Desactivado (Solo Lectura)'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    {def?.description}
                  </p>

                  <div className={`text-[10px] font-medium mt-2 flex items-center gap-1 ${
                    isEnabled ? 'text-blue-700' : 'text-amber-600 font-semibold'
                  }`}>
                    <Zap className="w-3 h-3 shrink-0" />
                    <span>{def?.resourceImpact}</span>
                  </div>
                </div>

                {/* Custom Interactive Toggle Switch */}
                <div 
                  className="absolute top-4 right-4 flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(moduleId);
                  }}
                >
                  {isCheckingThis && (
                    <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                  )}
                  <div className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer flex items-center ${
                    isEnabled ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}>
                    <div className="w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* OPCCIONES ADAPTABLES DE POS PARA ENVASES & TOBOS */}
        <div className="mt-4 p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
              <Wine className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-950">
                Opciones en la Caja POS: Vender o Dar a Crédito Envases (Tobos & Botellas)
              </h4>
              <p className="text-[11px] text-amber-900/80">
                Marque si desea habilitar en la pantalla de cobro del POS los botones para cobrar depósitos/garantías o dar envases prestados a crédito.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-amber-200/60">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-amber-200 hover:bg-amber-50 cursor-pointer select-none transition-colors">
              <input
                type="checkbox"
                checked={posConfig.enablePOSContainerCharges ?? true}
                onChange={(e) => {
                  const updated = { ...posConfig, enablePOSContainerCharges: e.target.checked };
                  setPosConfig(updated);
                  savePOSConfig(updated);
                }}
                className="h-4.5 w-4.5 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">Cobrar / Vender Envases y Tobos en POS</span>
                <span className="text-[10px] text-slate-500 block">Permite cobrar valor de envase o depósito en caja</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-amber-200 hover:bg-amber-50 cursor-pointer select-none transition-colors">
              <input
                type="checkbox"
                checked={posConfig.enableContainerLoans ?? true}
                onChange={(e) => {
                  const updated = { ...posConfig, enableContainerLoans: e.target.checked };
                  setPosConfig(updated);
                  savePOSConfig(updated);
                }}
                className="h-4.5 w-4.5 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">Dar a Crédito / Prestar Envases y Tobos</span>
                <span className="text-[10px] text-slate-500 block">Permite prestar tobos/botellas fiados a clientes</span>
              </div>
            </label>
          </div>
        </div>

        {/* OPCIONES ADAPTABLES DE BALANZA ETIQUETADORA */}
        <div className="mt-4 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-200 shrink-0 font-bold">
              ⚖️
            </div>
            <div>
              <h4 className="text-xs font-black text-emerald-950">
                Lector de Balanza Etiquetadora EAN-13 / EAN-14 (Especial Carnicerías & Charcuterías)
              </h4>
              <p className="text-[11px] text-emerald-900/80">
                Decodificación automática al escanear etiquetas con código de barras con prefijo 21 (PLU + Precio/Peso).
              </p>
            </div>
          </div>

          <div className="pt-1 border-t border-emerald-200/60">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-emerald-200 hover:bg-emerald-50 cursor-pointer select-none transition-colors">
              <input
                type="checkbox"
                checked={posConfig.enableScaleEan13 ?? true}
                onChange={(e) => {
                  const updated = { ...posConfig, enableScaleEan13: e.target.checked };
                  setPosConfig(updated);
                  savePOSConfig(updated);
                }}
                className="h-4.5 w-4.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">Habilitar Lectura de Etiquetas de Balanza en POS</span>
                <span className="text-[10px] text-slate-500 block">
                  Escanear código 21 + 00 + PLU + Precio añade automáticamente el producto al carrito con su peso calculado
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* OPCIONES ADAPTABLES DE PRECIO VARIABLE (OPEN PRICE) */}
        <div className="mt-4 p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-900 border border-indigo-200 shrink-0 font-bold">
              🏷️
            </div>
            <div>
              <h4 className="text-xs font-black text-indigo-950">
                Opciones de Productos con Precio Modificable (Open Price)
              </h4>
              <p className="text-[11px] text-indigo-900/80">
                Configure el comportamiento de los productos sin precio fijo (como servicios o víveres genéricos).
              </p>
            </div>
          </div>

          <div className="pt-1 border-t border-indigo-200/60">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-indigo-200 hover:bg-indigo-50 cursor-pointer select-none transition-colors">
              <input
                type="checkbox"
                checked={posConfig.askQuantityInPos ?? true}
                onChange={(e) => {
                  const updated = { ...posConfig, askQuantityInPos: e.target.checked };
                  setPosConfig(updated);
                  savePOSConfig(updated);
                }}
                className="h-4.5 w-4.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">Solicitar Cantidad después de ingresar el Precio</span>
                <span className="text-[10px] text-slate-500 block">
                  Si se desmarca, el producto se añadirá con cantidad 1 automáticamente tras ingresar el precio.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Bottom Save Reminder */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>Los cambios entran en vigencia de inmediato en el servidor y ajustan la barra de navegación.</span>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Validando & Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Cambios de Módulos</span>
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}
