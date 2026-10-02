import React, { useState, useEffect, useCallback } from 'react';
import { History, X, Receipt, CheckCircle2, Clock, Printer, ArrowRight, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Sale } from '../types';
import { PaymentMethodLogo, PaymentMethodId } from './PaymentMethodLogo';
import { safeFetchJson } from '../utils/api';

interface RecentSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  bcvRate: number;
}

export const RecentSalesModal: React.FC<RecentSalesModalProps> = ({
  isOpen,
  onClose,
  bcvRate,
}) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchRecentSales = useCallback(async (pageToLoad = page) => {
    setIsLoading(true);
    const res = await safeFetchJson<any[]>(`/api/v1/sales?page=${pageToLoad}&limit=${pageSize}`);
    if (res.ok && Array.isArray(res.data)) {
      setSales(res.data);
      if (res.pagination) {
        setTotalCount(res.pagination.total || res.data.length);
        setTotalPages(res.pagination.totalPages || Math.max(1, Math.ceil((res.pagination.total || res.data.length) / pageSize)));
      } else {
        setTotalCount(res.data.length);
        setTotalPages(Math.max(1, Math.ceil(res.data.length / pageSize)));
      }
    } else {
      console.error('Error fetching recent sales:', res.error);
    }
    setIsLoading(false);
  }, [page, pageSize]);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      fetchRecentSales(1);
    }
  }, [isOpen]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      setPage(newPage);
      fetchRecentSales(newPage);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in">
        <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Transacciones Recientes (30 Tickets por Página)
                </h3>
                <p className="text-xs text-slate-500">
                  Historial de cobros optimizado para alta fluidez y bajo consumo de memoria
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

          {/* Sales List */}
          <div className="mt-4 flex-1 overflow-y-auto pr-1 divide-y divide-slate-100">
            {isLoading ? (
              <div className="py-20 text-center text-xs text-slate-500">
                Cargando transacciones recientes...
              </div>
            ) : sales.length === 0 ? (
              <div className="py-20 text-center space-y-2">
                <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-600">No hay transacciones registradas aún</p>
                <p className="text-[11px] text-slate-400">Los tickets cobrados aparecerán aquí automáticamente.</p>
              </div>
            ) : (
              sales.map((sale, idx) => {
                const totalBs = sale.total * (sale.bcvRate || bcvRate);
                return (
                  <div
                    key={`recent-sale-${sale.id}-${idx}`}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 rounded-xl px-2 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PaymentMethodLogo method={sale.paymentMethod as PaymentMethodId} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm font-mono">
                            {sale.invoiceNumber}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(sale.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {sale.items.length} producto{sale.items.length !== 1 ? 's' : ''} • {sale.cashierName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm text-slate-900">
                          ${sale.total.toFixed(2)}
                        </div>
                        <div className="font-mono text-[11px] text-blue-700 font-semibold">
                          Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {(sale as any).bcvRateSource && (
                          <div className={`text-[8px] font-black uppercase tracking-wider text-right ${
                            (sale as any).bcvRateSource.startsWith('Script:') ? 'text-amber-600' : 'text-slate-400'
                          }`}>
                            {(sale as any).bcvRateSource.replace('Script: ', '⚡ ')}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedSale(sale)}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>Resumen</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with Pagination */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-slate-500">
              Mostrando <strong className="text-slate-800 font-mono">{totalCount === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)}</strong> de <strong className="text-slate-800 font-mono">{totalCount}</strong> tickets
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || isLoading}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
                  page <= 1 || isLoading
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                    : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border-slate-200 shadow-2xs cursor-pointer'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>30 Anteriores</span>
              </button>

              <div className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-mono font-bold text-xs">
                {page} / {totalPages}
              </div>

              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || isLoading}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
                  page >= totalPages || isLoading
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                    : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border-slate-200 shadow-2xs cursor-pointer'
                }`}
              >
                <span>30 Siguientes</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="ml-2 px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Quick Summary Receipt Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="text-center pb-3 border-b border-slate-100">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-600">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Resumen Rápido de Ticket</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Folio: {selectedSale.invoiceNumber}
              </p>
            </div>

            {/* Receipt Ticket Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-700 space-y-2">
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <div className="font-bold text-sm text-slate-900">BODEGÓN EXPRESS POS</div>
                <div className="text-[10px] text-slate-500">RIF: J-50123456-7 • Cajero: {selectedSale.cashierName}</div>
                <div className="text-[10px] text-slate-500">
                  {new Date(selectedSale.createdAt).toLocaleString('es-VE')}
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-slate-200 py-1 max-h-36 overflow-y-auto">
                {selectedSale.items.map((item, idx) => (
                  <div key={`modal-receipt-item-${item.id || item.productId || idx}-${idx}`} className="py-1 flex justify-between">
                    <span className="truncate pr-2">
                      {item.quantity}x {item.productName}
                    </span>
                    <span className="font-bold text-slate-900">${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Financials */}
              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span>${selectedSale.subtotal.toFixed(2)}</span>
                </div>

                {/* Metadata Discount or Extra Charge */}
                {selectedSale.notes && selectedSale.notes.startsWith('METADATA_JSON:') && (() => {
                  try {
                    const meta = JSON.parse(selectedSale.notes.replace('METADATA_JSON:', ''));
                    return (
                      <>
                        {meta.discount && (
                          <div className="flex justify-between text-emerald-700 font-bold">
                            <span>Descuento ({meta.discount.description}):</span>
                            <span>-${meta.discount.amount.toFixed(2)}</span>
                          </div>
                        )}
                        {meta.charge && (
                          <div className="flex justify-between text-amber-700 font-bold">
                            <span>Cargo Extra ({meta.charge.description}):</span>
                            <span>+${meta.charge.amount.toFixed(2)}</span>
                          </div>
                        )}
                        {meta.client && (
                          <div className="flex justify-between text-slate-600 font-semibold pt-1 border-t border-slate-200">
                            <span>Cliente:</span>
                            <span>{meta.client.name}</span>
                          </div>
                        )}
                      </>
                    );
                  } catch {
                    return null;
                  }
                })()}

                <div className="flex justify-between text-slate-500">
                  <span>IVA 16%:</span>
                  <span>${selectedSale.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-blue-700 border-t border-slate-200 pt-1">
                  <span>TOTAL:</span>
                  <span>${selectedSale.total.toFixed(2)} USD (Bs. {(selectedSale.total * (selectedSale.bcvRate || bcvRate)).toFixed(2)})</span>
                </div>
                <div className="flex items-center justify-between text-slate-700 pt-1">
                  <span className="flex items-center gap-1.5 font-bold">
                    <PaymentMethodLogo method={selectedSale.paymentMethod as PaymentMethodId} size="sm" />
                    <span>{selectedSale.paymentMethod}</span>
                  </span>
                  <span className="font-mono font-bold">${selectedSale.amountPaid.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors cursor-pointer shadow-sm"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
