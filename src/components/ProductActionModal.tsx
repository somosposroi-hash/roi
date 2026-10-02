import React from 'react';
import { X, PlusCircle, Edit3, Trash2, Package } from 'lucide-react';
import { Product } from '../types';
import { getProductEmoji } from '../utils/product-meta';

interface ProductActionModalProps {
  product: Product | null;
  onClose: () => void;
  onOpenRestock: (product: Product) => void;
  onOpenEdit: (product: Product) => void;
  onToggleActive: (product: Product, status: boolean) => Promise<void>;
  onDeleteProduct: (product: Product) => Promise<void>;
}

export const ProductActionModal: React.FC<ProductActionModalProps> = ({
  product,
  onClose,
  onOpenRestock,
  onOpenEdit,
  onToggleActive,
  onDeleteProduct,
}) => {
  const [isToggling, setIsToggling] = React.useState(false);
  if (!product) return null;

  const emoji = getProductEmoji(product);
  const isActive = product.isActive !== false && (product.isActive as any) !== 0;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6">
        
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
              <h3 className="text-base font-bold text-slate-900">{product.name}</h3>
              <p className="text-xs font-mono text-slate-500">Código: {product.barcode} • SKU: {product.sku}</p>
              {!isActive && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-black uppercase rounded-full">
                  Producto Inactivo
                </span>
              )}
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

        {/* Stock & Price info box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-2 text-center font-mono">
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Precio</div>
            <div className="text-sm font-bold text-blue-700">${product.price.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Stock</div>
            <div className="text-sm font-bold text-emerald-700">{product.stock} {product.unit}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Mínimo</div>
            <div className="text-sm font-bold text-slate-700">{product.minStock}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {isActive && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRestock(product);
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Reabastecer Stock (+ Unidades)</span>
            </button>
          )}

          <button
            type="button"
            disabled={isToggling}
            onClick={() => {
              onClose();
              onOpenEdit(product);
            }}
            className="w-full py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold border border-slate-200 flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Edit3 className="w-4 h-4 text-blue-600" />
            <span>Editar Información y Foto</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isToggling}
              onClick={async () => {
                setIsToggling(true);
                try {
                  await onToggleActive(product, !isActive);
                  onClose();
                } catch {
                  setIsToggling(false);
                }
              }}
              className={`py-3 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 ${
                isActive 
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200' 
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
            >
              {isToggling ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>{isToggling ? 'Cambiando...' : isActive ? 'Desactivar' : 'Activar'}</span>
            </button>

            <button
              type="button"
              disabled={isToggling}
              onClick={async () => {
                setIsToggling(true);
                try {
                  await onDeleteProduct(product);
                  onClose();
                } catch {
                  setIsToggling(false);
                }
              }}
              className="py-3 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar</span>
            </button>
          </div>
        </div>

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
          >
            Cerrar ventana
          </button>
        </div>

      </div>
    </div>
  );
};
