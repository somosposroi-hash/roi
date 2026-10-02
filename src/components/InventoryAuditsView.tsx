import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardCheck,
  Search,
  Plus,
  Calendar,
  User,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  FileSpreadsheet,
  Save,
  X,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Check,
  ChevronRight,
  ChevronDown,
  Filter,
  ArrowRight,
  Boxes,
  HelpCircle,
  Eye,
  Trash2,
  DollarSign
} from 'lucide-react';
import { safeFetchJson } from '../utils/api';
import { Product, InventoryAudit, InventoryAuditItem, BcvRateInfo } from '../types';

interface InventoryAuditsViewProps {
  bcvRateInfo?: BcvRateInfo;
}

export function InventoryAuditsView({ bcvRateInfo }: InventoryAuditsViewProps) {
  // Main view navigation: 'active' | 'history'
  const [currentTab, setCurrentTab] = useState<'active' | 'history'>('active');

  // Audits lists
  const [audits, setAudits] = useState<InventoryAudit[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [currentAudit, setCurrentAudit] = useState<InventoryAudit | null>(null);
  
  // Products & Categories for creation
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Loading states
  const [isLoadingAudits, setIsLoadingAudits] = useState<boolean>(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modal: Start New Audit
  const [isStartModalOpen, setIsStartModalOpen] = useState<boolean>(false);
  const [auditType, setAuditType] = useState<'CATEGORY' | 'MANUAL' | 'ALL'>('CATEGORY');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearchInModal, setProductSearchInModal] = useState<string>('');
  const [auditorName, setAuditorName] = useState<string>('Admin');
  const [startModalError, setStartModalError] = useState<string | null>(null);

  // Modal: Close Audit Confirmation
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  const [closeAuditorName, setCloseAuditorName] = useState<string>('Admin');

  // Modal: Cancel Audit Confirmation
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);

  // Local state for counted stock inputs in active workspace: itemId -> string
  const [countsMap, setCountsMap] = useState<Record<string, string>>({});
  
  // Search & Filter in workspace table
  const [tableSearch, setTableSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // ALL, PENDING, MATCHED, MISSING, SURPLUS
  
  // Alerts / notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch all products to populate categories and manual selection
  const loadProducts = useCallback(async () => {
    const res = await safeFetchJson<Product[]>('/api/v1/products');
    if (res.ok && Array.isArray(res.data)) {
      setProducts(res.data);
      const uniqueCategories = Array.from(
        new Set(res.data.map((p) => p.category?.trim()).filter(Boolean) as string[])
      ).sort();
      setCategories(uniqueCategories);
      if (uniqueCategories.length > 0 && !selectedCategory) {
        setSelectedCategory(uniqueCategories[0]);
      }
    }
  }, [selectedCategory]);

  // Fetch audits list
  const fetchAudits = useCallback(async () => {
    setIsLoadingAudits(true);
    try {
      const res = await safeFetchJson<InventoryAudit[]>('/api/v1/audits');
      if (res.ok && Array.isArray(res.data)) {
        setAudits(res.data);

        // If there's an in-progress audit and no audit is explicitly selected, open it
        const inProgress = res.data.find((a) => a.status === 'IN_PROGRESS');
        if (inProgress && !selectedAuditId) {
          setSelectedAuditId(inProgress.id);
          setCurrentTab('active');
        } else if (!selectedAuditId && res.data.length > 0) {
          setSelectedAuditId(res.data[0].id);
        }
      }
    } finally {
      setIsLoadingAudits(false);
    }
  }, [selectedAuditId]);

  // Fetch detail of selected audit
  const fetchAuditDetail = useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await safeFetchJson<InventoryAudit>(`/api/v1/audits/${id}`);
      if (res.ok && res.data) {
        setCurrentAudit(res.data);
        // Initialize countsMap
        const initialCounts: Record<string, string> = {};
        for (const it of res.data.items) {
          if (it.countedStock !== null && it.countedStock !== undefined) {
            initialCounts[it.id] = String(it.countedStock);
          } else {
            initialCounts[it.id] = '';
          }
        }
        setCountsMap(initialCounts);
      }
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    fetchAudits();
  }, [loadProducts, fetchAudits]);

  useEffect(() => {
    if (selectedAuditId) {
      fetchAuditDetail(selectedAuditId);
    } else {
      setCurrentAudit(null);
    }
  }, [selectedAuditId, fetchAuditDetail]);

  // Display temporary notifications
  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Format unit label
  const formatUnitLabel = (unit?: string) => {
    if (!unit) return 'u.';
    const u = unit.toUpperCase();
    if (u === 'KG') return 'kg';
    if (u === 'G' || u === 'GR' || u === 'GRS') return 'g';
    if (u === 'L' || u === 'LTR' || u === 'LITRO' || u === 'LITROS') return 'L';
    if (u === 'ML') return 'ml';
    if (u === 'M' || u === 'MTS' || u === 'METRO') return 'm';
    if (u === 'CM') return 'cm';
    if (u === 'UND' || u === 'UNIDAD' || u === 'UNIDADES') return 'u.';
    return unit.toLowerCase();
  };

  // Format number
  const formatNum = (val: number, unit?: string) => {
    const absVal = Math.abs(val);
    const u = (unit || '').toUpperCase();
    const isDecimal = u === 'KG' || u === 'L' || u === 'LTR' || u === 'MTS' || absVal % 1 !== 0;
    return isDecimal ? absVal.toFixed(3) : String(Math.round(absVal));
  };

  // Handle Count Change in Input
  const handleCountChange = (itemId: string, val: string) => {
    setCountsMap((prev) => ({
      ...prev,
      [itemId]: val,
    }));
  };

  // Autofill all pending items with their system stock
  const handleAutofillSystemStock = () => {
    if (!currentAudit) return;
    const newMap = { ...countsMap };
    let filledCount = 0;
    for (const item of currentAudit.items) {
      if (newMap[item.id] === '' || newMap[item.id] === undefined) {
        newMap[item.id] = String(item.systemStock);
        filledCount++;
      }
    }
    setCountsMap(newMap);
    showToast('success', `${filledCount} productos rellenados con stock de sistema`);
  };

  // Save Progress draft
  const handleSaveProgress = async () => {
    if (!currentAudit) return;
    setIsSaving(true);
    try {
      const itemsPayload = currentAudit.items.map((item) => {
        const raw = countsMap[item.id];
        const val = raw !== '' && raw !== undefined ? parseFloat(raw) : null;
        return {
          itemId: item.id,
          countedStock: val !== null && !isNaN(val) ? val : null,
        };
      });

      const res = await safeFetchJson(`/api/v1/audits/${currentAudit.id}/save-progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsPayload }),
      });

      if (res.ok) {
        showToast('success', 'Avance del conteo guardado con éxito');
        fetchAuditDetail(currentAudit.id);
      } else {
        showToast('error', res.error || 'Error al guardar avance');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Start a new Audit
  const handleStartAudit = async () => {
    setStartModalError(null);
    if (auditType === 'CATEGORY' && !selectedCategory) {
      setStartModalError('Seleccione una categoría para auditar');
      return;
    }
    if (auditType === 'MANUAL' && selectedProductIds.length === 0) {
      setStartModalError('Seleccione al menos un producto de la lista');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        type: auditType,
        category: auditType === 'CATEGORY' ? selectedCategory : undefined,
        productIds: auditType === 'MANUAL' ? selectedProductIds : undefined,
        createdBy: auditorName.trim() || 'Admin',
      };

      const res = await safeFetchJson<InventoryAudit>('/api/v1/audits/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok && res.data) {
        showToast('success', `Auditoría #${String(res.data.code).padStart(3, '0')} iniciada con éxito`);
        setIsStartModalOpen(false);
        setSelectedProductIds([]);
        await fetchAudits();
        setSelectedAuditId(res.data.id);
        setCurrentTab('active');
      } else {
        setStartModalError(res.error || 'Error al iniciar la auditoría');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Close Audit & Apply Adjustments
  const handleConfirmCloseAudit = async () => {
    if (!currentAudit) return;
    setIsSaving(true);
    try {
      const itemsPayload = currentAudit.items.map((item) => {
        const raw = countsMap[item.id];
        // If left empty, assume counted equals systemStock (no discrepancy) or 0
        const val = raw !== '' && raw !== undefined ? parseFloat(raw) : item.systemStock;
        return {
          itemId: item.id,
          countedStock: !isNaN(val) ? val : item.systemStock,
        };
      });

      const res = await safeFetchJson<InventoryAudit>(`/api/v1/audits/${currentAudit.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemsCounts: itemsPayload,
          completedBy: closeAuditorName.trim() || 'Auditor',
        }),
      });

      if (res.ok && res.data) {
        showToast('success', 'Auditoría cerrada con éxito. El Kardex y el stock han sido actualizados.');
        setIsCloseModalOpen(false);
        await fetchAudits();
        fetchAuditDetail(currentAudit.id);
      } else {
        showToast('error', res.error || 'Error al cerrar auditoría');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel Audit
  const handleConfirmCancelAudit = async () => {
    if (!currentAudit) return;
    setIsSaving(true);
    try {
      const res = await safeFetchJson(`/api/v1/audits/${currentAudit.id}/cancel`, {
        method: 'POST',
      });
      if (res.ok) {
        showToast('success', 'Auditoría cancelada');
        setIsCancelModalOpen(false);
        await fetchAudits();
        fetchAuditDetail(currentAudit.id);
      } else {
        showToast('error', res.error || 'Error al cancelar');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Print audit report
  const handlePrintAudit = () => {
    window.print();
  };

  // Real-time calculation of financial totals based on current inputs
  const liveTotals = useMemo(() => {
    if (!currentAudit) {
      return { loss: 0, surplus: 0, net: 0, countedCount: 0, totalCount: 0, progressPercent: 0 };
    }

    let loss = 0;
    let surplus = 0;
    let countedCount = 0;
    const totalCount = currentAudit.items.length;

    for (const item of currentAudit.items) {
      const raw = countsMap[item.id];
      if (raw !== '' && raw !== undefined) {
        const counted = parseFloat(raw);
        if (!isNaN(counted)) {
          countedCount++;
          const diffQty = counted - item.systemStock;
          const diffCost = diffQty * item.costPrice;
          if (diffCost < 0) {
            loss += Math.abs(diffCost);
          } else if (diffCost > 0) {
            surplus += diffCost;
          }
        }
      } else if (currentAudit.status === 'COMPLETED' && item.countedStock !== null) {
        countedCount++;
        const diffCost = item.differenceCost;
        if (diffCost < 0) {
          loss += Math.abs(diffCost);
        } else if (diffCost > 0) {
          surplus += diffCost;
        }
      }
    }

    const net = surplus - loss;
    const progressPercent = totalCount > 0 ? Math.round((countedCount / totalCount) * 100) : 0;

    return {
      loss: Math.round(loss * 100) / 100,
      surplus: Math.round(surplus * 100) / 100,
      net: Math.round(net * 100) / 100,
      countedCount,
      totalCount,
      progressPercent,
    };
  }, [currentAudit, countsMap]);

  // Group items by category for the display table
  const groupedItems = useMemo(() => {
    if (!currentAudit) return {};

    const filtered = currentAudit.items.filter((item) => {
      // Search filter
      const q = tableSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.productName.toLowerCase().includes(q) ||
        (item.product?.barcode && item.product.barcode.toLowerCase().includes(q)) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === 'ALL') return true;

      const raw = countsMap[item.id];
      const hasCount = raw !== '' && raw !== undefined && !isNaN(parseFloat(raw));
      const counted = hasCount ? parseFloat(raw) : item.countedStock;

      if (statusFilter === 'PENDING') {
        return !hasCount && item.countedStock === null;
      }
      if (counted === null || counted === undefined) return false;

      const diff = counted - item.systemStock;
      if (statusFilter === 'MATCHED') return diff === 0;
      if (statusFilter === 'MISSING') return diff < 0;
      if (statusFilter === 'SURPLUS') return diff > 0;
      return true;
    });

    // Group by categoryName
    const groups: Record<string, InventoryAuditItem[]> = {};
    for (const item of filtered) {
      const cat = item.categoryName || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [currentAudit, tableSearch, statusFilter, countsMap]);

  const activeAuditInProgress = audits.find((a) => a.status === 'IN_PROGRESS');

  return (
    <div className="space-y-6 pb-16">
      {/* PRINT-ONLY AUDIT REPORT TEMPLATE */}
      {currentAudit && (
        <div className="print-only hidden p-8 text-black bg-white">
          <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Nubly Bodegón & POS</h1>
              <p className="text-sm font-semibold">Toma de Inventario Físico & Auditoría de Existencias</p>
              <p className="text-xs text-slate-600 font-mono mt-1">
                Auditoría #{String(currentAudit.code).padStart(3, '0')} — {currentAudit.categoryFilter || 'General'}
              </p>
            </div>
            <div className="text-right text-xs font-mono">
              <p><strong>Fecha Inicio:</strong> {new Date(currentAudit.startedAt).toLocaleString('es-VE')}</p>
              {currentAudit.completedAt && (
                <p><strong>Fecha Cierre:</strong> {new Date(currentAudit.completedAt).toLocaleString('es-VE')}</p>
              )}
              <p><strong>Auditor Responsable:</strong> {currentAudit.completedBy || currentAudit.createdBy}</p>
              <p><strong>Estado:</strong> {currentAudit.status === 'COMPLETED' ? 'COMPLETADO' : currentAudit.status}</p>
            </div>
          </div>

          {/* Financial summary for print */}
          <div className="grid grid-cols-3 gap-4 mb-6 text-xs border border-black p-3 bg-slate-50">
            <div>
              <span className="block font-bold text-slate-700">Total Pérdidas (Faltantes):</span>
              <span className="text-base font-black text-rose-800">-${liveTotals.loss.toFixed(2)}</span>
            </div>
            <div>
              <span className="block font-bold text-slate-700">Total Sobrantes:</span>
              <span className="text-base font-black text-emerald-800">+${liveTotals.surplus.toFixed(2)}</span>
            </div>
            <div>
              <span className="block font-bold text-slate-700">Diferencia Neta en Costo:</span>
              <span className={`text-base font-black ${liveTotals.net < 0 ? 'text-rose-800' : 'text-emerald-800'}`}>
                {liveTotals.net < 0 ? `-$${Math.abs(liveTotals.net).toFixed(2)}` : `+$${liveTotals.net.toFixed(2)}`}
              </span>
            </div>
          </div>

          {/* Printed Table */}
          <table className="w-full text-xs text-left border-collapse border border-black mb-8">
            <thead>
              <tr className="bg-slate-200 border-b border-black font-bold uppercase text-[10px]">
                <th className="p-2 border border-black">Producto</th>
                <th className="p-2 border border-black">Categoría</th>
                <th className="p-2 text-center border border-black">Stock Sistema</th>
                <th className="p-2 text-center border border-black">Ventas</th>
                <th className="p-2 text-center border border-black">Stock Contado</th>
                <th className="p-2 text-center border border-black">Dif. (u)</th>
                <th className="p-2 text-right border border-black">Costo Unit.</th>
                <th className="p-2 text-right border border-black">Dif. ($)</th>
                <th className="p-2 text-center border border-black">Estado</th>
              </tr>
            </thead>
            <tbody>
              {currentAudit.items.map((it) => {
                const counted = countsMap[it.id] !== '' && countsMap[it.id] !== undefined
                  ? parseFloat(countsMap[it.id])
                  : (it.countedStock ?? it.systemStock);
                const diffQty = counted - it.systemStock;
                const diffCost = diffQty * it.costPrice;
                const unitStr = formatUnitLabel(it.unit);

                return (
                  <tr key={it.id} className="border-b border-black">
                    <td className="p-2 border border-black font-bold">{it.productName}</td>
                    <td className="p-2 border border-black">{it.categoryName || 'General'}</td>
                    <td className="p-2 text-center border border-black font-mono">
                      {formatNum(it.systemStock, it.unit)} {unitStr}
                    </td>
                    <td className="p-2 text-center border border-black font-mono">
                      {it.salesQty > 0 ? `${formatNum(it.salesQty, it.unit)} ${unitStr}` : '0'}
                    </td>
                    <td className="p-2 text-center border border-black font-mono font-bold">
                      {formatNum(counted, it.unit)} {unitStr}
                    </td>
                    <td className="p-2 text-center border border-black font-mono font-bold">
                      {diffQty > 0 ? `+${formatNum(diffQty, it.unit)}` : diffQty < 0 ? `-${formatNum(Math.abs(diffQty), it.unit)}` : '0'} {unitStr}
                    </td>
                    <td className="p-2 text-right border border-black font-mono">
                      ${it.costPrice.toFixed(2)}
                    </td>
                    <td className="p-2 text-right border border-black font-mono font-bold">
                      {diffCost < 0 ? `-$${Math.abs(diffCost).toFixed(2)}` : diffCost > 0 ? `+$${diffCost.toFixed(2)}` : '$0.00'}
                    </td>
                    <td className="p-2 text-center border border-black uppercase text-[9px] font-bold">
                      {diffQty === 0 ? 'Exacto' : diffQty < 0 ? 'Faltante' : 'Sobrante'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Signatures */}
          <div className="mt-16 grid grid-cols-2 gap-16 pt-8 border-t border-black text-center text-xs">
            <div>
              <div className="border-b border-black w-3/4 mx-auto mb-2"></div>
              <p className="font-bold">Firma del Auditor / Encargado</p>
              <p className="text-[10px] text-slate-600">{currentAudit.completedBy || currentAudit.createdBy}</p>
            </div>
            <div>
              <div className="border-b border-black w-3/4 mx-auto mb-2"></div>
              <p className="font-bold">Firma de Gerencia / Administración</p>
              <p className="text-[10px] text-slate-600">Revisado y Autorizado</p>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {notification && (
        <div
          className={`no-print fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-extrabold animate-bounce ${
            notification.type === 'success'
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
              : 'bg-rose-900 text-rose-100 border-rose-700'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* HEADER TITLE BAR */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-md">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900">Toma de Inventario Físico & Auditorías</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-100 text-violet-800 border border-violet-200">
                Conciliación en Vivo
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Auditorías rotativas por categorías o productos sin pausar las ventas del POS
            </p>
          </div>
        </div>

        {/* TOP ACTIONS */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Active vs History Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setCurrentTab('active')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'active'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-violet-600" />
              <span>Espacio de Conteo</span>
              {activeAuditInProgress && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setCurrentTab('history')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
              <span>Historial ({audits.length})</span>
            </button>
          </div>

          {/* New Audit Button */}
          <button
            type="button"
            onClick={() => setIsStartModalOpen(true)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Iniciar Auditoría</span>
          </button>
        </div>
      </div>

      {/* VIEW CONTENT: HISTORIAL VS ACTIVE WORKSPACE */}
      {currentTab === 'history' ? (
        /* ================= HISTORY TAB ================= */
        <div className="no-print bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900">Historial de Auditorías de Inventario</h2>
            <button
              type="button"
              onClick={fetchAudits}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualizar lista</span>
            </button>
          </div>

          {isLoadingAudits ? (
            <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-violet-600" />
              <span>Cargando auditorías...</span>
            </div>
          ) : audits.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs italic">
              No se han registrado auditorías previas. Presione "Iniciar Auditoría" para comenzar la primera.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Alcance / Categoría</th>
                    <th className="py-3 px-4">Fecha Inicio</th>
                    <th className="py-3 px-4">Fecha Cierre</th>
                    <th className="py-3 px-4 text-center">Ítems</th>
                    <th className="py-3 px-4 text-right">Pérdidas ($)</th>
                    <th className="py-3 px-4 text-right">Sobrantes ($)</th>
                    <th className="py-3 px-4 text-right">Diferencia Neta ($)</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {audits.map((a) => {
                    const isCompleted = a.status === 'COMPLETED';
                    const isInProgress = a.status === 'IN_PROGRESS';
                    return (
                      <tr
                        key={a.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          selectedAuditId === a.id ? 'bg-violet-50/50' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-black text-slate-900">
                          #{String(a.code).padStart(3, '0')}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {a.categoryFilter || (a.type === 'ALL' ? 'Todos los Productos' : 'Selección Manual')}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                          {new Date(a.startedAt).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                          {a.completedAt
                            ? new Date(a.completedAt).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {a._count?.items ?? a.items?.length ?? 0}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                          -${a.totalLossCost.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          +${a.totalSurplusCost.toFixed(2)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-black ${
                            a.netDifferenceCost < 0
                              ? 'text-rose-600'
                              : a.netDifferenceCost > 0
                              ? 'text-emerald-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {a.netDifferenceCost < 0
                            ? `-$${Math.abs(a.netDifferenceCost).toFixed(2)}`
                            : `+$${a.netDifferenceCost.toFixed(2)}`}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isInProgress && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                              En Curso
                            </span>
                          )}
                          {isCompleted && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
                              Cerrada
                            </span>
                          )}
                          {a.status === 'CANCELLED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300">
                              Cancelada
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAuditId(a.id);
                              setCurrentTab('active');
                            }}
                            className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-violet-100 text-slate-800 hover:text-violet-900 font-extrabold text-[11px] transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Abrir</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ================= ACTIVE AUDIT WORKSPACE ================= */
        <div className="no-print space-y-6">
          {!currentAudit ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
              <div className="w-16 h-16 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-4">
                <ClipboardCheck className="w-8 h-8" />
              </div>
              <h2 className="text-base font-black text-slate-900">No hay auditoría seleccionada</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
                Inicia una nueva toma de inventario físico por categoría o selecciona una del historial para revisar su detalle.
              </p>
              <button
                type="button"
                onClick={() => setIsStartModalOpen(true)}
                className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Iniciar Auditoría de Inventario</span>
              </button>
            </div>
          ) : (
            <>
              {/* AUDIT STATUS & SUMMARY CARDS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-md border border-violet-200">
                        Auditoría #{String(currentAudit.code).padStart(3, '0')}
                      </span>
                      <h2 className="text-lg font-black text-slate-900">
                        {currentAudit.categoryFilter || (currentAudit.type === 'ALL' ? 'Inventario Completo' : 'Selección Manual')}
                      </h2>
                      {currentAudit.status === 'IN_PROGRESS' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <span>En Progreso</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Cerrada & Reconciliada</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1.5 font-medium flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Iniciado: {new Date(currentAudit.startedAt).toLocaleString('es-VE')}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Auditor: {currentAudit.createdBy}
                      </span>
                      {currentAudit.completedAt && (
                        <span className="flex items-center gap-1 text-emerald-700 font-bold">
                          <Check className="w-3.5 h-3.5" />
                          Cerrado: {new Date(currentAudit.completedAt).toLocaleString('es-VE')} por {currentAudit.completedBy}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handlePrintAudit}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Imprimir reporte o exportar a PDF"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Imprimir / PDF</span>
                    </button>

                    {currentAudit.status === 'IN_PROGRESS' && (
                      <>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={handleSaveProgress}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Save className="w-4 h-4 text-emerald-400" />
                          <span>{isSaving ? 'Guardando...' : 'Guardar Avance'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsCloseModalOpen(true)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Cerrar Auditoría & Actualizar Stock</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsCancelModalOpen(true)}
                          className="px-2.5 py-2 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition-all cursor-pointer"
                          title="Descartar esta auditoría"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* POS IN-FLIGHT SALES BANNER */}
                {currentAudit.status === 'IN_PROGRESS' && (
                  <div className="bg-violet-50/70 border border-violet-200 rounded-xl p-3 text-xs text-violet-900 flex items-center gap-2.5">
                    <Boxes className="w-4 h-4 text-violet-600 shrink-0" />
                    <span>
                      <strong>Ventas Simultáneas Habilitadas:</strong> Los cajeros pueden seguir operando en el Terminal POS.
                      El sistema rastrea las ventas en vivo y ajustará con precisión la diferencia física al cerrar sin pérdidas.
                    </span>
                  </div>
                )}

                {/* 4 STATS CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  {/* LOSSES */}
                  <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-4">
                    <span className="block text-[11px] font-black uppercase text-rose-800 tracking-wider">
                      Total Pérdidas (Faltantes)
                    </span>
                    <span className="text-xl font-black text-rose-600 mt-1 block font-mono">
                      -${liveTotals.loss.toFixed(2)}
                    </span>
                    {bcvRateInfo?.usdRate && (
                      <span className="text-[10px] text-rose-700 font-mono mt-0.5 block">
                        ≈ {(liveTotals.loss * bcvRateInfo.usdRate).toFixed(2)} Bs.
                      </span>
                    )}
                  </div>

                  {/* SURPLUS */}
                  <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4">
                    <span className="block text-[11px] font-black uppercase text-emerald-800 tracking-wider">
                      Total Sobrantes
                    </span>
                    <span className="text-xl font-black text-emerald-600 mt-1 block font-mono">
                      +${liveTotals.surplus.toFixed(2)}
                    </span>
                    {bcvRateInfo?.usdRate && (
                      <span className="text-[10px] text-emerald-700 font-mono mt-0.5 block">
                        ≈ {(liveTotals.surplus * bcvRateInfo.usdRate).toFixed(2)} Bs.
                      </span>
                    )}
                  </div>

                  {/* NET BALANCE */}
                  <div
                    className={`rounded-xl p-4 border ${
                      liveTotals.net < 0
                        ? 'bg-amber-50/80 border-amber-200'
                        : 'bg-indigo-50/80 border-indigo-200'
                    }`}
                  >
                    <span
                      className={`block text-[11px] font-black uppercase tracking-wider ${
                        liveTotals.net < 0 ? 'text-amber-800' : 'text-indigo-800'
                      }`}
                    >
                      Diferencia Neta en Costo
                    </span>
                    <span
                      className={`text-xl font-black mt-1 block font-mono ${
                        liveTotals.net < 0
                          ? 'text-amber-700'
                          : liveTotals.net > 0
                          ? 'text-emerald-700'
                          : 'text-slate-700'
                      }`}
                    >
                      {liveTotals.net < 0
                        ? `-$${Math.abs(liveTotals.net).toFixed(2)}`
                        : `+$${liveTotals.net.toFixed(2)}`}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {liveTotals.net < 0 ? 'Balance en Desbalance' : 'Equilibrio de Existencias'}
                    </span>
                  </div>

                  {/* PROGRESS */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-black uppercase text-slate-600 tracking-wider">
                        Progreso del Conteo
                      </span>
                      <span className="text-xs font-black text-slate-900">{liveTotals.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
                      <div
                        className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${liveTotals.progressPercent}%` }}
                      ></div>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {liveTotals.countedCount} de {liveTotals.totalCount} productos verificados
                    </span>
                  </div>
                </div>
              </div>

              {/* SEARCH & FILTERS BAR IN AUDIT TABLE */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar producto por nombre o código de barra..."
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 focus:border-violet-600 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-900"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-300 focus:border-violet-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="ALL">Todos los Estados</option>
                    <option value="PENDING">Solo Pendientes por Contar</option>
                    <option value="MISSING">Solo Faltantes (Pérdidas)</option>
                    <option value="SURPLUS">Solo Sobrantes</option>
                    <option value="MATCHED">Solo Exactos</option>
                  </select>
                </div>

                {currentAudit.status === 'IN_PROGRESS' && (
                  <button
                    type="button"
                    onClick={handleAutofillSystemStock}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                    title="Rellena los productos no contados con el stock de sistema"
                  >
                    <Check className="w-3.5 h-3.5 text-violet-600" />
                    <span>Autocompletar Pendientes con Stock Sistema</span>
                  </button>
                )}
              </div>

              {/* AUDIT WORKSPACE PRODUCTS TABLE */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                {isLoadingDetail ? (
                  <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-violet-600" />
                    <span>Cargando productos de la auditoría...</span>
                  </div>
                ) : Object.keys(groupedItems).length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs italic">
                    No se encontraron productos que coincidan con la búsqueda o filtro aplicado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          <th className="py-3 px-4">Producto</th>
                          <th className="py-3 px-4 text-center">Stock Sistema</th>
                          <th className="py-3 px-4 text-center">Ventas</th>
                          <th className="py-3 px-4 text-center">Ingresos</th>
                          <th className="py-3 px-4 text-center">Egresos</th>
                          <th className="py-3 px-4 text-center">Stock Contado</th>
                          <th className="py-3 px-4 text-center">Dif. (u)</th>
                          <th className="py-3 px-4 text-center">Dif. ($)</th>
                          <th className="py-3 px-4 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {Object.entries(groupedItems).map(([category, catItems]) => (
                          <React.Fragment key={category}>
                            {/* CATEGORY SUB-HEADER */}
                            <tr className="bg-slate-100/70 border-y border-slate-200">
                              <td colSpan={9} className="py-2 px-4">
                                <span className="font-black text-slate-900 uppercase text-[11px] tracking-wide">
                                  {category} ({catItems.length} {catItems.length === 1 ? 'producto' : 'productos'})
                                </span>
                              </td>
                            </tr>

                            {catItems.map((item) => {
                              const rawInput = countsMap[item.id];
                              const isInputProvided = rawInput !== '' && rawInput !== undefined;
                              const countedVal = isInputProvided
                                ? parseFloat(rawInput)
                                : item.countedStock !== null
                                ? item.countedStock
                                : null;

                              const hasValidCount = countedVal !== null && !isNaN(countedVal);
                              const diffQty = hasValidCount ? Math.round((countedVal - item.systemStock) * 1000) / 1000 : 0;
                              const diffCost = hasValidCount ? Math.round((diffQty * item.costPrice) * 100) / 100 : 0;
                              const unitStr = formatUnitLabel(item.unit);

                              const isReadOnly = currentAudit.status !== 'IN_PROGRESS';

                              return (
                                <tr
                                  key={item.id}
                                  className={`hover:bg-slate-50/80 transition-colors ${
                                    hasValidCount && diffQty < 0
                                      ? 'bg-rose-50/20'
                                      : hasValidCount && diffQty > 0
                                      ? 'bg-emerald-50/20'
                                      : ''
                                  }`}
                                >
                                  {/* 1. PRODUCT NAME & DETAILS */}
                                  <td className="py-3 px-4">
                                    <div className="font-extrabold text-slate-900">
                                      {item.productName}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                                      {item.product?.barcode && <span>Cód: {item.product.barcode}</span>}
                                      <span>Costo: ${item.costPrice.toFixed(2)} / {unitStr}</span>
                                    </div>
                                  </td>

                                  {/* 2. STOCK SISTEMA (SNAPSHOT) */}
                                  <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                                    <span className="bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                      {formatNum(item.systemStock, item.unit)} {unitStr}
                                    </span>
                                  </td>

                                  {/* 3. VENTAS (LIVE MOVEMENT) */}
                                  <td className="py-3 px-4 text-center font-mono font-semibold text-blue-700">
                                    {item.salesQty > 0 ? (
                                      <span className="bg-blue-50 px-2 py-0.5 rounded text-[11px] font-bold border border-blue-200">
                                        -{formatNum(item.salesQty, item.unit)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">0</span>
                                    )}
                                  </td>

                                  {/* 4. INGRESOS */}
                                  <td className="py-3 px-4 text-center font-mono font-semibold text-emerald-700">
                                    {item.inboundQty > 0 ? (
                                      <span className="bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-bold border border-emerald-200">
                                        +{formatNum(item.inboundQty, item.unit)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">0</span>
                                    )}
                                  </td>

                                  {/* 5. EGRESOS */}
                                  <td className="py-3 px-4 text-center font-mono font-semibold text-amber-700">
                                    {item.outboundQty > 0 ? (
                                      <span className="bg-amber-50 px-2 py-0.5 rounded text-[11px] font-bold border border-amber-200">
                                        -{formatNum(item.outboundQty, item.unit)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">0</span>
                                    )}
                                  </td>

                                  {/* 6. STOCK CONTADO (INPUT OR STATIC) */}
                                  <td className="py-3 px-4 text-center">
                                    {isReadOnly ? (
                                      <span className="font-mono font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                                        {countedVal !== null ? `${formatNum(countedVal, item.unit)} ${unitStr}` : '—'}
                                      </span>
                                    ) : (
                                      <div className="inline-flex items-center gap-1.5 justify-center">
                                        <input
                                          type="number"
                                          step="any"
                                          value={rawInput ?? ''}
                                          onChange={(e) => handleCountChange(item.id, e.target.value)}
                                          placeholder={formatNum(item.systemStock, item.unit)}
                                          className={`w-28 text-center font-mono font-black text-xs py-1.5 px-2 rounded-xl border focus:outline-none transition-all ${
                                            !hasValidCount
                                              ? 'bg-slate-50 border-slate-300 text-slate-800 focus:border-violet-600 focus:bg-white'
                                              : diffQty === 0
                                              ? 'bg-slate-100 border-slate-300 text-slate-800'
                                              : diffQty < 0
                                              ? 'bg-rose-50 border-rose-300 text-rose-800 focus:border-rose-600'
                                              : 'bg-emerald-50 border-emerald-300 text-emerald-800 focus:border-emerald-600'
                                          }`}
                                        />
                                        <span className="text-[10px] text-slate-400 font-mono">{unitStr}</span>
                                      </div>
                                    )}
                                  </td>

                                  {/* 7. DIFERENCIA EN UNIDADES */}
                                  <td className="py-3 px-4 text-center font-mono font-black">
                                    {!hasValidCount ? (
                                      <span className="text-slate-300 font-normal">—</span>
                                    ) : diffQty === 0 ? (
                                      <span className="text-slate-500 font-bold">0 {unitStr}</span>
                                    ) : diffQty > 0 ? (
                                      <span className="text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded">
                                        +{formatNum(diffQty, item.unit)} {unitStr}
                                      </span>
                                    ) : (
                                      <span className="text-rose-700 bg-rose-100/70 border border-rose-300 px-2 py-0.5 rounded">
                                        -{formatNum(Math.abs(diffQty), item.unit)} {unitStr}
                                      </span>
                                    )}
                                  </td>

                                  {/* 8. DIFERENCIA EN DÓLARES */}
                                  <td className="py-3 px-4 text-center font-mono font-black">
                                    {!hasValidCount ? (
                                      <span className="text-slate-300 font-normal">—</span>
                                    ) : diffCost === 0 ? (
                                      <span className="text-slate-400">$0.00</span>
                                    ) : diffCost > 0 ? (
                                      <span className="text-emerald-700 font-black">
                                        +${diffCost.toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="text-rose-700 font-black">
                                        -${Math.abs(diffCost).toFixed(2)}
                                      </span>
                                    )}
                                  </td>

                                  {/* 9. ESTADO BADGE */}
                                  <td className="py-3 px-4 text-center">
                                    {!hasValidCount ? (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                                        Pendiente
                                      </span>
                                    ) : diffQty === 0 ? (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
                                        Exacto
                                      </span>
                                    ) : diffQty < 0 ? (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300">
                                        Faltante
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
                                        Sobrante
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ================= MODAL: INICIAR AUDITORÍA ================= */}
      {isStartModalOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Iniciar Nueva Toma de Inventario</h3>
                  <p className="text-xs text-slate-500">Selecciona el alcance físico de la auditoría</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStartModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {startModalError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{startModalError}</span>
              </div>
            )}

            {/* Scope Selection: Tabs */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                Modalidad de la Auditoría
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAuditType('CATEGORY')}
                  className={`p-3 rounded-xl border text-xs font-black flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    auditType === 'CATEGORY'
                      ? 'bg-violet-50 border-violet-600 text-violet-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Boxes className="w-4 h-4" />
                  <span>Por Categoría</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuditType('MANUAL')}
                  className={`p-3 rounded-xl border text-xs font-black flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    auditType === 'MANUAL'
                      ? 'bg-violet-50 border-violet-600 text-violet-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>Productos Específicos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuditType('ALL')}
                  className={`p-3 rounded-xl border text-xs font-black flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    auditType === 'ALL'
                      ? 'bg-violet-50 border-violet-600 text-violet-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <ClipboardCheck className="w-4 h-4" />
                  <span>Inventario Total</span>
                </button>
              </div>
            </div>

            {/* Category Selector */}
            {auditType === 'CATEGORY' && (
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                  Seleccionar Categoría
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-violet-600 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 cursor-pointer"
                >
                  {categories.map((cat) => {
                    const count = products.filter((p) => p.category === cat).length;
                    return (
                      <option key={cat} value={cat}>
                        {cat} ({count} productos)
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-500">
                  Ideal para inventarios por departamentos (ej. Lunes Carnicería, Martes Víveres, etc.)
                </p>
              </div>
            )}

            {/* Manual Product Selection with Checkboxes */}
            {auditType === 'MANUAL' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Seleccionar Productos ({selectedProductIds.length} seleccionados)
                  </label>
                  {selectedProductIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedProductIds([])}
                      className="text-[11px] text-rose-600 hover:underline font-bold"
                    >
                      Deseleccionar todos
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filtrar por nombre o código..."
                    value={productSearchInModal}
                    onChange={(e) => setProductSearchInModal(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-violet-600 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 p-1">
                  {products
                    .filter(
                      (p) =>
                        !productSearchInModal ||
                        p.name.toLowerCase().includes(productSearchInModal.toLowerCase()) ||
                        (p.barcode && p.barcode.includes(productSearchInModal))
                    )
                    .map((p, idx) => {
                      const isChecked = selectedProductIds.includes(p.id);
                      return (
                        <label
                          key={`audit-select-prod-${p.id}-${idx}`}
                          className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProductIds((prev) => [...prev, p.id]);
                                } else {
                                  setSelectedProductIds((prev) => prev.filter((id) => id !== p.id));
                                }
                              }}
                              className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
                            />
                            <div>
                              <span className="font-extrabold text-slate-900">{p.name}</span>
                              <span className="text-[10px] text-slate-500 ml-1.5 font-mono">
                                ({p.category || 'General'})
                              </span>
                            </div>
                          </div>
                          <span className="font-mono text-slate-500 text-[11px]">
                            Stock: {p.stock} {formatUnitLabel(p.unit)}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Total items note */}
            {auditType === 'ALL' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                Se auditarán <strong>{products.length} productos</strong> activos del catálogo completo del negocio.
              </div>
            )}

            {/* Auditor user name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                Auditor Responsable
              </label>
              <input
                type="text"
                value={auditorName}
                onChange={(e) => setAuditorName(e.target.value)}
                placeholder="Nombre del auditor o cajero"
                className="w-full bg-slate-50 border border-slate-300 focus:border-violet-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsStartModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleStartAudit}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>{isSaving ? 'Iniciando...' : 'Comenzar Auditoría'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CERRAR AUDITORÍA Y ACTUALIZAR STOCK ================= */}
      {isCloseModalOpen && currentAudit && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Cerrar Auditoría & Conciliar Stock</h3>
                  <p className="text-xs text-slate-500">
                    Auditoría #{String(currentAudit.code).padStart(3, '0')} — {currentAudit.categoryFilter}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial summary of closing */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider block">
                Resumen Financiero de Cierre
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
                  <span className="text-rose-700 block font-semibold text-[10px]">Total Faltantes (Pérdidas):</span>
                  <span className="text-base font-black text-rose-800 font-mono">
                    -${liveTotals.loss.toFixed(2)}
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <span className="text-emerald-700 block font-semibold text-[10px]">Total Sobrantes:</span>
                  <span className="text-base font-black text-emerald-800 font-mono">
                    +${liveTotals.surplus.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">Impacto Neto en Inventario:</span>
                <span className={`font-black font-mono text-sm ${liveTotals.net < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {liveTotals.net < 0 ? `-$${Math.abs(liveTotals.net).toFixed(2)}` : `+$${liveTotals.net.toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Important assurance note */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-950 flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-extrabold">¿Qué ocurrirá al confirmar el cierre?</p>
                <ul className="list-disc list-inside text-[11px] text-blue-900 space-y-0.5">
                  <li>Se aplicará la diferencia detectada al stock actual del producto.</li>
                  <li>Las ventas ocurridas durante el conteo quedan respetadas.</li>
                  <li>Se generarán los asientos en el <strong>Kardex</strong> bajo el concepto de <strong>Ajuste por Auditoría</strong>.</li>
                </ul>
              </div>
            </div>

            {/* Auditor responsible name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                Auditor que Cierra la Toma Física
              </label>
              <input
                type="text"
                value={closeAuditorName}
                onChange={(e) => setCloseAuditorName(e.target.value)}
                placeholder="Nombre del auditor"
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Continuar Contando
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmCloseAudit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'Actualizando Stock...' : 'Confirmar y Actualizar Stock'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CANCELAR AUDITORÍA ================= */}
      {isCancelModalOpen && currentAudit && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-black text-slate-900">¿Cancelar esta Auditoría?</h3>
              <p className="text-xs text-slate-500 mt-1">
                La auditoría se marcará como cancelada y no se modificará el stock ni el Kardex.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmCancelAudit}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Cancelando...' : 'Sí, Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
