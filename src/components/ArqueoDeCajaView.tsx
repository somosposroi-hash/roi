import React, { useState, useEffect, useCallback } from 'react';
import { 
  Lock, 
  Unlock, 
  ShieldAlert, 
  CheckCircle2, 
  DollarSign, 
  Calendar, 
  FileText, 
  Clock, 
  RefreshCw, 
  CreditCard, 
  Smartphone, 
  Wallet, 
  ArrowRight,
  Printer,
  X,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Key,
  Receipt,
  UserCheck,
  Tag,
  Percent,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { safeFetchJson } from '../utils/api';
import { getPOSConfig } from '../utils/configHelper';

interface ShiftReportData {
  shift: {
    id: string;
    shiftNumber: number;
    cashierName: string;
    registerName: string;
    status: 'OPEN' | 'CLOSED';
    openedAt: string;
    closedAt?: string;
    bcvRate: number;
    initialCashUsd: number;
    initialCashBs: number;
    notes?: string;
  };
  salesCount: number;
  bcvRate: number;
  initialCashUsd: number;
  initialCashBs: number;
  breakdown: {
    bsMethods: {
      debitCardBs: number;
      debitCardUsdEq: number;
      pagoMovilBs: number;
      pagoMovilUsdEq: number;
      cashBs: number;
      cashBsUsdEq: number;
      totalBs: number;
      totalBsUsdEq: number;
    };
    usdMethods: {
      cashUsd: number;
      totalUsd: number;
    };
    usdtMethods: {
      binanceUsdt: number;
      totalUsdt: number;
    };
    creditMethods: {
      creditUsd: number;
      totalCreditUsd: number;
    };
    changeGiven: {
      totalChangeUsd: number;
      totalChangeBs: number;
    };
    outflows: {
      totalOutflowsUsd: number;
      totalOutflowsBs: number;
      list: any[];
    };
    cajaChica: {
      initialUsd: number;
      initialBs: number;
      cashInflowUsd: number;
      cashInflowBs: number;
      changeGivenUsd: number;
      changeGivenBs: number;
      outflowsUsd: number;
      outflowsBs: number;
      finalUsd: number;
      finalBs: number;
      finalTotalUsdEq: number;
    };
    grandTotalUsd: number;
  };
  sales: any[];
  outflows?: any[];
}

interface ArqueoDeCajaViewProps {
  bcvRate: number;
  onShiftStatusChange?: (isOpen: boolean) => void;
  currentUser?: any;
}

function parseSaleMeta(notes?: string) {
  if (!notes) return { client: null, discount: null, charge: null, ref: null, rawNote: '' };
  if (notes.startsWith('METADATA_JSON:')) {
    try {
      const meta = JSON.parse(notes.replace('METADATA_JSON:', ''));
      return {
        client: meta.client || null,
        discount: meta.discount || null,
        charge: meta.charge || null,
        ref: meta.paymentReference || null,
        rawNote: '',
      };
    } catch {
      return { client: null, discount: null, charge: null, ref: null, rawNote: notes };
    }
  }
  return { client: null, discount: null, charge: null, ref: null, rawNote: notes };
}

export function ArqueoDeCajaView({ bcvRate, onShiftStatusChange, currentUser }: ArqueoDeCajaViewProps) {
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [activeReport, setActiveReport] = useState<ShiftReportData | null>(null);
  const [pastShifts, setPastShifts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // User Granular Permissions
  const canViewOtherShifts = currentUser ? (currentUser.canViewOtherShifts ?? true) : true;
  const canRegisterExpenses = currentUser ? (currentUser.canRegisterExpenses ?? true) : true;

  // Pagination for shift history (30 turnos por página)
  const [shiftPage, setShiftPage] = useState<number>(1);
  const [shiftPageSize] = useState<number>(30);

  // Filtered shifts based on permissions
  const filteredShifts = React.useMemo(() => {
    if (!canViewOtherShifts && currentUser?.name) {
      return pastShifts.filter((s) => s.cashierName?.trim()?.toLowerCase() === currentUser.name.trim()?.toLowerCase());
    }
    return pastShifts;
  }, [pastShifts, canViewOtherShifts, currentUser]);

  const totalShiftPages = Math.max(1, Math.ceil(filteredShifts.length / shiftPageSize));
  const paginatedShifts = React.useMemo(() => {
    const start = (shiftPage - 1) * shiftPageSize;
    return filteredShifts.slice(start, start + shiftPageSize);
  }, [filteredShifts, shiftPage, shiftPageSize]);

  // Security confirmation modals
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState<boolean>(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState<boolean>(false);
  const [isOutflowModalOpen, setIsOutflowModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [selectedShiftReport, setSelectedShiftReport] = useState<ShiftReportData | null>(null);

  // Form inputs for opening shift
  const [initialCashUsdInput, setInitialCashUsdInput] = useState<string>('0');
  const [initialCashBsInput, setInitialCashBsInput] = useState<string>('0');
  const [cashierNameInput, setCashierNameInput] = useState<string>(() => {
    return currentUser ? currentUser.name : 'Caja 1 - Principal';
  });
  const [closeNotesInput, setCloseNotesInput] = useState<string>('');

  // Form inputs for Cash Outflow (Salida de Dinero)
  const [outflowAmountUsdInput, setOutflowAmountUsdInput] = useState<string>('');
  const [outflowAmountBsInput, setOutflowAmountBsInput] = useState<string>('');
  const [outflowReasonInput, setOutflowReasonInput] = useState<string>('');
  const [outflowPasswordInput, setOutflowPasswordInput] = useState<string>('');
  const [outflowError, setOutflowError] = useState<string | null>(null);

  // Date filter for shift history (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Prefill cashierName from currentUser
  useEffect(() => {
    if (currentUser) {
      setCashierNameInput(currentUser.name);
    }
  }, [currentUser]);

  // Load active shift
  const loadActiveShift = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const url = currentUser ? `/api/v1/shifts/active?cashierName=${encodeURIComponent(currentUser.name)}` : '/api/v1/shifts/active';
      const res = await safeFetchJson<any>(url);
      if (res.ok) {
        setActiveShift(res.data);
        if (onShiftStatusChange) {
          onShiftStatusChange(!!res.data);
        }
        if (res.data) {
          // Fetch real-time report for active shift
          const reportRes = await safeFetchJson<ShiftReportData>(`/api/v1/shifts/${res.data.id}/report`);
          if (reportRes.ok && reportRes.data) {
            setActiveReport(reportRes.data);
          }
        } else {
          setActiveReport(null);
        }
      }
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [onShiftStatusChange, currentUser]);

  // Load shift list with date filter
  const loadShiftsList = useCallback(async (dateFilter?: string) => {
    const url = dateFilter ? `/api/v1/shifts?date=${dateFilter}` : '/api/v1/shifts';
    const res = await safeFetchJson<any[]>(url);
    if (res.ok && Array.isArray(res.data)) {
      setPastShifts(res.data);
    }
  }, []);

  useEffect(() => {
    loadActiveShift();
    loadShiftsList(selectedDate);
  }, [loadActiveShift, loadShiftsList, selectedDate]);

  // Handle opening shift after confirming "Sí"
  const handleConfirmOpenShift = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = {
        cashierName: cashierNameInput,
        registerName: currentUser?.cashRegister ? `Caja #${currentUser.cashRegister}` : 'Caja Principal',
        initialCashUsd: parseFloat(initialCashUsdInput) || 0,
        initialCashBs: parseFloat(initialCashBsInput) || 0,
        bcvRate: bcvRate,
      };

      const res = await safeFetchJson<any>('/api/v1/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok && res.data) {
        setSuccessMessage(`¡Turno #${res.data.shiftNumber} abierto exitosamente! Tasa BCV registrada: Bs. ${res.data.bcvRate}`);
        setIsOpenShiftModalOpen(false);
        await loadActiveShift();
        await loadShiftsList(selectedDate);
      } else {
        setErrorMessage(res.error || 'Error al abrir el turno');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error inesperado al abrir turno');
    }
  };

  // Handle closing active shift
  const handleConfirmCloseShift = async () => {
    if (!activeShift) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await safeFetchJson<any>(`/api/v1/shifts/${activeShift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: closeNotesInput }),
      });

      if (res.ok && res.data) {
        setSuccessMessage(`Turno #${res.data.shiftNumber} cerrado. Se ha generado el arqueo final.`);
        setIsCloseShiftModalOpen(false);
        setCloseNotesInput('');
        await loadActiveShift();
        await loadShiftsList(selectedDate);
      } else {
        setErrorMessage(res.error || 'Error al cerrar el turno');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error inesperado al cerrar turno');
    }
  };

  // Handle Cash Outflow Registration ("Registrar Salida")
  const handleRegisterOutflow = async () => {
    setOutflowError(null);
    if (!activeShift) {
      setOutflowError('No hay un turno activo abierto.');
      return;
    }

    if (!canRegisterExpenses) {
      setOutflowError('Tu usuario no tiene autorización para registrar salidas de dinero de caja.');
      return;
    }

    const usdAmt = parseFloat(outflowAmountUsdInput) || 0;
    const bsAmt = parseFloat(outflowAmountBsInput) || 0;

    if (usdAmt <= 0 && bsAmt <= 0) {
      setOutflowError('Ingrese un monto válido en USD o Bs.');
      return;
    }

    if (!outflowReasonInput.trim()) {
      setOutflowError('Ingrese el motivo de la salida de dinero.');
      return;
    }

    // Validate special password
    const posConfig = getPOSConfig();
    const expectedPassword = posConfig.outflowPassword || '1234';

    if (outflowPasswordInput !== expectedPassword) {
      setOutflowError('Clave especial incorrecta. Verifique la contraseña de supervisor en Configuración.');
      return;
    }

    try {
      const payload = {
        amountUsd: usdAmt,
        amountBs: bsAmt,
        reason: outflowReasonInput.trim(),
        authorizedBy: 'Dueño / Administrador',
      };

      const res = await safeFetchJson<any>(`/api/v1/shifts/${activeShift.id}/outflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok && res.data) {
        setSuccessMessage(`Salida de dinero de caja chica registrada correctamente ($${usdAmt} USD / Bs. ${bsAmt}).`);
        setIsOutflowModalOpen(false);
        setOutflowAmountUsdInput('');
        setOutflowAmountBsInput('');
        setOutflowReasonInput('');
        setOutflowPasswordInput('');
        await loadActiveShift();
      } else {
        setOutflowError(res.error || 'Error registrando la salida de dinero');
      }
    } catch (err: any) {
      setOutflowError(err.message || 'Error registrando salida');
    }
  };

  // View historical shift report
  const handleViewShiftReport = async (shiftId: string) => {
    const res = await safeFetchJson<ShiftReportData>(`/api/v1/shifts/${shiftId}/report`);
    if (res.ok && res.data) {
      setSelectedShiftReport(res.data);
      setIsReportModalOpen(true);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* HEADER TITLE CARD */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Arqueo de Caja & Control de Caja Chica
              </h2>
              <p className="text-xs text-slate-500">
                Apertura con dinero inicial, cuadre financiero por método, vueltos entregados y egresos con clave del dueño.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              loadActiveShift();
              loadShiftsList(selectedDate);
            }}
            disabled={isRefreshing}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          {activeShift && canRegisterExpenses && (
            <button
              type="button"
              onClick={() => {
                setOutflowError(null);
                setIsOutflowModalOpen(true);
              }}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Registrar Salida de Dinero</span>
            </button>
          )}

          {!activeShift ? (
            <button
              type="button"
              onClick={() => setIsOpenShiftModalOpen(true)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer animate-pulse"
            >
              <Unlock className="w-4 h-4" />
              <span>Abrir Turno</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsCloseShiftModalOpen(true)}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Cerrar Turno & Arqueo</span>
            </button>
          )}
        </div>
      </div>

      {/* ALERT MESSAGES */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

      {/* ACTIVE SHIFT STATUS BANNER / DESGLOSE / CAJA CHICA */}
      {activeShift ? (
        <div className="bg-white border-2 border-emerald-500/40 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    TURNO ACTIVO #{activeShift.shiftNumber}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                    ABIERTO
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                  <span>Cajero: <strong>{activeShift.cashierName}</strong></span>
                  <span>•</span>
                  <span>Apertura: {new Date(activeShift.openedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-right">
                <div className="text-[10px] uppercase font-bold text-slate-500">Monto Inicial Cajero</div>
                <div className="text-xs font-black font-mono text-slate-800">
                  ${(activeShift.initialCashUsd || 0).toFixed(2)} USD / Bs. {(activeShift.initialCashBs || 0).toFixed(2)}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-right">
                <div className="text-[10px] uppercase font-bold text-slate-500">Tasa BCV del Turno</div>
                <div className="text-sm font-black font-mono text-blue-700">
                  Bs. {activeShift.bcvRate.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* DESGLOSE POR METODO DE PAGO Y MONEDA (Live Breakdown) */}
          {activeReport && (
            <div className="space-y-6">
              
              {/* 1. SECCIÓN DE DESGLOSE POR MÉTODO DE PAGO */}
              <div>
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Desglose de Ingresos por Método de Pago</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* BOLÍVARES (BS) */}
                  <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                      <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        <span>Ingresos Bolívares (Bs.)</span>
                      </span>
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono">
                        Bs.
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-700">
                        <span>Tarjeta Débito:</span>
                        <span className="font-mono font-bold">Bs. {activeReport.breakdown.bsMethods.debitCardBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center text-slate-700">
                        <span>Pago Móvil:</span>
                        <span className="font-mono font-bold">Bs. {activeReport.breakdown.bsMethods.pagoMovilBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center text-slate-700">
                        <span>Efectivo Bs:</span>
                        <span className="font-mono font-bold">Bs. {activeReport.breakdown.bsMethods.cashBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className="pt-2 border-t border-blue-200/80 flex flex-col gap-0.5">
                        <div className="flex justify-between items-center font-extrabold text-blue-950">
                          <span>Ingreso Total Bs:</span>
                          <span className="font-mono text-sm text-blue-800">
                            Bs. {activeReport.breakdown.bsMethods.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="text-right text-[11px] font-mono font-bold text-emerald-700">
                          Ref en BCV: ${activeReport.breakdown.bsMethods.totalBsUsdEq.toFixed(2)} USD
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DÓLARES ($ USD) */}
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                      <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span>Efectivo Dólares ($)</span>
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono">
                        USD
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-700">
                        <span>Efectivo USD:</span>
                        <span className="font-mono font-bold">${activeReport.breakdown.usdMethods.cashUsd.toFixed(2)}</span>
                      </div>

                      <div className="pt-8 border-t border-emerald-200/80 flex justify-between items-center font-extrabold text-emerald-950">
                        <span>Ingreso Total USD:</span>
                        <span className="font-mono text-sm text-emerald-800">
                          ${activeReport.breakdown.usdMethods.totalUsd.toFixed(2)} USD
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BINANCE / USDT */}
                  <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                      <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-amber-600" />
                        <span>Binance / Crypto ($)</span>
                      </span>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono">
                        USDT
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-700">
                        <span>Binance Pay:</span>
                        <span className="font-mono font-bold">${activeReport.breakdown.usdtMethods.binanceUsdt.toFixed(2)}</span>
                      </div>

                      <div className="pt-8 border-t border-amber-200/80 flex justify-between items-center font-extrabold text-amber-950">
                        <span>Ingreso Total USDT:</span>
                        <span className="font-mono text-sm text-amber-800">
                          ${activeReport.breakdown.usdtMethods.totalUsdt.toFixed(2)} USDT
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* TOTAL GENERAL COMBINADO */}
                  <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 flex flex-col justify-between shadow-md">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Ingreso Total Combinado
                      </div>
                      <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                        ${activeReport.breakdown.grandTotalUsd.toFixed(2)} USD
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Suma de Ingresos Bs (en USD) + USD Efectivo + USDT
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 flex justify-between">
                      <span>Ventas procesadas:</span>
                      <span className="font-mono font-bold text-white">{activeReport.salesCount} ventas</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* 2. SECCIÓN ESPECIAL: CONTROL DE LA CAJA CHICA (EFECTIVO EN FÍSICO) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Cuadro de Caja Chica & Arqueo Físico de Billetes
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Monto inicial, ingresos de billetes, vueltos entregados y salidas autorizadas
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                    Caja Chica Activa
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  
                  {/* INICIO */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Con cuánto inició</span>
                    <div className="font-mono font-bold text-slate-800">
                      ${activeReport.breakdown.cajaChica.initialUsd.toFixed(2)} USD
                    </div>
                    <div className="font-mono text-slate-600 text-[11px]">
                      Bs. {activeReport.breakdown.cajaChica.initialBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* INGRESOS EFECTIVO */}
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-emerald-700">Ingresado en Efectivo</span>
                    <div className="font-mono font-bold text-emerald-800">
                      +${activeReport.breakdown.cajaChica.cashInflowUsd.toFixed(2)} USD
                    </div>
                    <div className="font-mono text-emerald-700 text-[11px]">
                      +Bs. {activeReport.breakdown.cajaChica.cashInflowBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* VUELTOS Y SALIDAS */}
                  <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-amber-700">Vueltos y Egresos</span>
                    <div className="font-mono font-bold text-amber-800">
                      Vuelto: ${activeReport.breakdown.cajaChica.changeGivenUsd.toFixed(2)} USD
                    </div>
                    <div className="font-mono text-rose-700 text-[11px]">
                      Salidas: -${activeReport.breakdown.cajaChica.outflowsUsd.toFixed(2)} USD / -Bs. {activeReport.breakdown.cajaChica.outflowsBs.toFixed(2)}
                    </div>
                  </div>

                  {/* FINAL EN CAJA CHICA (LO QUE DEBE HABER) */}
                  <div className="bg-emerald-700 text-white p-3.5 rounded-xl space-y-1 shadow-xs">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-100 tracking-wider">
                      TOTAL QUE DEBE HABER EN BILLETES
                    </span>
                    <div className="font-mono font-black text-sm text-white">
                      ${activeReport.breakdown.cajaChica.finalUsd.toFixed(2)} USD
                    </div>
                    <div className="font-mono font-bold text-emerald-100 text-[11px]">
                      Bs. {activeReport.breakdown.cajaChica.finalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                </div>
              </div>

              {/* 3. TABLA SEPARADA DE SALIDAS DE DINERO (EGRESOS REGISTRADOS) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-rose-600" />
                    <h4 className="text-xs font-black text-slate-900 uppercase">
                      Historial de Salidas de Dinero de Caja Chica
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold">
                    Total Egresos: -${activeReport.breakdown.cajaChica.outflowsUsd.toFixed(2)} USD / -Bs. {activeReport.breakdown.cajaChica.outflowsBs.toFixed(2)}
                  </span>
                </div>

                {(!activeReport.outflows || activeReport.outflows.length === 0) ? (
                  <p className="text-center py-4 text-xs text-slate-400 italic">
                    No se han registrado salidas de dinero durante este turno.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                          <th className="py-2 px-3">Hora / Fecha</th>
                          <th className="py-2 px-3">Motivo de la Salida</th>
                          <th className="py-2 px-3">Autorizado Por</th>
                          <th className="py-2 px-3 text-right">Monto USD</th>
                          <th className="py-2 px-3 text-right">Monto Bs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {activeReport.outflows.map((outflow: any, idx: number) => (
                          <tr key={`outflow-${outflow.id || idx}-${idx}`} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {new Date(outflow.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {outflow.reason}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {outflow.authorizedBy || 'Dueño / Administrador'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                              -${(outflow.amountUsd || 0).toFixed(2)} USD
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                              -Bs. {(outflow.amountBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 4. HISTORIAL DE VENTAS Y MOVIMIENTOS ESPECIFICADOS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-black text-slate-900 uppercase">
                      Historial Detallado de Ventas, Ingresos y Vueltos
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    {activeReport.sales.length} transacciones
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                        <th className="py-2 px-3">Hora</th>
                        <th className="py-2 px-3">Factura</th>
                        <th className="py-2 px-3">Cliente</th>
                        <th className="py-2 px-3">Método de Pago</th>
                        <th className="py-2 px-3">Ingreso / Vuelto</th>
                        <th className="py-2 px-3">Descuento / Cargo</th>
                        <th className="py-2 px-3 text-right">Total ($ USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {activeReport.sales.map((sale: any, idx: number) => {
                        const meta = parseSaleMeta(sale.notes);
                        return (
                          <tr key={`report-sale-${sale.id || idx}-${idx}`} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono text-slate-500">
                              {new Date(sale.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              #{sale.invoiceNumber}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              {meta.client ? `${meta.client.name}` : 'Cliente General'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-700">
                                {sale.paymentMethod}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[11px] font-mono">
                              <span className="text-emerald-700 font-bold">Cobrado: ${sale.amountPaid?.toFixed(2) || sale.total.toFixed(2)}</span>
                              {sale.changeDue > 0 && (
                                <span className="text-amber-700 ml-2 font-bold">Vuelto: ${sale.changeDue.toFixed(2)}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[11px]">
                              {meta.discount ? (
                                <span className="text-emerald-700 font-bold flex items-center gap-1">
                                  <Tag className="w-3 h-3" />
                                  -${meta.discount.amount.toFixed(2)} ({meta.discount.description})
                                </span>
                              ) : meta.charge ? (
                                <span className="text-amber-700 font-bold flex items-center gap-1">
                                  <Percent className="w-3 h-3" />
                                  +${meta.charge.amount.toFixed(2)} ({meta.charge.description})
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              ${sale.total.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>
      ) : (
        /* NO ACTIVE SHIFT WARNING BANNER */
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-950 space-y-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-black text-amber-900">
                Caja Cerrada - No hay ningún turno abierto
              </h3>
              <p className="text-xs text-amber-800 mt-1">
                Para que el cajero pueda procesar cobros y ventas en el POS, debe realizar la apertura de un turno de caja indicando el efectivo inicial.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setIsOpenShiftModalOpen(true)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>Abrir Turno Ahora</span>
            </button>
          </div>
        </div>
      )}

      {/* SHIFT REPORT HISTORY & FILTER BY DATE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900">
                Historial de Turnos y Arqueos por Día
              </h3>
              {!canViewOtherShifts && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Solo mis arqueos ({currentUser?.name})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Consulte y descargue reportes detallados de turnos anteriores filtrados por fecha.
            </p>
          </div>

          {/* Date Picker Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-600">Filtrar Fecha:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                loadShiftsList(e.target.value);
              }}
              className="bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Table of past shifts */}
        {filteredShifts.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No se encontraron turnos registrados para el día seleccionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-2.5 px-3"># Turno</th>
                  <th className="py-2.5 px-3">Cajero</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Apertura</th>
                  <th className="py-2.5 px-3">Cierre</th>
                  <th className="py-2.5 px-3 font-mono">Base Inicial</th>
                  <th className="py-2.5 px-3 font-mono">Tasa BCV</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedShifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-black text-slate-900">
                      #{shift.shiftNumber}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {shift.cashierName}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        shift.status === 'OPEN'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {shift.status === 'OPEN' ? 'ABIERTO' : 'CERRADO'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono">
                      {new Date(shift.openedAt).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono">
                      {shift.closedAt ? new Date(shift.closedAt).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">
                      ${shift.initialCashUsd || 0} / Bs. {shift.initialCashBs || 0}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-blue-700">
                      Bs. {shift.bcvRate.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleViewShiftReport(shift.id)}
                        className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        Ver Arqueo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Toolbar (30 turnos por página) */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-slate-600 text-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span>
                  Mostrando <strong className="text-slate-900 font-mono font-bold">
                    {filteredShifts.length === 0 ? 0 : (shiftPage - 1) * shiftPageSize + 1} - {Math.min(shiftPage * shiftPageSize, filteredShifts.length)}
                  </strong> de <strong className="text-slate-900 font-mono font-bold">{filteredShifts.length}</strong> turnos registrados
                </span>
                <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                  30 por lote
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Primera página */}
                <button
                  type="button"
                  onClick={() => setShiftPage(1)}
                  disabled={shiftPage <= 1}
                  className={`p-1.5 rounded-lg border text-xs flex items-center transition-all ${
                    shiftPage <= 1
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
                  onClick={() => setShiftPage((p) => Math.max(1, p - 1))}
                  disabled={shiftPage <= 1}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
                    shiftPage <= 1
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                      : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border-slate-200 shadow-2xs cursor-pointer active:scale-95'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>30 Anteriores</span>
                </button>

                {/* Indicador de página */}
                <div className="px-3 py-1 rounded-lg bg-blue-600 text-white font-mono font-bold text-xs shadow-xs">
                  {shiftPage} / {totalShiftPages}
                </div>

                {/* 30 Siguientes */}
                <button
                  type="button"
                  onClick={() => setShiftPage((p) => Math.min(totalShiftPages, p + 1))}
                  disabled={shiftPage >= totalShiftPages}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
                    shiftPage >= totalShiftPages
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
                  onClick={() => setShiftPage(totalShiftPages)}
                  disabled={shiftPage >= totalShiftPages}
                  className={`p-1.5 rounded-lg border text-xs flex items-center transition-all ${
                    shiftPage >= totalShiftPages
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
        )}
      </div>

      {/* MODAL 1: SECURITY PROMPT FOR OPENING A SHIFT ("¿Seguro que quieres abrir turno?") */}
      {isOpenShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
            
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Apertura de Turno de Caja
                </h3>
                <p className="text-xs text-slate-500">
                  Confirmación de seguridad
                </p>
              </div>
            </div>

            {/* SEGURIDAD PREGUNTA PRINCIPAL */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
              <span className="text-xs font-extrabold uppercase text-emerald-900 tracking-wider">
                ¿Seguro que quieres abrir turno?
              </span>
              <p className="text-[11px] text-emerald-800">
                Al abrir turno, la caja quedará habilitada para registrar cobros y ventas con la tasa BCV del día (Bs. {bcvRate.toFixed(2)}).
              </p>
            </div>

            {/* INPUTS PARA EFECTIVO INICIAL */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nombre de Cajero
                </label>
                <input
                  type="text"
                  value={cashierNameInput}
                  onChange={(e) => setCashierNameInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Efectivo Inicial ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={initialCashUsdInput}
                    onChange={(e) => setInitialCashUsdInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Efectivo Inicial (Bs.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={initialCashBsInput}
                    onChange={(e) => setInitialCashBsInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* BUTTONS "SI" & "NO" */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOpenShiftModalOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                No, Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmOpenShift}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer text-center"
              >
                Sí, Abrir Turno
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: REGISTRAR SALIDA DE DINERO (EGRESO CON CLAVE DEL DUEÑO) */}
      {isOutflowModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl">
                  <ArrowUpRight className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Registrar Salida de Dinero
                  </h3>
                  <p className="text-xs text-slate-500">
                    Egreso de Caja Chica (USD / Bs)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOutflowModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {outflowError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{outflowError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Monto en USD ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={outflowAmountUsdInput}
                    onChange={(e) => setOutflowAmountUsdInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Monto en Bs.
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={outflowAmountBsInput}
                    onChange={(e) => setOutflowAmountBsInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Motivo de la Salida de Dinero
                </label>
                <input
                  type="text"
                  placeholder="Ej. Pago de proveedor de hielo, viáticos, compra de bolsas..."
                  value={outflowReasonInput}
                  onChange={(e) => setOutflowReasonInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-600" />
                    <span>Clave Especial del Dueño</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Default: 1234</span>
                </label>
                <input
                  type="password"
                  placeholder="Ingrese clave especial"
                  value={outflowPasswordInput}
                  onChange={(e) => setOutflowPasswordInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOutflowModalOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleRegisterOutflow}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md shadow-amber-500/20 cursor-pointer"
              >
                Registrar Salida
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: CLOSING SHIFT CONFIRMATION */}
      {isCloseShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
            
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Cierre de Turno & Arqueo
                </h3>
                <p className="text-xs text-slate-500">
                  Turno #{activeShift?.shiftNumber}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              ¿Desea cerrar el turno actual? Una vez cerrado, no se podrán agregar más ventas a este turno y se archivará el reporte de ingresos.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Observaciones o Notas de Cierre (Opcional)
              </label>
              <textarea
                rows={3}
                value={closeNotesInput}
                onChange={(e) => setCloseNotesInput(e.target.value)}
                placeholder="Ej. Cuadre exacto en caja, billete deteriorado reportado..."
                className="w-full bg-slate-50 border border-slate-300 focus:border-rose-600 rounded-xl p-3 text-xs text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCloseShiftModalOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmCloseShift}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer"
              >
                Confirmar Cierre
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 4: SHIFT REPORT PREVIEW & PRINT */}
      {isReportModalOpen && selectedShiftReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 animate-scale-up my-8">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Reporte de Arqueo de Caja #{selectedShiftReport.shift.shiftNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Cajero: {selectedShiftReport.shift.cashierName} • Tasa BCV: Bs. {selectedShiftReport.bcvRate.toFixed(2)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DESGLOSE REPORT DETAILS */}
            <div className="space-y-4 text-xs">
              
              {/* Bs Section */}
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 space-y-2">
                <div className="font-extrabold text-blue-950 uppercase border-b border-blue-200 pb-1">
                  Ingresos en Bolívares (Bs)
                </div>
                <div className="flex justify-between">
                  <span>Tarjeta Débito:</span>
                  <span className="font-mono font-bold">Bs. {selectedShiftReport.breakdown.bsMethods.debitCardBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pago Móvil:</span>
                  <span className="font-mono font-bold">Bs. {selectedShiftReport.breakdown.bsMethods.pagoMovilBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Efectivo Bs:</span>
                  <span className="font-mono font-bold">Bs. {selectedShiftReport.breakdown.bsMethods.cashBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="pt-2 border-t border-blue-200 flex justify-between font-black text-blue-900 text-sm">
                  <span>Ingreso Total Bs:</span>
                  <span className="font-mono">Bs. {selectedShiftReport.breakdown.bsMethods.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} (${selectedShiftReport.breakdown.bsMethods.totalBsUsdEq.toFixed(2)} USD)</span>
                </div>
              </div>

              {/* USD Section */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 space-y-2">
                <div className="font-extrabold text-emerald-950 uppercase border-b border-emerald-200 pb-1">
                  Ingresos en Dólares ($ USD)
                </div>
                <div className="flex justify-between font-black text-emerald-900 text-sm">
                  <span>Efectivo USD:</span>
                  <span className="font-mono">${selectedShiftReport.breakdown.usdMethods.cashUsd.toFixed(2)} USD</span>
                </div>
              </div>

              {/* USDT Section */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 space-y-2">
                <div className="font-extrabold text-amber-950 uppercase border-b border-amber-200 pb-1">
                  Ingresos Crypto / Binance ($ USDT)
                </div>
                <div className="flex justify-between font-black text-amber-900 text-sm">
                  <span>Binance Pay:</span>
                  <span className="font-mono">${selectedShiftReport.breakdown.usdtMethods.binanceUsdt.toFixed(2)} USDT</span>
                </div>
              </div>

              {/* Caja Chica Final */}
              <div className="bg-slate-100 border border-slate-300 rounded-xl p-4 space-y-2">
                <div className="font-extrabold text-slate-900 uppercase border-b border-slate-300 pb-1">
                  Caja Chica & Billetes Esperados
                </div>
                <div className="flex justify-between">
                  <span>Monto Inicial:</span>
                  <span className="font-mono font-bold">${selectedShiftReport.breakdown.cajaChica.initialUsd.toFixed(2)} USD / Bs. {selectedShiftReport.breakdown.cajaChica.initialBs.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>Egresos / Salidas:</span>
                  <span className="font-mono font-bold">-${selectedShiftReport.breakdown.cajaChica.outflowsUsd.toFixed(2)} USD / -Bs. {selectedShiftReport.breakdown.cajaChica.outflowsBs.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-300 flex justify-between font-black text-slate-900 text-sm">
                  <span>Efectivo Final Esperado:</span>
                  <span className="font-mono text-emerald-800">${selectedShiftReport.breakdown.cajaChica.finalUsd.toFixed(2)} USD / Bs. {selectedShiftReport.breakdown.cajaChica.finalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Ingreso Total Arqueo</div>
                  <div className="text-xl font-black font-mono text-emerald-400">
                    ${selectedShiftReport.breakdown.grandTotalUsd.toFixed(2)} USD
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-300 font-mono">{selectedShiftReport.salesCount} ventas registradas</span>
                </div>
              </div>

            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Arqueo</span>
              </button>

              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
