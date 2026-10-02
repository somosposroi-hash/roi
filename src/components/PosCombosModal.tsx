import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Search, 
  Gift, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Plus, 
  Layers, 
  ArrowRight,
  Boxes,
  Calendar,
  Zap,
  Package
} from 'lucide-react';
import { Combo, Product } from '../types';
import { 
  getLocalCombos, 
  syncCombos, 
  isComboAvailableNow, 
  checkComboStockAvailability, 
  formatComboItemQuantity 
} from '../utils/combosHelper';

interface PosCombosModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  bcvRate: number;
  onAddFixedComboToCart: (combo: Combo) => void;
  onOpenSelectableModal: (combo: Combo) => void;
}

export const PosCombosModal: React.FC<PosCombosModalProps> = ({
  isOpen,
  onClose,
  products,
  bcvRate,
  onAddFixedComboToCart,
  onOpenSelectableModal,
}) => {
  const [combos, setCombos] = useState<Combo[]>(getLocalCombos);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'ALL' | 'AVAILABLE' | 'FIXED' | 'SELECTABLE'>('ALL');

  useEffect(() => {
    if (isOpen) {
      syncCombos().then(setCombos);
    }
    const handleUpdate = (e: any) => {
      if (Array.isArray(e.detail)) {
        setCombos(e.detail);
      }
    };
    window.addEventListener('bodegon-combos-updated', handleUpdate);
    return () => {
      window.removeEventListener('bodegon-combos-updated', handleUpdate);
    };
  }, [isOpen]);

  // Filter combos by search query and selected filter tab
  const filteredCombos = useMemo(() => {
    return combos.filter(combo => {
      // 1. Text search
      const matchesSearch = !searchQuery.trim() || 
        combo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (combo.description && combo.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (combo.category && combo.category.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // 2. Tab filter
      if (selectedTab === 'FIXED') return combo.type === 'FIXED';
      if (selectedTab === 'SELECTABLE') return combo.type === 'SELECTABLE';
      if (selectedTab === 'AVAILABLE') {
        const avail = isComboAvailableNow(combo);
        return avail.isAvailable && combo.isActive;
      }

      return true;
    });
  }, [combos, searchQuery, selectedTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
              <Gift className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/30">
                  Módulo de Combos
                </span>
                <span className="text-xs text-blue-100 font-medium">
                  {combos.length} combos registrados
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white mt-0.5">
                Catálogo de Combos & Promociones
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 relative z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search + Filter Tabs */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
          
          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar combo por nombre..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedTab('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedTab === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Todos ({combos.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('AVAILABLE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                selectedTab === 'AVAILABLE'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Disponibles Ahora</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('FIXED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedTab === 'FIXED'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              📦 Fijos
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('SELECTABLE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedTab === 'SELECTABLE'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              🔀 Variados / Seleccionables
            </button>
          </div>
        </div>

        {/* Combos Cards Grid */}
        <div className="p-5 overflow-y-auto flex-1">
          {filteredCombos.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Gift className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No se encontraron combos</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No hay combos que coincidan con la búsqueda o el filtro seleccionado.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCombos.map((combo, idx) => {
                const availability = isComboAvailableNow(combo);
                const stockInfo = checkComboStockAvailability(combo, products);
                const isFixed = combo.type === 'FIXED';
                const isSelectable = combo.type === 'SELECTABLE';

                return (
                  <div
                    key={`pos-combo-${combo.id || idx}-${idx}`}
                    className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden relative ${
                      !availability.isAvailable 
                        ? 'border-slate-200 bg-slate-50/70 opacity-80' 
                        : !stockInfo.hasStock 
                        ? 'border-rose-200 bg-rose-50/30' 
                        : 'border-slate-200 bg-white hover:border-blue-400 hover:shadow-md'
                    }`}
                  >
                    {/* Top image & banner */}
                    <div className="p-4 pb-3 flex items-start gap-3.5">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden shadow-xs flex items-center justify-center text-2xl">
                        {combo.imageUrl ? (
                          <img src={combo.imageUrl} alt={combo.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>🎁</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isSelectable 
                              ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                              : 'bg-blue-100 text-blue-900 border border-blue-200'
                          }`}>
                            {isSelectable ? '🔀 Seleccionable' : '📦 Combo Fijo'}
                          </span>

                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            availability.isAvailable 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            <Clock className="w-2.5 h-2.5" />
                            <span>{availability.statusLabel}</span>
                          </span>
                        </div>

                        <h3 className="text-sm font-black text-slate-900 mt-1 line-clamp-1">
                          {combo.name}
                        </h3>

                        {combo.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-tight">
                            {combo.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Middle details: Included items preview */}
                    <div className="px-4 py-2.5 bg-slate-50/80 border-t border-b border-slate-100 text-xs">
                      {isFixed && combo.items && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                            Productos incluidos:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {combo.items.map((item, idx) => (
                              <span 
                                key={idx}
                                className="inline-flex items-center text-[10px] font-semibold bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700"
                              >
                                {formatComboItemQuantity(item)} {item.productName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {isSelectable && (
                        <div className="flex items-center justify-between text-[11px] text-amber-900 font-medium">
                          <span>🎯 Cliente escoge {combo.totalSelectableQuantity || 5} unidades entre las marcas disponibles.</span>
                        </div>
                      )}

                      {/* Stock availability indicator */}
                      <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Disponibilidad en almacén:</span>
                        <span className={`font-bold ${
                          stockInfo.hasStock 
                            ? 'text-emerald-700' 
                            : 'text-rose-600'
                        }`}>
                          {stockInfo.hasStock 
                            ? `Listo para armar (${stockInfo.maxCombosAvailable} disponibles)` 
                            : 'Agotado (Faltan insumos)'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom row: Price & Action */}
                    <div className="p-4 pt-3 flex items-center justify-between gap-3 bg-white">
                      <div>
                        <div className="text-base sm:text-lg font-black font-mono text-slate-900">
                          ${combo.price.toFixed(2)}
                        </div>
                        <div className="text-[10px] font-mono font-medium text-slate-500">
                          Bs. {(combo.price * bcvRate).toFixed(2)}
                        </div>
                      </div>

                      {isFixed ? (
                        <button
                          type="button"
                          disabled={!availability.isAvailable || !stockInfo.hasStock}
                          onClick={() => {
                            onAddFixedComboToCart(combo);
                            onClose();
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                            availability.isAvailable && stockInfo.hasStock
                              ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Vender Combo</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!availability.isAvailable || !stockInfo.hasStock}
                          onClick={() => {
                            onOpenSelectableModal(combo);
                            onClose();
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                            availability.isAvailable && stockInfo.hasStock
                              ? 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95 shadow-amber-500/20'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <span>Elegir {combo.totalSelectableQuantity || 5} Unids</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>Al vender un combo, todos los productos incluidos se descuentan automáticamente del inventario.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
