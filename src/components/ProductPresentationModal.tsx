import React from 'react';
import { X, Package, Box, Layers, Tag, ShoppingBag, ArrowRight } from 'lucide-react';
import { Product, ProductPresentation } from '../types';
import { getProductEmoji } from '../utils/product-meta';

interface ProductPresentationModalProps {
  product: Product | null;
  bcvRate?: number;
  onClose: () => void;
  onSelectUnit: () => void;
  onSelectPresentation: (presentation: ProductPresentation) => void;
}

export const ProductPresentationModal: React.FC<ProductPresentationModalProps> = ({
  product,
  bcvRate = 36.5,
  onClose,
  onSelectUnit,
  onSelectPresentation,
}) => {
  if (!product) return null;

  const activePresentations = (product.presentations || []).filter((p) => p.enabled);
  const emoji = getProductEmoji(product);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CAJA':
        return <Box className="w-5 h-5 text-amber-600" />;
      case 'SIXPACK':
        return <Layers className="w-5 h-5 text-blue-600" />;
      case 'COMBO':
        return <Tag className="w-5 h-5 text-emerald-600" />;
      case 'BULTO':
        return <Package className="w-5 h-5 text-purple-600" />;
      default:
        return <ShoppingBag className="w-5 h-5 text-slate-600" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'CAJA':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SIXPACK':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'COMBO':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'BULTO':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">{emoji}</span>
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 line-clamp-1">{product.name}</h3>
              <p className="text-xs font-medium text-slate-500">
                Seleccione la modalidad de venta • Stock: <span className="font-bold text-slate-800">{product.stock} {product.unit}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presentation Options Grid */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          
          {/* Default Base Unit Option */}
          <div
            onClick={() => {
              onClose();
              onSelectUnit();
            }}
            className="group relative bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-2xl p-4 transition-all duration-200 cursor-pointer flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 group-hover:border-blue-200 flex items-center justify-center shrink-0 shadow-xs">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 group-hover:text-blue-900">Venta por Detal / {product.unit}</span>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                    Individual
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vender por cantidad exacta o fracción (1 {product.unit})
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-base font-extrabold text-blue-600 block">${product.price.toFixed(2)} USD</span>
              <span className="text-[10px] text-slate-400 group-hover:text-blue-600 font-bold flex items-center justify-end gap-1">
                Elegir <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Active Package Presentations */}
          {activePresentations.map((pres) => (
            <div
              key={pres.id}
              onClick={() => {
                onClose();
                onSelectPresentation(pres);
              }}
              className="group relative bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 transition-all duration-200 cursor-pointer flex items-center justify-between shadow-xs"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 group-hover:border-emerald-200 flex items-center justify-center shrink-0 shadow-xs">
                  {getTypeIcon(pres.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-950">{pres.name}</span>
                    <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md border ${getTypeBadge(pres.type)}`}>
                      {pres.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Descuenta <span className="font-bold text-slate-700">{pres.unitsToDeduct} {product.unit}</span> por empaque
                    {pres.barcode && (
                      <span className="ml-2 font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        ||| {pres.barcode}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-base font-extrabold text-emerald-700 block">${pres.packagePrice.toFixed(2)} USD</span>
                <span className="text-[10px] text-slate-400 group-hover:text-emerald-700 font-bold flex items-center justify-end gap-1">
                  Elegir <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}

        </div>

        {/* Footer */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
          >
            Cancelar y volver
          </button>
        </div>

      </div>
    </div>
  );
};
