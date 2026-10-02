import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Check, 
  Plus, 
  Minus, 
  Gift, 
  AlertTriangle, 
  Sparkles, 
  CheckCircle2, 
  Search,
  Package,
  Boxes
} from 'lucide-react';
import { Combo, Product } from '../types';
import { getProductEmoji } from '../utils/product-meta';

interface PosSelectableComboModalProps {
  isOpen: boolean;
  combo: Combo | null;
  allProducts: Product[];
  bcvRate: number;
  onClose: () => void;
  onConfirm: (combo: Combo, selectedItems: Array<{ product: Product; quantity: number }>) => void;
}

export const PosSelectableComboModal: React.FC<PosSelectableComboModalProps> = ({
  isOpen,
  combo,
  allProducts,
  bcvRate,
  onClose,
  onConfirm,
}) => {
  const [selectedCounts, setSelectedCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Target required quantity
  const targetQuantity = combo?.totalSelectableQuantity || 5;

  // Reset selections when modal opens or combo changes
  useEffect(() => {
    if (isOpen) {
      setSelectedCounts({});
      setSearchQuery('');
    }
  }, [isOpen, combo]);

  // Determine selectable products
  const candidateProducts = useMemo(() => {
    if (!combo) return [];
    
    // If specific product IDs are assigned in the combo
    if (combo.selectableProductIds && combo.selectableProductIds.length > 0) {
      return allProducts.filter(p => combo.selectableProductIds?.includes(p.id) && p.isActive !== false && (p.isActive as any) !== 0);
    }

    // Fallback: match by combo category or keywords (e.g. "Cerveza", "Licores")
    if (combo.category) {
      const catMatches = allProducts.filter(p => 
        (p.isActive !== false && (p.isActive as any) !== 0) && (p.category.toLowerCase().includes(combo.category!.toLowerCase()) || 
        combo.name.toLowerCase().includes('cerveza') && p.name.toLowerCase().includes('cerveza'))
      );
      if (catMatches.length > 0) return catMatches;
    }

    // Fallback to all active products
    return allProducts.filter(p => p.isActive !== false && (p.isActive as any) !== 0);
  }, [combo, allProducts]);

  // Filtered by search
  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidateProducts;
    const q = searchQuery.toLowerCase();
    return candidateProducts.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.barcode.includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [candidateProducts, searchQuery]);

  // Calculate current total selected items
  const totalSelected = useMemo(() => {
    return Object.values(selectedCounts).reduce((sum, qty) => sum + qty, 0);
  }, [selectedCounts]);

  const remainingNeeded = targetQuantity - totalSelected;
  const isComplete = totalSelected === targetQuantity;
  const progressPercent = Math.min(100, Math.round((totalSelected / targetQuantity) * 100));

  const handleIncrement = (product: Product) => {
    if (totalSelected >= targetQuantity) return;
    const currentQty = selectedCounts[product.id] || 0;
    if (currentQty >= product.stock) return; // Prevent exceeding individual stock

    setSelectedCounts(prev => ({
      ...prev,
      [product.id]: currentQty + 1
    }));
  };

  const handleDecrement = (productId: string) => {
    const currentQty = selectedCounts[productId] || 0;
    if (currentQty <= 0) return;

    setSelectedCounts(prev => {
      const next = { ...prev };
      if (currentQty === 1) {
        delete next[productId];
      } else {
        next[productId] = currentQty - 1;
      }
      return next;
    });
  };

  const handleConfirmSelection = () => {
    if (!isComplete || !combo) return;

    const items: Array<{ product: Product; quantity: number }> = [];
    for (const [productId, qty] of Object.entries(selectedCounts)) {
      if (qty > 0) {
        const prod = allProducts.find(p => p.id === productId);
        if (prod) {
          items.push({ product: prod, quantity: qty });
        }
      }
    }

    onConfirm(combo, items);
    onClose();
  };

  if (!isOpen || !combo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-black/25 text-amber-200 px-2 py-0.5 rounded-full border border-amber-300/30">
                  Combo Variado / Seleccionable
                </span>
                <span className="text-[11px] font-bold text-amber-100">
                  Total: {targetQuantity} unidades
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white truncate mt-0.5">
                {combo.name}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Progress & Quota Tracker */}
        <div className="px-5 py-3.5 bg-amber-50/80 border-b border-amber-200 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                Selección de Unidades:
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isComplete 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'bg-amber-200 text-amber-900'
              }`}>
                {totalSelected} de {targetQuantity} seleccionadas
              </span>
            </div>

            <div className="text-xs font-semibold text-amber-900">
              {isComplete ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> ¡Combo Completo!
                </span>
              ) : (
                <span>Faltan <strong className="text-amber-800 font-mono text-sm">{remainingNeeded}</strong> por escoger</span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-amber-200/80 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                isComplete ? 'bg-emerald-500 shadow-sm' : 'bg-amber-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Search filter */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar entre las marcas y productos disponibles..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
          </div>
        </div>

        {/* Product Selection Grid */}
        <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100 space-y-2">
          {filteredCandidates.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Package className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No hay productos disponibles para este combo</p>
              <p className="text-xs text-slate-400">Verifique el stock en el inventario.</p>
            </div>
          ) : (
            filteredCandidates.map((product) => {
              const count = selectedCounts[product.id] || 0;
              const hasStock = product.stock > 0;
              const isMaxStockReached = count >= product.stock;
              const canAddMore = !isComplete && hasStock && !isMaxStockReached;

              return (
                <div
                  key={product.id}
                  className={`pt-2 pb-2 first:pt-0 flex items-center justify-between gap-3 p-3 rounded-2xl transition-all ${
                    count > 0 
                      ? 'bg-amber-50/80 border border-amber-300 shadow-xs' 
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  {/* Product Thumbnail & Details */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-xs shrink-0 overflow-hidden flex items-center justify-center text-xl">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{getProductEmoji(product)}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                          {product.name}
                        </h4>
                        <span className="text-[10px] font-mono text-slate-400">
                          ({product.barcode})
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className={`font-semibold ${product.stock <= 5 ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                          Stock: {product.stock} {product.unit}
                        </span>
                        <span>•</span>
                        <span className="text-slate-400">
                          Ref: ${product.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stepper Controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={count === 0}
                      onClick={() => handleDecrement(product.id)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm transition-all cursor-pointer ${
                        count > 0
                          ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 active:scale-95'
                          : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <span className={`w-8 text-center font-mono font-black text-sm ${
                      count > 0 ? 'text-amber-900' : 'text-slate-400'
                    }`}>
                      {count}
                    </span>

                    <button
                      type="button"
                      disabled={!canAddMore}
                      onClick={() => handleIncrement(product)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm transition-all cursor-pointer ${
                        canAddMore
                          ? 'bg-amber-600 text-white hover:bg-amber-700 active:scale-95 shadow-xs'
                          : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                      }`}
                      title={
                        !hasStock 
                          ? 'Sin stock disponible' 
                          : isMaxStockReached 
                          ? 'Límite de stock alcanzado' 
                          : isComplete 
                          ? 'Combo ya completado' 
                          : 'Añadir 1'
                      }
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary & Add to Ticket Button */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 space-y-3">
          
          {/* Selected items summary pills */}
          {totalSelected > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                Resumen:
              </span>
              {Object.entries(selectedCounts).map(([pid, qty]) => {
                const prod = allProducts.find(p => p.id === pid);
                if (!prod || qty <= 0) return null;
                return (
                  <span 
                    key={pid}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold shadow-2xs"
                  >
                    <span>{qty}x {prod.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDecrement(pid)}
                      className="text-amber-700 hover:text-rose-600 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-1">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                Precio Fijo del Combo
              </span>
              <div className="text-xl font-black text-slate-900 font-mono">
                ${combo.price.toFixed(2)} USD
                <span className="text-xs font-semibold text-slate-500 ml-1 font-sans">
                  (Bs. {(combo.price * bcvRate).toFixed(2)})
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={!isComplete}
              onClick={handleConfirmSelection}
              className={`px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
                isComplete
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 scale-100 active:scale-98 animate-pulse'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {isComplete 
                  ? `Agregar Combo al Ticket ($${combo.price.toFixed(2)})` 
                  : `Seleccione ${remainingNeeded} restante(s)`}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
