import React from 'react';
import { X, Clock, ShoppingCart, ArrowRight, Trash2, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { HeldCart } from '../types';
import { getProductEmoji } from '../utils/product-meta';

interface HeldCartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldCarts: HeldCart[];
  bcvRate: number;
  onLoadCart: (cart: HeldCart) => void;
  onDeleteCart: (id: string) => void;
  onClearAll: () => void;
  hasActiveCartItems: boolean;
}

export const HeldCartsModal: React.FC<HeldCartsModalProps> = ({
  isOpen,
  onClose,
  heldCarts,
  bcvRate,
  onLoadCart,
  onDeleteCart,
  onClearAll,
  hasActiveCartItems,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative my-auto max-h-[90vh] flex flex-col">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 shrink-0">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Carritos de Venta en Espera
              </h2>
              <span className="bg-amber-100 text-amber-800 text-xs font-mono font-bold px-2 py-0.5 rounded-full">
                {heldCarts.length} {heldCarts.length === 1 ? 'ticket' : 'tickets'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Ventas pausadas temporalmente organizadas por número de ticket (0, 1, 2...)
            </p>
          </div>
        </div>

        {/* Active Cart Warning if cashier already has items scanned */}
        {hasActiveCartItems && heldCarts.length > 0 && (
          <div className="mt-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-3 text-xs flex items-center gap-2 shrink-0">
            <ShoppingCart className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Nota:</strong> Actualmente tienes productos en el ticket activo. Al cargar un carrito en espera, puedes recuperar esa venta pausada.
            </span>
          </div>
        )}

        {/* Carts List (Scrollable) */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
          {heldCarts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Clock className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">No hay tickets en espera</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Cuando un cliente necesite buscar otro producto o su dinero, presiona el botón <strong className="text-slate-600">"Pausar Ticket"</strong> en la caja para guardarlo aquí temporalmente.
                </p>
              </div>
            </div>
          ) : (
            heldCarts.map((held) => {
              const totalBs = Math.round(held.total * bcvRate * 100) / 100;
              const totalItems = held.items.reduce((sum, i) => sum + i.quantity, 0);
              const formattedTime = new Date(held.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={held.id}
                  className="bg-slate-50 hover:bg-slate-50/80 border border-slate-200 rounded-xl p-4 transition-all hover:border-slate-300 shadow-xs space-y-3"
                >
                  {/* Top info row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-mono font-black text-sm flex items-center justify-center shadow-xs">
                        #{held.ticketNumber}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <span>Ticket #{held.ticketNumber}</span>
                          <span className="text-xs font-normal text-slate-500 font-mono">
                            • Guardado a las {formattedTime}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {totalItems} producto{totalItems !== 1 ? 's' : ''} en total
                        </div>
                      </div>
                    </div>

                    {/* Prominent Totals (Bolívares in Blue as requested) */}
                    <div className="text-right">
                      <div className="text-lg sm:text-xl font-black font-mono text-blue-700">
                        Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-600">
                        ${held.total.toFixed(2)} USD
                      </div>
                    </div>
                  </div>

                  {/* Items Preview Chips */}
                  <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 max-h-28 overflow-y-auto">
                    <div className="flex flex-wrap gap-1.5">
                      {held.items.map((item, idx) => (
                        <span
                          key={`${item.product.id}-${idx}`}
                          className="inline-flex items-center gap-1 text-[11px] bg-slate-100 border border-slate-200 text-slate-800 px-2 py-0.5 rounded-md"
                        >
                          <span>{getProductEmoji(item.product)}</span>
                          <span className="font-bold font-mono">{item.quantity}x</span>
                          <span className="truncate max-w-[140px]">{item.product.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Note if any */}
                  {held.note && (
                    <p className="text-xs italic text-slate-500 bg-amber-50/60 border border-amber-200/60 rounded-md px-2.5 py-1">
                      Nota: {held.note}
                    </p>
                  )}

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => onDeleteCart(held.id)}
                      className="px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Descartar Ticket</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onLoadCart(held)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs shadow-blue-500/20 active:scale-98"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Cargar a la Caja</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {heldCarts.length > 0 && (
          <div className="pt-4 border-t border-slate-100 mt-3 flex items-center justify-between shrink-0 text-xs">
            <button
              type="button"
              onClick={onClearAll}
              className="text-slate-400 hover:text-rose-600 font-semibold cursor-pointer transition-colors"
            >
              Vaciar todos los tickets en espera
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
