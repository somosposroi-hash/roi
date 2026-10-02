import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Calendar,
  User,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  PlusCircle,
  Receipt,
  Clock,
  Tag,
  AlertTriangle,
  X,
  CheckCircle2,
  Boxes,
  HelpCircle,
  Eye,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Scale
} from 'lucide-react';
import { safeFetchJson } from '../utils/api';
import { Product } from '../types';

interface StockMovementData {
  id: string;
  productId: string;
  product: Product;
  saleId?: string | null;
  sale?: any;
  type: 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'INITIAL' | 'WASTE' | 'RETURN' | string;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost?: number | null;
  userName: string;
  reason?: string | null;
  createdAt: string;
}

interface KardexPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function KardexView() {
  const [movements, setMovements] = useState<StockMovementData[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<KardexPagination>({ total: 0, page: 1, limit: 50, totalPages: 1 });
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any | null>(null);
  const [selectedMovementDetail, setSelectedMovementDetail] = useState<StockMovementData | null>(null);

  // Adjustment Form
  const [adjustProductId, setAdjustProductId] = useState<string>('');
  const [adjustType, setAdjustType] = useState<string>('WASTE');
  const [adjustQuantityInput, setAdjustQuantityInput] = useState<string>('');
  const [adjustUnitCostInput, setAdjustUnitCostInput] = useState<string>('');
  const [adjustReasonInput, setAdjustReasonInput] = useState<string>('');
  const [adjustUserInput, setAdjustUserInput] = useState<string>('Admin');
  
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load products for adjustment dropdown
  const loadProducts = useCallback(async () => {
    const res = await safeFetchJson<Product[]>('/api/v1/products');
    if (res.ok && Array.isArray(res.data)) {
      setProducts(res.data);
    }
  }, []);

  // Fetch Kardex Movements
  const fetchKardex = useCallback(async (page = 1) => {
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '50');

      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedType && selectedType !== 'ALL') params.append('type', selectedType);
      if (selectedUser.trim()) params.append('userName', selectedUser.trim());
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await safeFetchJson<StockMovementData[]>(`/api/v1/kardex?${params.toString()}`);
      
      if (res.ok && Array.isArray(res.data)) {
        setMovements(res.data);
        if (res.rawJson?.pagination) {
          setPagination(res.rawJson.pagination);
        }
      }
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [searchQuery, selectedType, selectedUser, startDate, endDate]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    fetchKardex(currentPage);
  }, [fetchKardex, currentPage]);

  useEffect(() => {
    const handleSync = () => {
      loadProducts();
      fetchKardex(currentPage);
    };
    window.addEventListener('inventory-sync', handleSync);
    return () => {
      window.removeEventListener('inventory-sync', handleSync);
    };
  }, [loadProducts, fetchKardex, currentPage]);

  // Handle manual adjustment submission
  const handleCreateAdjustment = async () => {
    setAdjustError(null);
    if (!adjustProductId) {
      setAdjustError('Seleccione un producto para el ajuste');
      return;
    }

    const qty = parseFloat(adjustQuantityInput);
    if (isNaN(qty) || qty === 0) {
      setAdjustError('Ingrese una cantidad válida mayor o menor a 0');
      return;
    }

    if (!adjustReasonInput.trim()) {
      setAdjustError('Ingrese el concepto o motivo del movimiento');
      return;
    }

    try {
      const payload = {
        productId: adjustProductId,
        type: adjustType,
        quantity: qty,
        unitCost: adjustUnitCostInput ? parseFloat(adjustUnitCostInput) : undefined,
        userName: adjustUserInput || 'Admin',
        reason: adjustReasonInput.trim(),
      };

      const res = await safeFetchJson<any>('/api/v1/kardex/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok && res.data) {
        setSuccessMessage(`Ajuste registrado exitosamente en el Kardex.`);
        setIsAdjustModalOpen(false);
        setAdjustProductId('');
        setAdjustQuantityInput('');
        setAdjustUnitCostInput('');
        setAdjustReasonInput('');
        fetchKardex(currentPage);
        loadProducts();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('inventory-sync', { detail: { type: 'kardex_adjustment', timestamp: Date.now() } }));
          try {
            localStorage.setItem('nubly_last_inventory_sync', Date.now().toString());
          } catch {}
        }
      } else {
        setAdjustError(res.error || 'Error registrando el ajuste de inventario');
      }
    } catch (err: any) {
      setAdjustError(err.message || 'Error registrando el ajuste');
    }
  };

  // Helper unit formatter
  const formatUnitLabel = (unit?: string) => {
    if (!unit) return 'unid';
    const u = unit.toUpperCase();
    if (u === 'KG' || u === 'KILO' || u === 'KILOS') return 'kg';
    if (u === 'G' || u === 'GRAMO' || u === 'GRAMOS') return 'g';
    if (u === 'LTR' || u === 'L' || u === 'LITRO' || u === 'LITROS') return 'L';
    if (u === 'ML' || u === 'MILILITRO') return 'ml';
    if (u === 'MTS' || u === 'M' || u === 'METRO' || u === 'METROS') return 'm';
    if (u === 'CM' || u === 'CENTIMETRO') return 'cm';
    if (u === 'PAQ' || u === 'PAQUETE') return 'paq';
    if (u === 'BOT' || u === 'BOTELLA') return 'bot';
    if (u === 'CAJA') return 'caja';
    return 'unid';
  };

  // Format quantity values according to unit
  const formatQuantity = (val: number, unit?: string) => {
    const absVal = Math.abs(val);
    const u = (unit || '').toUpperCase();
    const isDecimalUnit = u === 'KG' || u === 'LTR' || u === 'L' || u === 'MTS' || u === 'M' || absVal % 1 !== 0;

    if (isDecimalUnit) {
      return absVal.toFixed(3);
    }
    return String(Math.round(absVal));
  };

  // Format movement type badge
  const renderTypeBadge = (type: string) => {
    const t = type.toUpperCase();
    if (t === 'INITIAL' || t === 'CARGA INICIAL') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 w-max">
          <TrendingUp className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Carga Inicial</span>
        </span>
      );
    }
    if (t === 'SALE' || t === 'VENTA POS') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1 w-max">
          <Receipt className="w-3 h-3 text-blue-600 shrink-0" />
          <span>Venta POS</span>
        </span>
      );
    }
    if (t === 'RESTOCK' || t === 'REABASTECIMIENTO') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-900 border border-indigo-300 flex items-center gap-1 w-max">
          <Boxes className="w-3 h-3 text-indigo-600 shrink-0" />
          <span>Reabastecimiento</span>
        </span>
      );
    }
    if (t === 'WASTE' || t === 'MERMA' || t === 'AJUSTE POR MERMA') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1 w-max">
          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
          <span>Ajuste por Merma</span>
        </span>
      );
    }
    if (t === 'RETURN' || t === 'DEVOLUCIÓN' || t === 'DEVOLUCION' || t === 'ANULACIÓN' || t === 'ANULACION') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 w-max shadow-2xs">
          <ArrowDownLeft className="w-3 h-3 text-emerald-700 shrink-0" />
          <span>Entrada por Anulación</span>
        </span>
      );
    }
    if (t === 'AUDIT_ADJUSTMENT' || t === 'AJUSTE POR AUDITORÍA') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-100 text-violet-900 border border-violet-300 flex items-center gap-1 w-max">
          <FileSpreadsheet className="w-3 h-3 text-violet-600 shrink-0" />
          <span>Ajuste Auditoría</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1 w-max">
        <SlidersHorizontal className="w-3 h-3 text-slate-500 shrink-0" />
        <span>Ajuste Inventario</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* HEADER TITLE BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-slate-900 text-white shadow-md">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              Kardex de Inventario & Auditoría
            </h2>
            <p className="text-xs text-slate-500">
              Control físico ultra-claro en unidades base (kg, g, L, ml, m, unidades, combos, sixpacks y mermas).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchKardex(currentPage)}
            disabled={isRefreshing}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAdjustError(null);
              if (products.length > 0 && !adjustProductId) {
                setAdjustProductId(products[0].id);
              }
              setIsAdjustModalOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registrar Ajuste / Merma</span>
          </button>
        </div>
      </div>

      {/* ALERT NOTIFICATION */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* FILTERS TOOLBAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Filtros de Búsqueda y Auditoría</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Mostrando <strong>{movements.length}</strong> de {pagination.total} registros
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* SEARCH BOX */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar producto, código, ticket..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-900"
            />
          </div>

          {/* MOVEMENT TYPE FILTER */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 cursor-pointer"
            >
              <option value="ALL">Todos los Movimientos</option>
              <option value="INITIAL">Carga Inicial</option>
              <option value="SALE">Ventas POS</option>
              <option value="RESTOCK">Reabastecimiento</option>
              <option value="WASTE">Ajustes por Merma</option>
              <option value="ADJUSTMENT">Ajustes de Inventario</option>
              <option value="AUDIT_ADJUSTMENT">Ajustes por Auditoría Física</option>
              <option value="RETURN">Entrada por Anulación (Devolución)</option>
            </select>
          </div>

          {/* USER FILTER */}
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filtrar por Usuario / Cajero"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-900"
            />
          </div>

          {/* DATE START */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 cursor-pointer"
            />
          </div>

          {/* DATE END */}
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 cursor-pointer"
            />
          </div>

        </div>
      </div>

      {/* KARDEX AUDIT TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Cargando tabla de auditoría del Kardex...</span>
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs italic">
            No se encontraron movimientos registrados en el Kardex para los filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Producto / Ítem</th>
                  <th className="py-3 px-4">Tipo Movimiento</th>
                  <th className="py-3 px-4">Concepto / Ref.</th>
                  <th className="py-3 px-4 text-center">Stock Anterior</th>
                  <th className="py-3 px-4 text-center">Entrada (+)</th>
                  <th className="py-3 px-4 text-center">Salida (-)</th>
                  <th className="py-3 px-4 text-center">Stock Resultante</th>
                  <th className="py-3 px-4 text-right">Costo Unit. Base</th>
                  <th className="py-3 px-4">Usuario</th>
                  <th className="py-3 px-4 text-center">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {movements.map((mov) => {
                  const dateObj = new Date(mov.createdAt);
                  const formattedDate = dateObj.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' });
                  const formattedTime = dateObj.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

                  const unitLabel = formatUnitLabel(mov.product?.unit);
                  const isEntry = mov.quantity > 0;
                  const isExit = mov.quantity < 0;

                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* 1. FECHA / HORA */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{formattedDate}</span>{' '}
                        <span className="text-[11px] text-slate-500">{formattedTime}</span>
                      </td>

                      {/* 2. PRODUCTO / ITEM */}
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">
                        <div>
                          <span>{mov.product?.name || 'Producto Desconocido'}</span>
                          <span className="text-[10px] font-normal text-slate-500 ml-1.5 font-mono">
                            ({unitLabel})
                          </span>
                        </div>
                      </td>

                      {/* 3. TIPO DE MOVIMIENTO */}
                      <td className="py-3.5 px-4">
                        {renderTypeBadge(mov.type)}
                      </td>

                      {/* 4. CONCEPTO / REF */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {mov.reason || 'S/N'}
                      </td>

                      {/* 5. STOCK ANTERIOR */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-600 text-xs">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          {formatQuantity(mov.previousStock, mov.product?.unit)} {unitLabel}
                        </span>
                      </td>

                      {/* 6. ENTRADA */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        {isEntry ? (
                          <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            +{formatQuantity(mov.quantity, mov.product?.unit)} {unitLabel}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-bold">—</span>
                        )}
                      </td>

                      {/* 7. SALIDA */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        {isExit ? (
                          <span className="font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                            -{formatQuantity(mov.quantity, mov.product?.unit)} {unitLabel}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-bold">—</span>
                        )}
                      </td>

                      {/* 8. STOCK RESULTANTE */}
                      <td className="py-3.5 px-4 text-center font-mono font-black text-slate-900 text-xs">
                        <span className="bg-emerald-50 text-emerald-950 font-extrabold px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs">
                          {formatQuantity(mov.newStock, mov.product?.unit)} {unitLabel}
                        </span>
                      </td>

                      {/* 9. COSTO UNIT BASE */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700 whitespace-nowrap">
                        ${(mov.unitCost ?? mov.product?.cost ?? 0).toFixed(2)} / {unitLabel}
                      </td>

                      {/* 10. USUARIO */}
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {mov.userName || 'Admin'}
                      </td>

                      {/* 11. ACTION DETALLE */}
                      <td className="py-3.5 px-4 text-center">
                        {mov.sale ? (
                          <button
                            type="button"
                            onClick={() => setSelectedSaleDetail(mov.sale)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1 mx-auto"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Ticket</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedMovementDetail(mov)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1 mx-auto"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Ver</span>
                          </button>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION BAR */}
        {pagination.totalPages > 1 && (
          <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">
              Página <strong>{pagination.page}</strong> de {pagination.totalPages} ({pagination.total} movimientos totales)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <button
                type="button"
                disabled={currentPage >= pagination.totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: REGISTRAR AJUSTE O MERMA MANUAL */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Registrar Ajuste / Merma de Inventario
                  </h3>
                  <p className="text-xs text-slate-500">
                    Suma (+) o descuenta (-) stock en unidades base con registro en Kardex
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {adjustError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}

            <div className="space-y-4">
              
              {/* SELECT PRODUCT */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Producto / Ítem a Ajustar
                </label>
                <select
                  value={adjustProductId}
                  onChange={(e) => {
                    setAdjustProductId(e.target.value);
                    const found = products.find((p) => p.id === e.target.value);
                    if (found && !adjustUnitCostInput) {
                      setAdjustUnitCostInput(String(found.cost));
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 cursor-pointer"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit}) — Stock actual: {p.stock}
                    </option>
                  ))}
                </select>
              </div>

              {/* TIPO DE MOVIMIENTO & CANTIDAD */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Tipo de Ajuste
                  </label>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="WASTE">Ajuste por Merma (Salida -)</option>
                    <option value="RESTOCK">Reabastecimiento (Entrada +)</option>
                    <option value="ADJUSTMENT">Ajuste de Inventario (±)</option>
                    <option value="INITIAL">Carga Inicial (Entrada +)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Cantidad {adjustType === 'WASTE' ? '(Se descontará)' : '(Unidades Base)'}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder={adjustType === 'WASTE' ? '0.350' : '10.00'}
                    value={adjustQuantityInput}
                    onChange={(e) => setAdjustQuantityInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Ej: 0.100 para 100g / 0.250 para 250ml
                  </span>
                </div>
              </div>

              {/* COSTO UNITARIO BASE & USUARIO */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Costo Unit. Base ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="5.00"
                    value={adjustUnitCostInput}
                    onChange={(e) => setAdjustUnitCostInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Usuario Responsable
                  </label>
                  <input
                    type="text"
                    value={adjustUserInput}
                    onChange={(e) => setAdjustUserInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* CONCEPTO / MOTIVO */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Concepto / Motivo de la Auditoría
                </label>
                <input
                  type="text"
                  placeholder="Ej: Salida por Punta Vencida, Llenado de Tanque, Compra Factura #441..."
                  value={adjustReasonInput}
                  onChange={(e) => setAdjustReasonInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                />
              </div>

            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleCreateAdjustment}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer text-center"
              >
                Guardar Ajuste
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: TICKET DE VENTA DIGITAL */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900">
                  Ticket #{selectedSaleDetail.invoiceNumber || selectedSaleDetail.id}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSaleDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Cajero:</span>
                <span className="font-bold text-slate-900">{selectedSaleDetail.cashierName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Método Pago:</span>
                <span className="font-bold text-blue-700">{selectedSaleDetail.paymentMethod}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Fecha:</span>
                <span>{new Date(selectedSaleDetail.createdAt).toLocaleString('es-VE')}</span>
              </div>
            </div>

            {selectedSaleDetail.items && selectedSaleDetail.items.length > 0 && (
              <div className="border-t border-b border-slate-200 py-3 my-2 space-y-1.5">
                <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Ítems de la Venta:</div>
                {selectedSaleDetail.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-xs font-mono">
                    <span className="text-slate-800 font-semibold">{item.quantity}x {item.productName}</span>
                    <span className="font-bold text-slate-900">${(item.subtotal || item.unitPrice * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center text-sm font-black font-mono pt-2 text-slate-900">
              <span>TOTAL VENTAS:</span>
              <span className="text-emerald-700 text-base">${selectedSaleDetail.total?.toFixed(2)} USD</span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedSaleDetail(null)}
              className="w-full mt-2 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
            >
              Cerrar Ticket
            </button>

          </div>
        </div>
      )}

      {/* MODAL: MOVEMENT DETAIL */}
      {selectedMovementDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">
                  Detalle del Movimiento Kardex
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMovementDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Producto</span>
                <div className="font-bold text-slate-900 text-sm">{selectedMovementDetail.product?.name}</div>
                <div className="font-mono text-slate-500 text-[11px]">Código: {selectedMovementDetail.product?.barcode}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Stock Previo</div>
                  <div className="font-bold text-slate-800">{selectedMovementDetail.previousStock} {selectedMovementDetail.product?.unit}</div>
                </div>

                <div className="p-2.5 bg-emerald-50 rounded-lg">
                  <div className="text-[10px] text-emerald-700 uppercase font-bold">Nuevo Stock</div>
                  <div className="font-bold text-emerald-900">{selectedMovementDetail.newStock} {selectedMovementDetail.product?.unit}</div>
                </div>
              </div>

              <div className="space-y-1.5 font-semibold text-slate-700">
                <div className="flex justify-between">
                  <span>Concepto / Motivo:</span>
                  <span className="font-bold text-slate-900">{selectedMovementDetail.reason || 'Sin motivo'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Usuario:</span>
                  <span className="font-bold text-slate-900">{selectedMovementDetail.userName}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span>Fecha / Hora:</span>
                  <span>{new Date(selectedMovementDetail.createdAt).toLocaleString('es-VE')}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedMovementDetail(null)}
              className="w-full mt-2 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
            >
              Cerrar Detalle
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
