import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  Printer, 
  ArrowRight, 
  Search, 
  RotateCw, 
  Ban, 
  AlertTriangle, 
  Key, 
  X, 
  Lock, 
  Check, 
  FileSpreadsheet, 
  Coins, 
  Package, 
  Undo2, 
  XCircle,
  ShieldCheck,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { Sale } from '../types';
import { PaymentMethodLogo, PaymentMethodId } from './PaymentMethodLogo';
import { safeFetchJson } from '../utils/api';
import { getPOSConfig } from '../utils/configHelper';

interface RecentSalesViewProps {
  bcvRate: number;
  currentUser?: any;
}

export const RecentSalesView: React.FC<RecentSalesViewProps> = ({ bcvRate, currentUser }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'VOIDED'>('ALL');

  // Pagination state: default 30 items per page as requested
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);
  const [totalSalesCount, setTotalSalesCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Voiding State
  const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null);
  const [voidReasonCategory, setVoidReasonCategory] = useState<string>('Error en precio o monto facturado');
  const [voidReasonCustom, setVoidReasonCustom] = useState<string>('');
  const [voidPassword, setVoidPassword] = useState<string>('');
  const [voidError, setVoidError] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState<boolean>(false);
  const [voidSuccessBanner, setVoidSuccessBanner] = useState<string | null>(null);
  const [isPageSelectorOpen, setIsPageSelectorOpen] = useState<boolean>(false);

  // User permissions
  const canViewAllSales = currentUser ? (currentUser.canViewAllSales ?? true) : true;
  const canVoidSales = currentUser 
    ? (currentUser.isAdmin || currentUser.role === 'ADMIN' || currentUser.role === 'Administrador' || currentUser.canVoidSales !== false)
    : true;

  const posConfig = getPOSConfig();

  const fetchSales = useCallback(async (pageToFetch = currentPage) => {
    setIsLoading(true);
    setFetchError(null);

    const queryParams = new URLSearchParams();
    queryParams.set('page', String(pageToFetch));
    queryParams.set('limit', String(pageSize));
    if (searchQuery.trim()) queryParams.set('search', searchQuery.trim());
    if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
    if (startDate) queryParams.set('startDate', startDate);
    if (endDate) queryParams.set('endDate', endDate);
    if (!canViewAllSales && currentUser?.name) queryParams.set('cashierName', currentUser.name);

    const res = await safeFetchJson<any[]>(`/api/v1/sales?${queryParams.toString()}`);
    if (res.ok && Array.isArray(res.data)) {
      setSales(res.data);
      if (res.pagination) {
        setTotalSalesCount(res.pagination.total ?? res.data.length);
        setTotalPages(res.pagination.totalPages ?? Math.max(1, Math.ceil((res.pagination.total || res.data.length) / pageSize)));
      } else {
        setTotalSalesCount(res.data.length);
        setTotalPages(Math.max(1, Math.ceil(res.data.length / pageSize)));
      }
    } else {
      console.warn('[RecentSalesView] Non-critical fetch notice:', res.error);
      setFetchError(res.error || 'No se pudieron cargar las ventas recientes');
    }
    setIsLoading(false);
  }, [currentPage, pageSize, searchQuery, statusFilter, startDate, endDate, canViewAllSales, currentUser]);

  useEffect(() => {
    fetchSales(currentPage);
  }, [currentPage, pageSize, searchQuery, statusFilter, startDate, endDate]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  };

  const parseSaleMeta = (notes?: string) => {
    let clientName = 'Contado / Cliente General';
    let docType = '';
    let docNumber = '';
    let clientPhone = '';
    let clientNotes = '';
    let discount: { amount: number; type: 'USD' | 'BS'; description: string } | null = null;
    let charge: { amount: number; type: 'USD' | 'BS'; description: string } | null = null;
    let pagoMovil: { emisorBank?: string; accountType?: string } | null = null;
    let reference = notes || '';
    let adjustedTotalUsd: number | null = null;
    let adjustedTotalBs: number | null = null;
    let voidReason = '';

    if (notes) {
      if (notes.includes('[ANULADA')) {
        const voidMatch = notes.match(/\[ANULADA(?:\s+por\s+([^\]-]+))?(?:\s*-\s*Motivo:\s*([^\]-]+))?(?:\s*-\s*Fecha:\s*([^\]]+))?\]/i);
        if (voidMatch) {
          voidReason = voidMatch[2] ? voidMatch[2].trim() : (notes.split('Motivo:')[1]?.split('-')[0]?.trim() || 'Venta anulada por supervisor');
        }
      }

      if (notes.startsWith('METADATA_JSON:')) {
        try {
          const jsonStr = notes.replace('METADATA_JSON:', '');
          const meta = JSON.parse(jsonStr);
          if (meta.client) {
            clientName = meta.client.name;
            docType = meta.client.docType;
            docNumber = meta.client.docNumber;
            clientPhone = meta.client.phone || '';
            clientNotes = meta.client.notes || '';
          }
          discount = meta.discount || null;
          charge = meta.charge || null;
          pagoMovil = meta.pagoMovil || null;
          reference = meta.paymentReference || '';
          if (meta.adjustedTotalUsd !== undefined) {
            adjustedTotalUsd = meta.adjustedTotalUsd;
            adjustedTotalBs = meta.adjustedTotalBs;
          }
        } catch (e) {
          console.error('Error parsing METADATA_JSON:', e);
        }
      } else if (notes.startsWith('CLIENT_DATA_JSON:')) {
        try {
          const parts = notes.split(' | REFERENCE: ');
          const jsonStr = parts[0].replace('CLIENT_DATA_JSON:', '');
          const clientData = JSON.parse(jsonStr);
          clientName = clientData.name;
          docType = clientData.docType;
          docNumber = clientData.docNumber;
          clientPhone = clientData.phone || '';
          clientNotes = clientData.notes || '';
          reference = parts[1] || '';
        } catch (e) {
          console.error('Error parsing client data from notes:', e);
        }
      }
    }

    return {
      clientName,
      docType,
      docNumber,
      clientPhone,
      clientNotes,
      discount,
      charge,
      pagoMovil,
      reference,
      adjustedTotalUsd,
      adjustedTotalBs,
      voidReason
    };
  };

  const handleOpenVoidModal = (sale: Sale) => {
    setSaleToVoid(sale);
    setVoidReasonCategory('Error en precio o monto facturado');
    setVoidReasonCustom('');
    setVoidPassword('');
    setVoidError(null);
  };

  const handleConfirmVoid = async () => {
    if (!saleToVoid) return;
    setVoidError(null);

    // 1. Validate master security key / PIN
    const requiredPassword = (posConfig.voidSalePassword || '1234').trim();
    if (voidPassword.trim() !== requiredPassword) {
      setVoidError('Clave de seguridad incorrecta. Ingrese la clave maestra configurada.');
      return;
    }

    // 2. Validate reason
    const finalReason = voidReasonCategory === 'Otro motivo personalizado...'
      ? voidReasonCustom.trim()
      : (voidReasonCustom.trim() ? `${voidReasonCategory}: ${voidReasonCustom.trim()}` : voidReasonCategory);

    if (!finalReason) {
      setVoidError('Debe ingresar un motivo obligatorio para autorizar la anulación.');
      return;
    }

    setIsVoiding(true);
    try {
      const res = await safeFetchJson<any>(`/api/v1/sales/${saleToVoid.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: finalReason,
          voidedBy: currentUser?.name || 'Administrador'
        })
      });

      if (res.ok) {
        // Update local state in-place
        setSales(prev => prev.map(s => {
          if (s.id === saleToVoid.id) {
            const voidNote = `[ANULADA por ${currentUser?.name || 'Administrador'} - Motivo: ${finalReason} - Fecha: ${new Date().toLocaleString('es-VE')}]`;
            return {
              ...s,
              status: 'VOIDED',
              notes: s.notes ? `${s.notes}\n${voidNote}` : voidNote
            };
          }
          return s;
        }));

        setVoidSuccessBanner(`Venta ${saleToVoid.invoiceNumber} anulada con éxito. Los productos volvieron al inventario, se registró la entrada en el Kardex y se ajustó caja y cuentas por cobrar.`);
        setTimeout(() => setVoidSuccessBanner(null), 8000);

        // Dispatch events so other modules (Kardex, Shifts, CxC, Dashboard) react immediately
        window.dispatchEvent(new CustomEvent('sale-voided', { detail: { id: saleToVoid.id, reason: finalReason } }));
        setSaleToVoid(null);
      } else {
        setVoidError(res.error || 'Ocurrió un error al anular la venta en el servidor.');
      }
    } catch (err: any) {
      setVoidError(err.message || 'Error de comunicación con el servidor.');
    } finally {
      setIsVoiding(false);
    }
  };

  const filteredSales = sales.filter((s) => {
    const meta = parseSaleMeta(s.notes);

    // Status filter
    if (statusFilter === 'COMPLETED' && s.status === 'VOIDED') return false;
    if (statusFilter === 'VOIDED' && s.status !== 'VOIDED') return false;

    // General search (invoice, cashier, method, notes)
    const matchesGeneral = 
      s.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.cashierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.notes || '').toLowerCase().includes(searchQuery.toLowerCase());

    // Client search (if notes contain client details)
    const matchesClient = clientQuery.trim() === '' || 
      meta.clientName.toLowerCase().includes(clientQuery.toLowerCase()) ||
      meta.docNumber.toLowerCase().includes(clientQuery.toLowerCase()) ||
      meta.clientPhone.toLowerCase().includes(clientQuery.toLowerCase());

    // Date range filter
    const saleDate = new Date(s.createdAt);
    saleDate.setHours(0, 0, 0, 0);

    let matchesDate = true;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (saleDate < start) matchesDate = false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (saleDate > end) matchesDate = false;
    }

    // Cashier sales restriction
    if (!canViewAllSales && currentUser?.name) {
      if (s.cashierName?.trim()?.toLowerCase() !== currentUser.name.trim()?.toLowerCase()) {
        return false;
      }
    }

    return matchesGeneral && matchesClient && matchesDate;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-950">Historial de Ventas y Notas de Entrega</h2>
                {!canViewAllSales && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Solo mis ventas ({currentUser?.name})
                  </span>
                )}
                {canVoidSales && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-rose-600" />
                    <span>Anulación Habilitada</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Historial de tickets, anulación con reintegro automático de stock a Kardex y balance de caja</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchSales(currentPage)}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
        >
          <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualizar Historial</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {voidSuccessBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl shadow-xs text-xs text-emerald-950 flex items-start gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold leading-relaxed">
            {voidSuccessBanner}
          </div>
          <button
            type="button"
            onClick={() => setVoidSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold text-xs p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-3 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const query = searchQuery.trim();
                if (query) {
                  window.dispatchEvent(new CustomEvent('trigger-global-search', { detail: query }));
                }
              }
            }}
            placeholder="Escriba el folio exacto y presione Enter..."
            className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 focus:outline-none"
          />
        </div>

        <div className="md:col-span-3 relative">
          <input
            type="text"
            value={clientQuery}
            onChange={(e) => setClientQuery(e.target.value)}
            placeholder="Buscar por cliente o teléfono..."
            className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-900 cursor-pointer"
          >
            <option value="ALL">Todas las Ventas</option>
            <option value="COMPLETED">Solo Efectivas</option>
            <option value="VOIDED">Solo Anuladas</option>
          </select>
        </div>

        <div className="md:col-span-3 flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-2 py-2 text-xs font-mono text-slate-900 focus:outline-none"
            title="Fecha Inicial"
          />
          <span className="text-slate-400 text-xs font-bold">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-2 py-2 text-xs font-mono text-slate-900 focus:outline-none"
            title="Fecha Final"
          />
        </div>

        <div className="md:col-span-1 text-right">
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setClientQuery('');
              setStartDate('');
              setEndDate('');
              setStatusFilter('ALL');
            }}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Error notification with retry button */}
      {fetchError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>{fetchError}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchSales()}
            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] cursor-pointer transition-colors shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Sales List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-24 text-center text-xs text-slate-500 font-medium">
            Cargando historial de ventas...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-24 text-center space-y-3">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No se encontraron notas de entrega registradas</p>
            <p className="text-xs text-slate-400">Las ventas procesadas en el POS aparecerán listadas aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Estado</th>
                  <th className="px-4 py-3.5">Nota de Entrega</th>
                  <th className="px-4 py-3.5">Fecha y Hora</th>
                  <th className="px-4 py-3.5">Cliente</th>
                  <th className="px-4 py-3.5">Cajero</th>
                  <th className="px-4 py-3.5">Método de Pago</th>
                  <th className="px-4 py-3.5 text-right">Total USD</th>
                  <th className="px-4 py-3.5 text-right">Total Bs (Tasa Histórica)</th>
                  <th className="px-4 py-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale, idx) => {
                  const isVoided = sale.status === 'VOIDED';
                  const meta = parseSaleMeta(sale.notes);
                  const effectiveSaleRate = (sale as any).bcvRate || (sale as any).shift?.bcvRate || bcvRate;
                  const displayTotalUsd = meta.adjustedTotalUsd !== null ? meta.adjustedTotalUsd : sale.total;
                  const displayTotalBs = meta.adjustedTotalBs !== null ? meta.adjustedTotalBs : (displayTotalUsd * effectiveSaleRate);

                  return (
                    <tr 
                      key={`sale-row-${sale.id}-${idx}`} 
                      className={`transition-colors ${
                        isVoided 
                          ? 'bg-rose-50/45 hover:bg-rose-50/70 text-slate-500' 
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* 1. ESTADO */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isVoided ? (
                          <span 
                            className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1 shadow-2xs"
                            title={meta.voidReason ? `Motivo: ${meta.voidReason}` : 'Venta Anulada'}
                          >
                            <Ban className="w-3 h-3 text-rose-600 shrink-0" />
                            <span>ANULADA</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>EFECTIVA</span>
                          </span>
                        )}
                      </td>

                      {/* 2. NOTA DE ENTREGA */}
                      <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">
                        {isVoided ? (
                          <span className="line-through text-rose-600 font-extrabold flex items-center gap-1">
                            {sale.invoiceNumber}
                          </span>
                        ) : (
                          <span className="text-blue-700">
                            {sale.invoiceNumber}
                          </span>
                        )}
                      </td>

                      {/* 3. FECHA Y HORA */}
                      <td className="px-4 py-3 text-xs text-slate-600 font-mono whitespace-nowrap">
                        {new Date(sale.createdAt).toLocaleString('es-VE')}
                      </td>

                      {/* 4. CLIENTE */}
                      <td className="px-4 py-3">
                        <div className={`font-bold text-xs truncate max-w-[150px] ${isVoided ? 'line-through text-slate-400' : 'text-slate-900'}`} title={meta.clientName}>
                          {meta.clientName}
                        </div>
                        {meta.docNumber && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            {meta.docType}-{meta.docNumber}
                          </div>
                        )}
                      </td>

                      {/* 5. CAJERO */}
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {sale.cashierName}
                      </td>

                      {/* 6. MÉTODO DE PAGO */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <PaymentMethodLogo method={sale.paymentMethod as PaymentMethodId} size="sm" />
                          <span className={`text-xs font-medium ${isVoided ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                            {sale.paymentMethod === 'CASH_USD' ? 'Efectivo USD ($)' :
                             sale.paymentMethod === 'CASH_BS' ? 'Efectivo Bs' :
                             sale.paymentMethod === 'DEBIT_CARD' ? 'Tarjeta Débito' :
                             sale.paymentMethod === 'PAGO_MOVIL' ? 'Pago Móvil' : 
                             sale.paymentMethod === 'BINANCE' ? 'Binance Pay' :
                             sale.paymentMethod === 'CREDIT' ? 'Crédito' :
                             sale.paymentMethod === 'SPLIT' ? 'Pago Mixto' : sale.paymentMethod}
                          </span>
                        </div>
                      </td>

                      {/* 7. TOTAL USD */}
                      <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                        {isVoided ? (
                          <span className="line-through text-rose-600 font-bold">
                            ${displayTotalUsd.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-900">
                            ${displayTotalUsd.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* 8. TOTAL BS */}
                      <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                        <div>
                          {isVoided ? (
                            <span className="line-through text-rose-500 font-bold block">
                              Bs. {displayTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-blue-700 block">
                              Bs. {displayTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-400 font-normal block">
                            Tasa: Bs. {effectiveSaleRate.toFixed(2)}
                          </span>
                          {(sale as any).bcvRateSource && (
                            <span className={`text-[9px] font-extrabold block uppercase tracking-wider mt-0.5 ${
                              (sale as any).bcvRateSource.startsWith('Script:') ? 'text-amber-600 font-black' : 'text-slate-500'
                            }`} title={(sale as any).bcvRateScheduleWindow || ''}>
                              {(sale as any).bcvRateSource.replace('Script: ', '⚡ ')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 9. ACCIONES */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedSale(sale)}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Ver resumen y ticket detallado"
                          >
                            <span>Resumen</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          {isVoided ? (
                            <span 
                              className="px-2.5 py-1.5 rounded-xl bg-rose-100/70 text-rose-700 font-bold text-xs border border-rose-200 inline-flex items-center gap-1 opacity-90 cursor-default"
                              title="Esta venta ya fue anulada"
                            >
                              <Ban className="w-3.5 h-3.5 text-rose-600" />
                              <span>Anulada</span>
                            </span>
                          ) : canVoidSales ? (
                            <button
                              type="button"
                              onClick={() => handleOpenVoidModal(sale)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Anular venta y reintegrar existencias al inventario"
                            >
                              <Ban className="w-3.5 h-3.5 text-rose-600 group-hover:text-white" />
                              <span>Anular Venta</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar (30 ventas por página con botones de flecha) */}
        <div className="px-5 py-4 bg-slate-50/90 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
            <span>
              Mostrando <strong className="text-slate-900 font-mono font-bold">
                {totalSalesCount === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalSalesCount)}
              </strong> de <strong className="text-slate-900 font-mono font-bold">{totalSalesCount}</strong> notas de entrega
            </span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 font-medium">
              30 por lote (optimizado)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Primera página */}
            <button
              type="button"
              onClick={() => handlePageChange(1)}
              disabled={currentPage <= 1 || isLoading}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                currentPage <= 1 || isLoading
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                  : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border-slate-200 shadow-2xs cursor-pointer'
              }`}
              title="Primera página"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* 30 Anteriores */}
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                currentPage <= 1 || isLoading
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                  : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border-slate-200 shadow-2xs cursor-pointer active:scale-95'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>30 Anteriores</span>
            </button>

            {/* Indicador de página (Interactivo) */}
            <button
              type="button"
              onClick={() => setIsPageSelectorOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-mono font-black text-xs shadow-md shadow-blue-600/10 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 hover:shadow-lg hover:shadow-blue-600/15"
              title="Click para ver todas las pestañas y saltar de página"
            >
              <span>Pág.</span>
              <span className="text-white">{currentPage}</span>
              <span className="text-blue-200">/</span>
              <span className="text-blue-100">{totalPages}</span>
              <span className="ml-0.5 text-[9px] bg-blue-500 text-blue-100 px-1.5 py-0.2 rounded-md font-bold tracking-wider select-none uppercase">Ver ▾</span>
            </button>

            {/* 30 Siguientes */}
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                currentPage >= totalPages || isLoading
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                  : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border-slate-200 shadow-2xs cursor-pointer active:scale-95'
              }`}
            >
              <span>30 Siguientes</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Última página */}
            <button
              type="button"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage >= totalPages || isLoading}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                currentPage >= totalPages || isLoading
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                  : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border-slate-200 shadow-2xs cursor-pointer'
              }`}
              title="Última página"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: ANULACIÓN DE VENTA CON CLAVE Y MOTIVO */}
      {saleToVoid && (() => {
        const meta = parseSaleMeta(saleToVoid.notes);
        const displayTotalUsd = meta.adjustedTotalUsd !== null ? meta.adjustedTotalUsd : saleToVoid.total;

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white border border-rose-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-rose-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
                    <Ban className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-950">
                      Anular Nota de Entrega #{saleToVoid.invoiceNumber}
                    </h3>
                    <p className="text-xs text-rose-700 font-semibold">
                      Operación crítica con reintegro automático de existencias
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSaleToVoid(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Warning Notice of Effects */}
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs text-rose-900 leading-relaxed">
                <div className="font-extrabold flex items-center gap-1.5 text-rose-950 uppercase tracking-wider text-[11px]">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Consecuencias automáticas de la anulación:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-rose-800">
                  <li><strong>Devolución al Inventario:</strong> Todos los productos de este ticket se sumarán nuevamente a sus existencias físicas.</li>
                  <li><strong>Entrada en Kardex:</strong> Se generará una auditoría inmutable de tipo <em>"Entrada por Anulación"</em>.</li>
                  {saleToVoid.paymentMethod === 'CREDIT' ? (
                    <li><strong>Cuentas por Cobrar (CxC):</strong> La deuda asociada al cliente <strong>se eliminará por completo</strong> del módulo de cobranzas.</li>
                  ) : (
                    <li><strong>Arqueo de Caja:</strong> El dinero cobrado <strong>se descuenta de los ingresos</strong> del arqueo de caja correspondiente.</li>
                  )}
                  <li><strong>Tablero de Control:</strong> Esta venta <strong>no se sumará</strong> a los totales de facturación ni ganancias del Dashboard.</li>
                </ul>
              </div>

              {/* Ticket Preview Box */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-700">
                  <span>Cliente: <strong className="text-slate-900">{meta.clientName}</strong></span>
                  <span>Cajero: <strong>{saleToVoid.cashierName}</strong></span>
                </div>
                <div className="flex justify-between text-slate-700 border-t border-slate-200 pt-1">
                  <span>Método de pago: <strong>{saleToVoid.paymentMethod}</strong></span>
                  <span className="text-slate-900 font-extrabold">Monto: ${displayTotalUsd.toFixed(2)} USD</span>
                </div>
                <div className="text-[10px] text-slate-500 pt-0.5">
                  Productos ({saleToVoid.items?.length || 0}): {saleToVoid.items?.map(it => `${it.quantity}x ${it.productName}`).join(', ')}
                </div>
              </div>

              {/* Error Message */}
              {voidError && (
                <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-900 font-bold flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{voidError}</span>
                </div>
              )}

              {/* Form Inputs: Reason & Security PIN */}
              <div className="space-y-3.5 text-xs">
                
                {/* 1. Motivo de anulación */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Motivo Obligatorio de Anulación
                  </label>
                  <select
                    value={voidReasonCategory}
                    onChange={(e) => setVoidReasonCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-rose-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 cursor-pointer mb-2"
                  >
                    <option value="Error en precio o monto facturado">Error en precio o monto facturado</option>
                    <option value="Producto devuelto por el cliente">Producto devuelto por el cliente</option>
                    <option value="Método de pago equivocado">Método de pago equivocado</option>
                    <option value="Venta duplicada o de prueba">Venta duplicada o de prueba</option>
                    <option value="Cliente canceló la compra / pedido">Cliente canceló la compra / pedido</option>
                    <option value="Otro motivo personalizado...">Otro motivo personalizado...</option>
                  </select>

                  <textarea
                    rows={2}
                    value={voidReasonCustom}
                    onChange={(e) => setVoidReasonCustom(e.target.value)}
                    placeholder="Detalles adicionales del motivo (Ej: cliente devolvió 2 paquetes por fecha de vencimiento)..."
                    className="w-full bg-slate-50 border border-slate-300 focus:border-rose-600 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none"
                  />
                </div>

                {/* 2. Clave de seguridad */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-rose-600" />
                      <span>Clave Maestra para Anular Venta</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      (Configurable en Configuración &gt; POS)
                    </span>
                  </label>
                  <input
                    type="password"
                    value={voidPassword}
                    onChange={(e) => setVoidPassword(e.target.value)}
                    placeholder="Ingrese su clave de autorización (default: 1234)"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-rose-600 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                  />
                </div>

              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSaleToVoid(null)}
                  disabled={isVoiding}
                  className="w-full py-2.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmVoid}
                  disabled={isVoiding}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-500/20 cursor-pointer flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isVoiding ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Anulando...</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4" />
                      <span>Confirmar Anulación</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Quick Summary Receipt Modal */}
      {selectedSale && (() => {
        const isVoided = selectedSale.status === 'VOIDED';
        const meta = parseSaleMeta(selectedSale.notes);
        const effectiveSaleRate = (selectedSale as any).bcvRate || (selectedSale as any).shift?.bcvRate || bcvRate;
        const displayTotalUsd = meta.adjustedTotalUsd !== null ? meta.adjustedTotalUsd : selectedSale.total;
        const displayTotalBs = meta.adjustedTotalBs !== null ? meta.adjustedTotalBs : (selectedSale.total * effectiveSaleRate);

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              
              <div className="text-center pb-3 border-b border-slate-100">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
                  isVoided 
                    ? 'bg-rose-100 border border-rose-200 text-rose-600' 
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                }`}>
                  {isVoided ? <Ban className="w-7 h-7" /> : <CheckCircle2 className="w-7 h-7" />}
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {isVoided ? 'Nota de Entrega ANULADA' : 'Resumen de Nota de Entrega'}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {selectedSale.invoiceNumber}
                </p>
              </div>

              {/* Warning for Voided Sale */}
              {isVoided && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-center text-rose-900">
                  <div className="font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1">
                    <Ban className="w-3.5 h-3.5 text-rose-600" />
                    <span>ESTA NOTA DE ENTREGA FUE ANULADA</span>
                  </div>
                  <p className="text-[11px] text-rose-700">
                    {meta.voidReason ? `Motivo: ${meta.voidReason}` : 'Transacción revocada: el inventario fue reintegrado y el dinero descontado.'}
                  </p>
                </div>
              )}

              {/* Receipt Ticket Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-800 space-y-2 select-all">
                <div className="text-center pb-2 border-b border-dashed border-slate-300 space-y-0.5">
                  <div className="font-bold text-sm text-slate-900 tracking-wider">NUBLY APP POS</div>
                  <div>Cajero: {selectedSale.cashierName || 'Caja 1 - Principal'}</div>
                  <div>Fecha: {new Date(selectedSale.createdAt).toLocaleString('es-VE')}</div>
                  {meta.docNumber ? (
                    <>
                      <div className="font-bold text-slate-950">Cliente: {meta.clientName}</div>
                      <div>Documento: {meta.docType}-{meta.docNumber}</div>
                      {meta.clientPhone && <div>Tlf: {meta.clientPhone}</div>}
                    </>
                  ) : (
                    <div>Cliente: Contado / General</div>
                  )}
                </div>

                {/* Items List */}
                <div className="py-2 border-b border-dashed border-slate-300 space-y-1.5">
                  {selectedSale.items?.map((item, idx) => {
                    const itemBs = (item.subtotal || 0) * effectiveSaleRate;
                    return (
                      <div key={`modal-sale-item-${item.id || item.productId || idx}-${idx}`} className="space-y-0.5">
                        <div className="flex justify-between">
                          <span className={isVoided ? 'line-through text-slate-400' : ''}>
                            {item.quantity}x {item.productName}
                          </span>
                          <span className={`font-bold ${isVoided ? 'line-through text-rose-600' : ''}`}>
                            ${(item.subtotal || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 pl-3">
                          SKU: {item.productBarcode || 'N/A'} | Bs. {itemBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subtotal & BCV Rate */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between">
                    <span>Subtotal Original:</span>
                    <span className={isVoided ? 'line-through text-slate-400' : ''}>
                      ${selectedSale.total.toFixed(2)} USD
                    </span>
                  </div>
                  {meta.discount && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Descuento ({meta.discount.description}):</span>
                      <span>-{meta.discount.type === 'USD' ? `$${meta.discount.amount.toFixed(2)}` : `Bs. ${meta.discount.amount.toFixed(2)}`}</span>
                    </div>
                  )}
                  {meta.charge && (
                    <div className="flex justify-between text-amber-600 font-bold">
                      <span>Cargo Extra ({meta.charge.description}):</span>
                      <span>+{meta.charge.type === 'USD' ? `$${meta.charge.amount.toFixed(2)}` : `Bs. ${meta.charge.amount.toFixed(2)}`}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Tasa BCV Aplicada:</span>
                    <span>Bs. {effectiveSaleRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/USD</span>
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t border-dashed border-slate-300 pt-2 space-y-1.5 font-bold">
                  <div className="flex justify-between text-slate-900">
                    <span>TOTAL EN DÓLARES:</span>
                    <span className={isVoided ? 'line-through text-rose-600 font-black' : ''}>
                      ${displayTotalUsd.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="flex justify-between text-blue-700">
                    <span>TOTAL EN BOLÍVARES:</span>
                    <span className={isVoided ? 'line-through text-rose-500 font-black' : ''}>
                      Bs. {displayTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
                  <div className="font-bold text-slate-900">MÉTODOS DE PAGO:</div>
                  <div className="pl-2 space-y-1">
                    <div className="flex justify-between font-medium">
                      <span>• {selectedSale.paymentMethod === 'DEBIT_CARD' ? 'Tarjeta Débito (Punto)' :
                               selectedSale.paymentMethod === 'PAGO_MOVIL' ? 'Pago Móvil (Bs)' :
                               selectedSale.paymentMethod === 'CASH_USD' ? 'Efectivo USD ($)' :
                               selectedSale.paymentMethod === 'CASH_BS' ? 'Efectivo Bolívares (Bs)' :
                               selectedSale.paymentMethod === 'BINANCE' ? 'Binance Pay' :
                               selectedSale.paymentMethod === 'CREDIT' ? 'Crédito' :
                               selectedSale.paymentMethod === 'SPLIT' ? 'Pago Mixto' :
                               selectedSale.paymentMethod}:</span>
                      <span className={isVoided ? 'line-through text-rose-600 font-bold' : ''}>
                        ${displayTotalUsd.toFixed(2)} USD
                      </span>
                    </div>
                    {meta.pagoMovil && (
                      <div className="text-[11px] text-slate-600 font-bold pl-3 space-y-0.5">
                        {meta.pagoMovil.emisorBank && <div>Emisor: {meta.pagoMovil.emisorBank}</div>}
                        {meta.pagoMovil.accountType && <div>Cuenta: {meta.pagoMovil.accountType === 'PERSONAL' ? 'Personal' : 'Jurídica'}</div>}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500 pl-3 break-all">
                      (Bs. {displayTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Nro. Ref: {meta.reference || 'N/A'})
                    </div>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-1 text-center text-[10px] text-slate-400">
                  --------------------------------------------------
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir (F2)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSale(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors cursor-pointer shadow-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: SELECCIONAR PÁGINA ESPECÍFICA (Pestañas / Lotes) */}
      {isPageSelectorOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs">
                  P
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Navegar por Pestañas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPageSelectorOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 font-medium">
              Seleccione la pestaña de lote a la que desea dirigirse:
            </p>

            <div className="max-h-60 overflow-y-auto pr-1 space-y-2 scrollbar-thin">
              {Array.from({ length: totalPages }, (_, idx) => {
                const pageNum = idx + 1;
                const startIdx = idx === 0 ? 0 : idx * pageSize + 1;
                const endIdx = Math.min((idx + 1) * pageSize, totalSalesCount);
                const isSelected = pageNum === currentPage;

                return (
                  <button
                    key={`page-select-item-${pageNum}`}
                    type="button"
                    onClick={() => {
                      handlePageChange(pageNum);
                      setIsPageSelectorOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer active:scale-98 ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/10'
                        : 'bg-slate-50 hover:bg-blue-50 border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700'
                    }`}
                  >
                    <span>pestaña {pageNum}</span>
                    <span className={`font-mono text-xs font-bold ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                      {startIdx}-{endIdx}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="text-right pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPageSelectorOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
