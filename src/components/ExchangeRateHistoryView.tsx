import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Download,
  Printer,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  Trash2,
  Database,
  DollarSign,
  Coins,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  Zap,
  Sliders,
  CalendarRange,
  Edit3,
  Play,
  Pause,
  Timer,
  Info,
  Layers,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  ExchangeRateHistoryItem,
  ExchangeRateHistoryStats,
  RateScheduleItem,
  RateConfigData,
  ActiveRateEvaluation,
  AppUser
} from '../types';
import { safeFetchJson } from '../utils/api';

interface ExchangeRateHistoryViewProps {
  currentUser?: AppUser | null;
  onRefreshLiveBcv?: () => Promise<void>;
  initialTab?: 'history' | 'schedules';
}

export const ExchangeRateHistoryView: React.FC<ExchangeRateHistoryViewProps> = ({
  currentUser,
  onRefreshLiveBcv,
  initialTab = 'history',
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'history' | 'schedules'>(initialTab);

  // History State
  const [historyItems, setHistoryItems] = useState<ExchangeRateHistoryItem[]>([]);
  const [stats, setStats] = useState<ExchangeRateHistoryStats | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters for History
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'OFFICIAL' | 'MANUAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination for Rate History (split into BCV and Scripts tables, 15 records per page)
  const [bcvPage, setBcvPage] = useState<number>(1);
  const [scriptPage, setScriptPage] = useState<number>(1);
  const [historyPageSize] = useState<number>(15);

  // Add Manual Rate Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formUsdRate, setFormUsdRate] = useState('');
  const [formEurRate, setFormEurRate] = useState('');
  const [formUsdtRate, setFormUsdtRate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Delete Confirmation
  const [itemToDelete, setItemToDelete] = useState<ExchangeRateHistoryItem | null>(null);

  // Schedules & Config State
  const [schedules, setSchedules] = useState<RateScheduleItem[]>([]);
  const [rateConfig, setRateConfig] = useState<RateConfigData | null>(null);
  const [evaluation, setEvaluation] = useState<ActiveRateEvaluation | null>(null);
  const [liveRates, setLiveRates] = useState<{ usdRate: number; eurRate: number; usdtRate: number }>({
    usdRate: 849.56,
    eurRate: 974.09,
    usdtRate: 953.1,
  });
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Schedule Modal (Create / Edit)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleCurrencyTarget, setScheduleCurrencyTarget] = useState<'USD' | 'EUR' | 'USDT' | 'CUSTOM'>('EUR');
  const [scheduleCustomRate, setScheduleCustomRate] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('09:00');
  const [scheduleEndTime, setScheduleEndTime] = useState('10:00');
  const [scheduleDurationType, setScheduleDurationType] = useState<'INDEFINITE' | 'DATE_RANGE'>('INDEFINITE');
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleEndDate, setScheduleEndDate] = useState('');
  const [scheduleDaysOfWeek, setScheduleDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [schedulePriority, setSchedulePriority] = useState(1);
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

  // Schedule to Delete Confirmation
  const [scheduleToDelete, setScheduleToDelete] = useState<RateScheduleItem | null>(null);

  // Simulator State
  const [simulatorTime, setSimulatorTime] = useState('09:30');
  const [simulatedResult, setSimulatedResult] = useState<{
    matchedRule: RateScheduleItem | null;
    targetCurrency: string;
    effectiveRate: number;
  } | null>(null);

  const isAdmin = !currentUser || currentUser.isAdmin || currentUser.role === 'ADMIN' || currentUser.role === 'Administrador';

  // Live Clock for evaluation display
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState(() => new Date().toLocaleTimeString('es-VE'));
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeDisplay(new Date().toLocaleTimeString('es-VE'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch History on filters change
  useEffect(() => {
    fetchHistory();
  }, [startDate, endDate, sourceFilter]);

  // Fetch Schedules & Config
  useEffect(() => {
    fetchSchedulesAndConfig();
  }, []);

  // Periodic evaluation update (every 20 seconds)
  useEffect(() => {
    const evalTimer = setInterval(() => {
      refreshEvaluation();
    }, 20000);
    return () => clearInterval(evalTimer);
  }, []);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await safeFetchJson<{
        items?: ExchangeRateHistoryItem[];
        data?: ExchangeRateHistoryItem[];
        stats?: ExchangeRateHistoryStats;
      }>(`/api/v1/bcv/history?${params.toString()}`);

      if (res.ok && res.data) {
        const items = Array.isArray(res.data)
          ? res.data
          : (res.data.items || res.data.data || []);
        setHistoryItems(items);
        const statsObj = res.rawJson?.stats || res.data.stats;
        if (statsObj) {
          setStats(statsObj);
        }
      } else {
        setErrorMsg(res.error || 'No se pudo obtener el historial de tasas');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchSchedulesAndConfig = async () => {
    setIsLoadingSchedules(true);
    try {
      const [configRes, schedulesRes] = await Promise.all([
        safeFetchJson<{ config: RateConfigData; evaluation: ActiveRateEvaluation; rates: any }>('/api/v1/bcv/config'),
        safeFetchJson<RateScheduleItem[]>('/api/v1/bcv/schedules'),
      ]);

      if (configRes.ok && configRes.data) {
        setRateConfig(configRes.data.config);
        setEvaluation(configRes.data.evaluation);
        if (configRes.data.rates) {
          setLiveRates(configRes.data.rates);
        }
      }

      if (schedulesRes.ok && Array.isArray(schedulesRes.data)) {
        setSchedules(schedulesRes.data);
      }
    } catch (err: any) {
      console.warn('Error cargando configuración de horarios:', err);
    } finally {
      setIsLoadingSchedules(false);
    }
  };

  const refreshEvaluation = async () => {
    try {
      const res = await safeFetchJson<ActiveRateEvaluation>('/api/v1/bcv/evaluate');
      if (res.ok && res.data) {
        setEvaluation(res.data);
      }
    } catch {
      // silent
    }
  };

  const handleSyncLive = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await safeFetchJson<any>('/api/v1/bcv/sync', { method: 'POST' });
      if (res.ok) {
        setSuccessMsg('Tasas oficiales sincronizadas en tiempo real desde la API Base44');
        if (onRefreshLiveBcv) {
          await onRefreshLiveBcv();
        }
        await Promise.all([fetchHistory(), fetchSchedulesAndConfig()]);
      } else {
        setErrorMsg(res.error || 'No se pudo sincronizar la tasa');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con la API de sincronización');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRegisterCurrentRate = () => {
    const activeRate = evaluation?.effectiveRate || stats?.currentRate || liveRates.usdRate;
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormUsdRate(activeRate ? activeRate.toString() : '849.56');
    setFormEurRate(liveRates.eurRate ? liveRates.eurRate.toString() : '');
    setFormUsdtRate(liveRates.usdtRate ? liveRates.usdtRate.toString() : '');
    setFormNotes(`Registro manual de tasa actual activa (Bs. ${activeRate})`);
    setIsAddModalOpen(true);
  };

  const handleSaveManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = parseFloat(formUsdRate);
    if (!rateNum || isNaN(rateNum) || rateNum <= 0) {
      setErrorMsg('Ingrese un valor de tasa USD válido');
      return;
    }

    setIsSubmittingManual(true);
    setErrorMsg(null);
    try {
      const payload = {
        rateDate: formDate ? new Date(`${formDate}T12:00:00Z`).toISOString() : new Date().toISOString(),
        usdRate: rateNum,
        eurRate: formEurRate ? parseFloat(formEurRate) : null,
        usdtRate: formUsdtRate ? parseFloat(formUsdtRate) : null,
        notes: formNotes || 'Ajuste manual registrado',
        userName: currentUser?.name || 'Administrador',
      };

      const res = await safeFetchJson<any>('/api/v1/bcv/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccessMsg(`Tasa histórica de Bs. ${rateNum.toFixed(2)} guardada exitosamente`);
        setIsAddModalOpen(false);
        setFormUsdRate('');
        setFormEurRate('');
        setFormUsdtRate('');
        setFormNotes('');
        await fetchHistory();
        if (onRefreshLiveBcv) onRefreshLiveBcv();
      } else {
        setErrorMsg(res.error || 'No se pudo guardar la tasa');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la tasa histórica');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      const res = await safeFetchJson<any>(`/api/v1/bcv/history/${itemToDelete.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSuccessMsg('Registro eliminado del historial');
        setItemToDelete(null);
        await fetchHistory();
      } else {
        setErrorMsg(res.error || 'No se pudo eliminar el registro');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar');
    }
  };

  // Schedule & Configuration Handlers
  const handleUpdateActiveCurrency = async (newMode: 'USD' | 'EUR' | 'USDT' | 'SCHEDULED' | 'CUSTOM', customVal?: number) => {
    setIsSavingConfig(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await safeFetchJson<any>('/api/v1/bcv/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeCurrency: newMode,
          customFixedRate: customVal !== undefined ? customVal : rateConfig?.customFixedRate,
        }),
      });

      if (res.ok && res.data) {
        setRateConfig(res.data.config);
        setEvaluation(res.data.evaluation);

        if (newMode === 'SCHEDULED') {
          sessionStorage.setItem(
            'script_activated_flash',
            '⚡ Modo Programador por Horario activado. Sistema refrescado automáticamente para sincronizar el POS.'
          );
          window.location.reload();
          return;
        }

        const labels: Record<string, string> = {
          USD: 'Dólar BCV Oficial seleccionado como cotización activa',
          EUR: 'Euro Oficial BCV seleccionado como cotización activa',
          USDT: 'USDT Cripto seleccionado como cotización activa',
          CUSTOM: 'Tasa fija personalizada activada',
        };
        setSuccessMsg(labels[newMode] || 'Configuración actualizada');
        if (onRefreshLiveBcv) onRefreshLiveBcv();
      } else {
        setErrorMsg(res.error || 'Error al actualizar configuración');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleToggleSchedule = async (schedule: RateScheduleItem) => {
    const nextState = !schedule.isActive;
    try {
      const res = await safeFetchJson<any>(`/api/v1/bcv/schedules/${schedule.id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextState }),
      });

      if (res.ok) {
        if (nextState) {
          // As requested by user: automatic reload (F5) so everything in the system and POS is active
          sessionStorage.setItem(
            'script_activated_flash',
            `⚡ Script "${schedule.name}" activado exitosamente. Sistema refrescado automáticamente para aplicar la tasa en el POS.`
          );
          window.location.reload();
          return;
        }

        setSchedules((prev) =>
          prev.map((s) => (s.id === schedule.id ? { ...s, isActive: nextState } : s))
        );
        await refreshEvaluation();
        if (onRefreshLiveBcv) onRefreshLiveBcv();
        setSuccessMsg(`Script "${schedule.name}" desactivado`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al modificar estado del script');
    }
  };

  const handleOpenCreateSchedule = () => {
    setEditingScheduleId(null);
    setScheduleName('');
    setScheduleCurrencyTarget('EUR');
    setScheduleCustomRate('');
    setScheduleStartTime('09:00');
    setScheduleEndTime('10:00');
    setScheduleDurationType('INDEFINITE');
    setScheduleStartDate('');
    setScheduleEndDate('');
    setScheduleDaysOfWeek([0, 1, 2, 3, 4, 5, 6]);
    setScheduleNotes('');
    setSchedulePriority(schedules.length + 1);
    setIsScheduleModalOpen(true);
  };

  const handleOpenEditSchedule = (item: RateScheduleItem) => {
    setEditingScheduleId(item.id);
    setScheduleName(item.name);
    setScheduleCurrencyTarget(item.currencyTarget);
    setScheduleCustomRate(item.customRateValue ? item.customRateValue.toString() : '');
    setScheduleStartTime(item.startTime);
    setScheduleEndTime(item.endTime);
    setScheduleDurationType(item.durationType);
    setScheduleStartDate(item.startDate ? item.startDate.split('T')[0] : '');
    setScheduleEndDate(item.endDate ? item.endDate.split('T')[0] : '');
    setScheduleDaysOfWeek(item.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]);
    setScheduleNotes(item.notes || '');
    setSchedulePriority(item.priority || 1);
    setIsScheduleModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleName.trim() || !scheduleStartTime || !scheduleEndTime) {
      setErrorMsg('Complete el nombre, hora de inicio y fin');
      return;
    }

    setIsSubmittingSchedule(true);
    setErrorMsg(null);
    try {
      const payload = {
        name: scheduleName.trim(),
        currencyTarget: scheduleCurrencyTarget,
        customRateValue: scheduleCurrencyTarget === 'CUSTOM' ? parseFloat(scheduleCustomRate) || null : null,
        startTime: scheduleStartTime,
        endTime: scheduleEndTime,
        durationType: scheduleDurationType,
        startDate: scheduleDurationType === 'DATE_RANGE' && scheduleStartDate ? scheduleStartDate : null,
        endDate: scheduleDurationType === 'DATE_RANGE' && scheduleEndDate ? scheduleEndDate : null,
        daysOfWeek: scheduleDaysOfWeek,
        priority: schedulePriority,
        notes: scheduleNotes,
      };

      const url = editingScheduleId
        ? `/api/v1/bcv/schedules/${editingScheduleId}`
        : '/api/v1/bcv/schedules';
      const method = editingScheduleId ? 'PUT' : 'POST';

      const res = await safeFetchJson<any>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        sessionStorage.setItem(
          'script_activated_flash',
          `⚡ Script de horario "${scheduleName}" guardado y activado. Sistema refrescado automáticamente para aplicar la tasa en el POS.`
        );
        window.location.reload();
        return;
      } else {
        setErrorMsg(res.error || 'Error al guardar el script de horario');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar script');
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!scheduleToDelete) return;
    try {
      const res = await safeFetchJson<any>(`/api/v1/bcv/schedules/${scheduleToDelete.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSuccessMsg('Script de horario eliminado');
        setScheduleToDelete(null);
        await Promise.all([fetchSchedulesAndConfig(), refreshEvaluation()]);
        if (onRefreshLiveBcv) onRefreshLiveBcv();
      } else {
        setErrorMsg(res.error || 'No se pudo eliminar el script');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar');
    }
  };

  // Run Schedule Simulator
  const runSimulator = () => {
    if (!simulatorTime) return;
    const testTime = simulatorTime; // HH:mm
    const now = new Date();
    const dayOfWeek = now.getDay();

    let matched: RateScheduleItem | null = null;
    for (const s of schedules) {
      if (!s.isActive) continue;
      if (s.durationType === 'DATE_RANGE') {
        if (s.startDate && now < new Date(s.startDate)) continue;
        if (s.endDate && now > new Date(s.endDate)) continue;
      }
      if (s.daysOfWeek && !s.daysOfWeek.includes(dayOfWeek)) continue;

      const isInside =
        s.startTime <= s.endTime
          ? testTime >= s.startTime && testTime < s.endTime
          : testTime >= s.startTime || testTime < s.endTime;

      if (isInside) {
        matched = s;
        break;
      }
    }

    if (matched) {
      let r = liveRates.usdRate;
      if (matched.currencyTarget === 'EUR') r = liveRates.eurRate;
      else if (matched.currencyTarget === 'USDT') r = liveRates.usdtRate;
      else if (matched.currencyTarget === 'CUSTOM') r = matched.customRateValue || liveRates.usdRate;

      setSimulatedResult({
        matchedRule: matched,
        targetCurrency: matched.currencyTarget,
        effectiveRate: r,
      });
    } else {
      const fb = rateConfig?.fallbackCurrency || 'USD';
      let r = liveRates.usdRate;
      if (fb === 'EUR') r = liveRates.eurRate;
      else if (fb === 'USDT') r = liveRates.usdtRate;

      setSimulatedResult({
        matchedRule: null,
        targetCurrency: fb,
        effectiveRate: r,
      });
    }
  };

  const handleExportCSV = () => {
    if (historyItems.length === 0) return;
    const headers = ['Fecha', 'Hora', 'Tasa USD (Bs)', 'Tasa EUR (Bs)', 'Tasa USDT (Bs)', 'Variación (%)', 'Origen', 'Responsable', 'Notas'];
    const rows = historyItems.map((item) => {
      const d = new Date(item.rateDate);
      return [
        d.toLocaleDateString('es-VE'),
        d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
        item.usdRate.toFixed(2),
        item.eurRate ? item.eurRate.toFixed(2) : '',
        item.usdtRate ? item.usdtRate.toFixed(2) : '',
        item.variation !== null && item.variation !== undefined ? `${item.variation > 0 ? '+' : ''}${item.variation.toFixed(2)}%` : '0%',
        `"${item.source.replace(/"/g, '""')}"`,
        `"${(item.userName || '').replace(/"/g, '""')}"`,
        `"${(item.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `historial_tasas_cambio_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter client-side search query
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return historyItems;
    const q = searchQuery.toLowerCase();
    return historyItems.filter((item) => {
      const dateStr = new Date(item.rateDate).toLocaleDateString('es-VE');
      return (
        dateStr.includes(q) ||
        item.usdRate.toString().includes(q) ||
        (item.source || '').toLowerCase().includes(q) ||
        (item.userName || '').toLowerCase().includes(q) ||
        (item.notes || '').toLowerCase().includes(q) ||
        (item.dateLabel || '').toLowerCase().includes(q)
      );
    });
  }, [historyItems, searchQuery]);

  // Split into BCV Rates list and Scheduled Scripts list (Filtered to show only Base44 API)
  const bcvFilteredList = useMemo(() => {
    return filteredList.filter(
      (item) => item.source.toLowerCase().includes('base44') || item.source.toLowerCase().includes('oficial bcv')
    ).filter(
      (item) => !item.source.startsWith('Script:') && item.source !== 'Horario Base (Fallback)'
    );
  }, [filteredList]);

  const scriptFilteredList = useMemo(() => {
    return filteredList.filter(
      (item) => item.source.startsWith('Script:') || item.source === 'Horario Base (Fallback)'
    );
  }, [filteredList]);

  // Paginated list for BCV table (15 items per page)
  const bcvTotalPages = Math.max(1, Math.ceil(bcvFilteredList.length / historyPageSize));
  const paginatedBcvList = useMemo(() => {
    const start = (bcvPage - 1) * historyPageSize;
    return bcvFilteredList.slice(start, start + historyPageSize);
  }, [bcvFilteredList, bcvPage, historyPageSize]);

  // Paginated list for Scripts table (15 items per page)
  const scriptTotalPages = Math.max(1, Math.ceil(scriptFilteredList.length / historyPageSize));
  const paginatedScriptList = useMemo(() => {
    const start = (scriptPage - 1) * historyPageSize;
    return scriptFilteredList.slice(start, start + historyPageSize);
  }, [scriptFilteredList, scriptPage, historyPageSize]);

  // Chart data (chronological ascending)
  const chartData = useMemo(() => {
    return [...filteredList]
      .reverse()
      .slice(-30)
      .map((item) => {
        const d = new Date(item.rateDate);
        return {
          fecha: d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }),
          usd: item.usdRate,
          eur: item.eurRate || Math.round(item.usdRate * 1.092 * 100) / 100,
          usdt: item.usdtRate || Math.round(item.usdRate * 1.045 * 100) / 100,
        };
      });
  }, [filteredList]);

  return (
    <div className="space-y-6 animate-fade-in p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Historial y Automatización de Tasas
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                En Vivo (Base44 API)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Bitácora detallada de cuándo se ejecutaron los scripts de tasas, cambios automáticos de cotización y ajustes manuales
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncLive}
            disabled={isSyncing}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar en Vivo'}</span>
          </button>

          {activeMainTab === 'history' && (
            <>
              <button
                type="button"
                onClick={handleRegisterCurrentRate}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="Registrar manualmente la tasa de cambio actual activa en el historial"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                <span>📌 Guardar Tasa Actual</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Otra Tasa</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={historyItems.length === 0}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Exportar a CSV"
              >
                <Download className="w-4 h-4 text-slate-600" />
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Imprimir Historial"
              >
                <Printer className="w-4 h-4 text-slate-600" />
              </button>
            </>
          )}

          {activeMainTab === 'schedules' && (
            <button
              type="button"
              onClick={handleOpenCreateSchedule}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Script de Horario</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs (History vs Schedules) */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl px-3 pt-2 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveMainTab('history')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeMainTab === 'history'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Bitácora de Ejecución de Scripts</span>
          <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px]">
            {historyItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('schedules')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeMainTab === 'schedules'
              ? 'border-amber-500 text-amber-800 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-500" />
          <span>Programador de Horarios & Scripts de Tasas</span>
          {evaluation?.isFromSchedule && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] animate-pulse">
              ⚡ Activo
            </span>
          )}
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-center justify-between gap-2 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer font-bold"
          >
            ×
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs flex items-center justify-between gap-2 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-600 hover:text-rose-900 cursor-pointer font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* TAB 1: HISTORIAL DE TASAS DIARIAS */}
      {activeMainTab === 'history' && (
        <>
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Tasa Actual USD
              </span>
              <div className="text-xl font-black font-mono text-blue-700 mt-1">
                Bs. {(stats?.currentRate || liveRates.usdRate).toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Banco Central de Venezuela</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Tasa Actual EUR
              </span>
              <div className="text-xl font-black font-mono text-indigo-700 mt-1">
                Bs. {liveRates.eurRate.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Cotización Oficial Euro</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Tasa USDT Cripto
              </span>
              <div className="text-xl font-black font-mono text-emerald-700 mt-1">
                Bs. {liveRates.usdtRate.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Referencia Paralelo / Cripto</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Tasa Máxima Registrada
              </span>
              <div className="text-xl font-black font-mono text-slate-800 mt-1">
                Bs. {(stats?.maxRate || liveRates.usdRate).toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">En el periodo analizado</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Tasa Mínima Registrada
              </span>
              <div className="text-xl font-black font-mono text-slate-800 mt-1">
                Bs. {(stats?.minRate || liveRates.usdRate).toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">En el periodo analizado</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Variación del Periodo
              </span>
              <div className={`text-xl font-black font-mono mt-1 flex items-center gap-1 ${
                (stats?.periodVariation || 0) >= 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}>
                {(stats?.periodVariation || 0) >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                <span>{Math.abs(stats?.periodVariation || 0).toFixed(2)}%</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Desde el registro más antiguo</span>
            </div>
          </div>

          {/* Area Chart: Tendencia de Tasas USD vs EUR */}
          {chartData.length > 2 && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Evolución Cronológica de Cotizaciones Diarias (Últimos 30 Registros)
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span className="text-slate-600">USD BCV</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span className="text-slate-600">EUR BCV</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600">USDT Paralelo</span>
                  </span>
                </div>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorUsd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorEur" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${Math.round(v)}`}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        `Bs. ${Number(val).toFixed(2)}`,
                        name === 'usd' ? 'USD BCV' : name === 'eur' ? 'EUR BCV' : 'USDT',
                      ]}
                      labelFormatter={(l) => `Fecha: ${l}`}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '11px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Area type="monotone" dataKey="eur" stroke="#6366f1" strokeWidth={1.5} fillOpacity={1} fill="url(#colorEur)" />
                    <Area type="monotone" dataKey="usd" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorUsd)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-bold text-slate-700">Filtros:</span>
              </div>

              {/* Date pickers */}
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-blue-500"
                  title="Fecha inicial"
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-blue-500"
                  title="Fecha final"
                />
              </div>

              {/* Source Filter */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSourceFilter('ALL')}
                  className={`px-2.5 py-1 font-semibold transition-colors cursor-pointer ${
                    sourceFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setSourceFilter('OFFICIAL')}
                  className={`px-2.5 py-1 font-semibold transition-colors cursor-pointer border-l border-slate-200 ${
                    sourceFilter === 'OFFICIAL' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Oficiales BCV
                </button>
                <button
                  type="button"
                  onClick={() => setSourceFilter('MANUAL')}
                  className={`px-2.5 py-1 font-semibold transition-colors cursor-pointer border-l border-slate-200 ${
                    sourceFilter === 'MANUAL' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Ajustes Manuales
                </button>
              </div>

              {(startDate || endDate || sourceFilter !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setSourceFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline text-[11px]"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar en historial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* SECCIÓN 1: TABLA DE CAMBIOS EN EL BCV Y AJUSTES MANUALES */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-2">
            <div className="bg-slate-50/50 px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    1. Registro de Tasas BCV y Ajustes Manuales
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cambios de cotización oficial del Banco Central de Venezuela y fijaciones manuales del administrador
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                {bcvFilteredList.length} registros
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">USD Oficial</th>
                    <th className="py-3 px-4">EUR Oficial</th>
                    <th className="py-3 px-4">USDT Cripto</th>
                    <th className="py-3 px-4">Variación USD</th>
                    <th className="py-3 px-4">Origen / Método</th>
                    <th className="py-3 px-4">Responsable</th>
                    <th className="py-3 px-4">Notas y Detalles</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Acción</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingHistory ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        <span>Cargando tasas y ajustes manuales...</span>
                      </td>
                    </tr>
                  ) : paginatedBcvList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <span className="font-semibold text-slate-600 block">No hay tasas de referencia registradas</span>
                      </td>
                    </tr>
                  ) : (
                    paginatedBcvList.map((item) => {
                      const d = new Date(item.rateDate);
                      const isUp = item.variation && item.variation > 0;
                      const isDown = item.variation && item.variation < 0;

                      return (
                        <tr key={`bcv-row-${item.id}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">
                              {d.toLocaleDateString('es-VE', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-black font-mono text-blue-700">
                            Bs. {item.usdRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            Bs. {(item.eurRate || item.usdRate * 1.092).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            Bs. {(item.usdtRate || item.usdRate * 1.045).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4">
                            {item.variation !== null && item.variation !== undefined ? (
                              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                                isUp ? 'bg-rose-50 text-rose-700 border border-rose-200' : isDown ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {isUp ? '+' : ''}{item.variation.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                              item.isManual ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-slate-100 text-slate-800 border border-slate-200'
                            }`}>
                              {item.isManual ? <Sliders className="w-2.5 h-2.5 text-blue-600" /> : <Database className="w-2.5 h-2.5 text-slate-500" />}
                              <span>{item.source}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-700">
                            {item.userName || 'Sistema'}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px] max-w-[200px] truncate" title={item.notes || ''}>
                            {item.notes || '-'}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setItemToDelete(item)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación Tabla 1 */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-slate-600 text-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <span>
                Mostrando <strong className="text-slate-900 font-mono font-bold">
                  {bcvFilteredList.length === 0 ? 0 : (bcvPage - 1) * historyPageSize + 1} - {Math.min(bcvPage * historyPageSize, bcvFilteredList.length)}
                </strong> de <strong className="text-slate-900 font-mono font-bold">{bcvFilteredList.length}</strong> tasas oficiales/manuales
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBcvPage(1)}
                  disabled={bcvPage <= 1 || isLoadingHistory}
                  className={`p-1.5 rounded-lg border text-xs flex items-center transition-all ${
                    bcvPage <= 1 || isLoadingHistory ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' : 'bg-white text-slate-700 hover:bg-blue-50 border-slate-200 cursor-pointer shadow-2xs'
                  }`}
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setBcvPage(p => Math.max(1, p - 1))}
                  disabled={bcvPage <= 1 || isLoadingHistory}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
                    bcvPage <= 1 || isLoadingHistory ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' : 'bg-white text-slate-700 hover:bg-blue-50 border-slate-200 cursor-pointer shadow-2xs'
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
                <div className="px-3 py-1 rounded-lg bg-blue-600 text-white font-mono font-bold text-xs shadow-xs">
                  {bcvPage} / {bcvTotalPages}
                </div>
                <button
                  type="button"
                  onClick={() => setBcvPage(p => Math.min(bcvTotalPages, p + 1))}
                  disabled={bcvPage >= bcvTotalPages || isLoadingHistory}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
                    bcvPage >= bcvTotalPages || isLoadingHistory ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' : 'bg-white text-slate-700 hover:bg-blue-50 border-slate-200 cursor-pointer shadow-2xs'
                  }`}
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setBcvPage(bcvTotalPages)}
                  disabled={bcvPage >= bcvTotalPages || isLoadingHistory}
                  className={`p-1.5 rounded-lg border text-xs flex items-center transition-all ${
                    bcvPage >= bcvTotalPages || isLoadingHistory ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' : 'bg-white text-slate-700 hover:bg-blue-50 border-slate-200 cursor-pointer shadow-2xs'
                  }`}
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: TABLA DE CAMBIOS DE PROGRAMACIÓN DE SCRIPTS (HORARIOS) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-2">
            <div className="bg-slate-50/50 px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Zap className="w-4 h-4 text-amber-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    2. Bitácora de Ejecución Automática de Scripts de Horarios
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Historial de cuándo se activó o revirtió automáticamente cada script de tasa programado en el sistema
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                {scriptFilteredList.length} ejecuciones
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Fecha y Hora de Ejecución</th>
                    <th className="py-3 px-4">Horario (Inicio - Fin)</th>
                    <th className="py-3 px-4">Tasa Activa Aplicada</th>
                    <th className="py-3 px-4">Dólar Base (USD)</th>
                    <th className="py-3 px-4">Euro Base (EUR)</th>
                    <th className="py-3 px-4">USDT Base (USDT)</th>
                    <th className="py-3 px-4">Script de Horario / Evento</th>
                    <th className="py-3 px-4">Responsable</th>
                    <th className="py-3 px-4">Detalles y Log de Ejecución</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Acción</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingHistory ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        <span>Cargando bitácora de scripts...</span>
                      </td>
                    </tr>
                  ) : paginatedScriptList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <Zap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <span className="font-semibold text-slate-600 block">No se han registrado transiciones de scripts</span>
                        <span className="text-[11px] text-slate-400 mt-1 block">Active los horarios de tasas para ver logs automáticos aquí</span>
                      </td>
                    </tr>
                  ) : (
                    paginatedScriptList.map((item) => {
                      const d = new Date(item.rateDate);
                      const isEur = item.source.toLowerCase().includes('euro') || (item.notes || '').toLowerCase().includes('euro') || (item.notes || '').toLowerCase().includes('eur');
                      const isUsdt = item.source.toLowerCase().includes('usdt') || (item.notes || '').toLowerCase().includes('usdt');
                      const activeRateValue = isEur 
                        ? (item.eurRate || item.usdRate * 1.092) 
                        : isUsdt 
                        ? (item.usdtRate || item.usdRate * 1.045) 
                        : item.usdRate;
                      const activeRateCurrency = isEur ? 'EUR Oficial (€)' : isUsdt ? 'USDT Cripto (₮)' : 'USD BCV ($)';

                      return (
                        <tr key={`script-row-${item.id}`} className="hover:bg-amber-50/10 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">
                              {d.toLocaleDateString('es-VE', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                              <Clock className="w-2.5 h-2.5 text-slate-400" />
                              <span>{d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {item.dateLabel && item.dateLabel !== 'Fuera de ventana' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10px] font-bold">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>{item.dateLabel}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono text-[10px] font-medium">
                                <span>Fuera de ventana</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-black font-mono text-sm text-amber-700">
                            Bs. {activeRateValue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">{activeRateCurrency}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            Bs. {item.usdRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            Bs. {(item.eurRate || item.usdRate * 1.092).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            Bs. {(item.usdtRate || item.usdRate * 1.045).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Zap className="w-2.5 h-2.5 text-amber-600 animate-pulse" />
                              <span>{item.source}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700">
                            {item.userName || 'Sistema'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-[11px] leading-relaxed max-w-[280px]" title={item.notes || ''}>
                            {item.notes || '-'}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setItemToDelete(item)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación Tabla 2 */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-slate-600 text-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <span>
                Mostrando <strong className="text-slate-900 font-mono font-bold">
                  {scriptFilteredList.length === 0 ? 0 : (scriptPage - 1) * historyPageSize + 1} - {Math.min(scriptPage * historyPageSize, scriptFilteredList.length)}
                </strong> de <strong className="text-slate-900 font-mono font-bold">{scriptFilteredList.length}</strong> transiciones de horarios
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setScriptPage(1)}
                  disabled={scriptPage <= 1 || isLoadingHistory}
                  className={`p-1.5 rounded-lg border text-xs flex items-center transition-all ${
                    scriptPage <= 1 || isLoadingHistory ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' : 'bg-white text-slate-700 hover:bg-blue-50 border-slate-200 cursor-pointer shadow-2xs'
                  }`}
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setScriptPage(p => Math.max(1, p - 1))}
                  disabled={scriptPage <= 1 || isLoadingHistory}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
                    scriptPage <= 1 || isLoadingHistory ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' : 'bg-white text-slate-700 hover:bg-blue-50 border-slate-200 cursor-pointer shadow-2xs'
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
                <div className="px-3 py-1 rounded-lg bg-blue-600 text-white font-mono font-bold text-xs shadow-xs">
                  {scriptPage} / {scriptTotalPages}
                </div>
                <button
                  type="button"
                  onClick={() => setScriptPage(p => Math.min(scriptTotalPages, p + 1))}
                  disabled={scriptPage >= scriptTotalPages || isLoadingHistory}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
                    scriptPage >= scriptTotalPages || isLoadingHistory ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' : 'bg-white text-slate-700 hover:bg-blue-50 border-slate-200 cursor-pointer shadow-2xs'
                  }`}
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setScriptPage(scriptTotalPages)}
                  disabled={scriptPage >= scriptTotalPages || isLoadingHistory}
                  className={`p-1.5 rounded-lg border text-xs flex items-center transition-all ${
                    scriptPage >= scriptTotalPages || isLoadingHistory ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' : 'bg-white text-slate-700 hover:bg-blue-50 border-slate-200 cursor-pointer shadow-2xs'
                  }`}
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: PROGRAMADOR DE HORARIOS & SCRIPTS DE TASAS */}
      {activeMainTab === 'schedules' && (
        <div className="space-y-6">
          {/* Live Scheduler Banner */}
          <div className="bg-gradient-to-br from-amber-50 via-orange-50/60 to-white border-2 border-amber-300 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping shrink-0" />
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider">
                    Motor Dinámico de Horarios
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Hora local: {currentTimeDisplay}
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Tasa Activa en el Sistema:{' '}
                  <span className="text-amber-800 font-mono">
                    Bs. {(evaluation?.effectiveRate || liveRates.usdRate).toFixed(2)}
                  </span>
                </h2>
                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    {evaluation?.isFromSchedule ? (
                      <>
                        Script en ejecución:{' '}
                        <strong className="text-slate-900 font-bold">{evaluation.activeScheduleName}</strong>{' '}
                        ({evaluation.activeScheduleWindow}) • Aplicando cotización{' '}
                        <span className="font-bold text-amber-700">{evaluation.currencyName}</span>.
                      </>
                    ) : (
                      <>
                        Modo actual:{' '}
                        <strong className="text-slate-900 font-bold">
                          {rateConfig?.activeCurrency === 'SCHEDULED'
                            ? `Horario Base (${rateConfig?.fallbackCurrency || 'USD'}) - Fuera de ventana`
                            : evaluation?.currencyName || 'Dólar BCV'}
                        </strong>
                        .
                      </>
                    )}
                  </span>
                </p>
              </div>

              {evaluation?.nextScheduleSwitch && (
                <div className="bg-white/80 border border-amber-200 rounded-xl p-3 text-right shrink-0">
                  <span className="text-[10px] font-bold text-amber-700 block uppercase">Próximo Cambio Automático:</span>
                  <div className="text-sm font-black font-mono text-slate-900 flex items-center justify-end gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>{evaluation.nextScheduleSwitch.time}</span>
                    <span className="text-slate-400 text-xs">→</span>
                    <span className="text-blue-700">{evaluation.nextScheduleSwitch.targetCurrency}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 truncate block max-w-[200px]">
                    {evaluation.nextScheduleSwitch.scheduleName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Selector de Modo de Cotización Principal */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Seleccionar Modo de Tasa Activa para la Operación Comercial
                </h3>
                <p className="text-xs text-slate-500">
                  Indique qué tasa o automatización utilizará el Punto de Venta (POS), Facturación y Cobranzas:
                </p>
              </div>
              {isSavingConfig && (
                <span className="text-xs text-blue-600 font-bold flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Guardando...
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Option 1: Dólar BCV */}
              <div
                onClick={() => handleUpdateActiveCurrency('USD')}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                  rateConfig?.activeCurrency === 'USD'
                    ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold font-mono">
                    $
                  </div>
                  {rateConfig?.activeCurrency === 'USD' && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                      ACTIVA
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-bold text-slate-900">Dólar BCV Oficial</h4>
                <div className="text-lg font-black font-mono text-blue-700 mt-1">
                  Bs. {liveRates.usdRate.toFixed(2)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Utiliza exclusivamente la tasa oficial del Banco Central de Venezuela.
                </p>
              </div>

              {/* Option 2: Euro BCV */}
              <div
                onClick={() => handleUpdateActiveCurrency('EUR')}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                  rateConfig?.activeCurrency === 'EUR'
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold font-mono">
                    €
                  </div>
                  {rateConfig?.activeCurrency === 'EUR' && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                      ACTIVA
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-bold text-slate-900">Euro Oficial (€)</h4>
                <div className="text-lg font-black font-mono text-indigo-700 mt-1">
                  Bs. {liveRates.eurRate.toFixed(2)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Fija la cotización del Euro para todas las transacciones comerciales.
                </p>
              </div>

              {/* Option 3: USDT Cripto */}
              <div
                onClick={() => handleUpdateActiveCurrency('USDT')}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                  rateConfig?.activeCurrency === 'USDT'
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold font-mono">
                    ₮
                  </div>
                  {rateConfig?.activeCurrency === 'USDT' && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                      ACTIVA
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-bold text-slate-900">USDT Paralelo (₮)</h4>
                <div className="text-lg font-black font-mono text-emerald-700 mt-1">
                  Bs. {liveRates.usdtRate.toFixed(2)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Aplica la cotización de referencia USDT Cripto / Paralelo.
                </p>
              </div>

              {/* Option 4: ⚡ Programador Dinámico por Scripts de Horario */}
              <div
                onClick={() => handleUpdateActiveCurrency('SCHEDULED')}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                  rateConfig?.activeCurrency === 'SCHEDULED'
                    ? 'border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 shadow-md ring-2 ring-amber-400/20'
                    : 'border-slate-200 hover:border-amber-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold font-mono shadow-xs">
                    <Zap className="w-4 h-4" />
                  </div>
                  {rateConfig?.activeCurrency === 'SCHEDULED' && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black animate-pulse">
                      AUTOMÁTICO
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-black text-amber-900">
                  ⚡ Scripts por Horario
                </h4>
                <div className="text-xs font-bold text-slate-700 mt-1 flex items-center gap-1">
                  <span>Ej. 09:00 a 10:00 Euro</span>
                  <ArrowRight className="w-3 h-3 text-amber-600" />
                  <span>BCV</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Alterna de forma desatendida entre Euro, Dólar y USDT en los horarios programados.
                </p>
              </div>
            </div>
          </div>

          {/* Listado de Scripts de Horario Configurados */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Scripts y Reglas de Horarios Programadas
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure reglas con horas de inicio y fin, moneda destino y duración (definida o indefinida)
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateSchedule}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Script de Horario</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {isLoadingSchedules ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                  <span>Cargando scripts de horarios...</span>
                </div>
              ) : schedules.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Timer className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <span className="font-semibold text-slate-600 block">No hay scripts de horario configurados</span>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Cree uno nuevo para que el sistema cambie de tasa automáticamente a ciertas horas
                  </span>
                </div>
              ) : (
                schedules.map((schedule) => {
                  const isCurrentExecuting =
                    evaluation?.isFromSchedule && evaluation.activeScheduleName === schedule.name;

                  const daysLabels = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

                  return (
                    <div
                      key={schedule.id}
                      className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                        isCurrentExecuting
                          ? 'bg-amber-50/50 border-l-4 border-l-amber-500'
                          : schedule.isActive
                          ? 'bg-white hover:bg-slate-50/60'
                          : 'bg-slate-50/50 opacity-70'
                      }`}
                    >
                      <div className="space-y-1.5 max-w-xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">
                            {schedule.name}
                          </h4>

                          {/* Target Currency Badge */}
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            schedule.currencyTarget === 'EUR'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : schedule.currencyTarget === 'USDT'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : schedule.currencyTarget === 'CUSTOM'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            Tasa:{' '}
                            {schedule.currencyTarget === 'EUR'
                              ? `Euro (Bs. ${liveRates.eurRate.toFixed(2)})`
                              : schedule.currencyTarget === 'USDT'
                              ? `USDT (Bs. ${liveRates.usdtRate.toFixed(2)})`
                              : schedule.currencyTarget === 'CUSTOM'
                              ? `Personalizada (Bs. ${schedule.customRateValue})`
                              : `Dólar BCV (Bs. ${liveRates.usdRate.toFixed(2)})`}
                          </span>

                          {/* Status Badge */}
                          {isCurrentExecuting ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              <span>En Ejecución Ahora</span>
                            </span>
                          ) : schedule.isActive ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                              Programado
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-medium">
                              Desactivado
                            </span>
                          )}
                        </div>

                        {/* Schedule details: time, duration, days */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1">
                          <span className="flex items-center gap-1 font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>{schedule.startTime} - {schedule.endTime}</span>
                          </span>

                          <span className="flex items-center gap-1">
                            <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {schedule.durationType === 'INDEFINITE' ? (
                                <strong className="font-semibold text-slate-700">Tiempo Indefinido (Todos los días)</strong>
                              ) : (
                                <span>
                                  Del{' '}
                                  {schedule.startDate ? new Date(schedule.startDate).toLocaleDateString('es-VE') : 'Inicio'}{' '}
                                  al{' '}
                                  {schedule.endDate ? new Date(schedule.endDate).toLocaleDateString('es-VE') : 'Fin'}
                                </span>
                              )}
                            </span>
                          </span>

                          {/* Days of week */}
                          <div className="flex items-center gap-1">
                            {daysLabels.map((label, dIdx) => {
                              const isDayActive = schedule.daysOfWeek?.includes(dIdx);
                              return (
                                <span
                                  key={dIdx}
                                  className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center ${
                                    isDayActive
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                      : 'bg-slate-100 text-slate-300'
                                  }`}
                                  title={`Día: ${label}`}
                                >
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {schedule.notes && (
                          <p className="text-[11px] text-slate-500 italic pt-0.5">
                            "{schedule.notes}"
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle active button */}
                        <button
                          type="button"
                          onClick={() => handleToggleSchedule(schedule)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            schedule.isActive
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {schedule.isActive ? (
                            <>
                              <Play className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                              <span>Activo</span>
                            </>
                          ) : (
                            <>
                              <Pause className="w-3 h-3 text-slate-500" />
                              <span>Inactivo</span>
                            </>
                          )}
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditSchedule(schedule)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Editar script"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => setScheduleToDelete(schedule)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar script"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Fallback rule indicator */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  <strong>Comportamiento Fuera de Horario:</strong> Cuando la hora del día no coincida con ningún script activo, el sistema usará automáticamente la cotización de{' '}
                  <span className="font-bold text-slate-900">
                    {rateConfig?.fallbackCurrency === 'EUR'
                      ? 'Euro BCV'
                      : rateConfig?.fallbackCurrency === 'USDT'
                      ? 'USDT Cripto'
                      : 'Dólar BCV Oficial'}
                  </span>
                  .
                </span>
              </div>
            </div>
          </div>

          {/* Schedule Simulator & Auto-Sync Settings Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Simulador de Horarios */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Clock className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Simulador de Horarios y Tasas
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Compruebe qué script y cotización se aplicará a cualquier hora del día:
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={simulatorTime}
                  onChange={(e) => setSimulatorTime(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={runSimulator}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Simular Horario
                </button>
              </div>

              {simulatedResult && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 animate-fade-in text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Resultado para las {simulatorTime}:</span>
                    <span className="font-mono font-black text-blue-700 text-sm">
                      Bs. {simulatedResult.effectiveRate.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-slate-600">
                    {simulatedResult.matchedRule ? (
                      <span>
                        Regla disparada:{' '}
                        <strong className="text-slate-900 font-bold">{simulatedResult.matchedRule.name}</strong>{' '}
                        ({simulatedResult.matchedRule.startTime} a {simulatedResult.matchedRule.endTime}) → Moneda:{' '}
                        <span className="font-bold text-amber-700">{simulatedResult.targetCurrency}</span>.
                      </span>
                    ) : (
                      <span>
                        Fuera de ventanas de script → Aplica cotización base de respaldo ({simulatedResult.targetCurrency}).
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Configuración de Sincronización Automática con la API */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <RefreshCw className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Detección Automática de Cambios en la API
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                El servidor consulta periódicamente la cotización oficial de la API de Base44. Cuando detecta un cambio en la cotización oficial del BCV o Euro:
              </p>

              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Actualización instantánea:</strong> La tasa en memoria y terminales POS se actualiza de inmediato sin requerir recargar la página.
                  </span>
                </div>
                <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Registro automático en Historial:</strong> Se almacena un registro diario con la fecha, hora exacta, variación porcentual y notas de auditoría.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR TASA MANUAL HISTÓRICA */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Registrar Tasa Histórica
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveManualEntry} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Fecha de la Tasa:
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tasa Dólar (USD) en Bs.:
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Ej. 849.56"
                  value={formUsdRate}
                  onChange={(e) => setFormUsdRate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tasa Euro (Opcional):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ej. 974.09"
                    value={formEurRate}
                    onChange={(e) => setFormEurRate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tasa USDT (Opcional):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ej. 953.10"
                    value={formUsdtRate}
                    onChange={(e) => setFormUsdtRate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Motivo / Observaciones:
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Publicación extraordinaria del BCV o ajuste contable"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingManual}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs"
                >
                  {isSubmittingManual ? 'Guardando...' : 'Guardar en Historial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR SCRIPT DE HORARIO */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">
                  {editingScheduleId ? 'Editar Script de Horario' : 'Crear Nuevo Script de Horario'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nombre del Script / Horario:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Horario Matutino Euro (09:00 a 10:00)"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Currency Target */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Moneda / Tasa a Aplicar en este Horario:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleCurrencyTarget('EUR')}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      scheduleCurrencyTarget === 'EUR'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-mono text-xs block font-bold">Euro (€)</span>
                    <span className="text-[10px] text-slate-500">Bs. {liveRates.eurRate.toFixed(2)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleCurrencyTarget('USD')}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      scheduleCurrencyTarget === 'USD'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-mono text-xs block font-bold">Dólar ($)</span>
                    <span className="text-[10px] text-slate-500">Bs. {liveRates.usdRate.toFixed(2)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleCurrencyTarget('USDT')}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      scheduleCurrencyTarget === 'USDT'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-mono text-xs block font-bold">USDT (₮)</span>
                    <span className="text-[10px] text-slate-500">Bs. {liveRates.usdtRate.toFixed(2)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleCurrencyTarget('CUSTOM')}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      scheduleCurrencyTarget === 'CUSTOM'
                        ? 'border-purple-600 bg-purple-50 text-purple-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-mono text-xs block font-bold">Fija (Bs)</span>
                    <span className="text-[10px] text-slate-500">Personalizada</span>
                  </button>
                </div>
              </div>

              {scheduleCurrencyTarget === 'CUSTOM' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Valor de la Tasa Fija Personalizada (Bs.):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ej. 980.00"
                    value={scheduleCustomRate}
                    onChange={(e) => setScheduleCustomRate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {/* Time Interval Pickers */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Hora de Inicio:
                  </label>
                  <input
                    type="time"
                    required
                    value={scheduleStartTime}
                    onChange={(e) => setScheduleStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold focus:outline-none focus:border-amber-500 bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Hora de Fin:
                  </label>
                  <input
                    type="time"
                    required
                    value={scheduleEndTime}
                    onChange={(e) => setScheduleEndTime(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold focus:outline-none focus:border-amber-500 bg-white"
                  />
                </div>
              </div>

              {/* Duration Type: Indefinido vs Definido */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Vigencia del Script:
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="durationType"
                      checked={scheduleDurationType === 'INDEFINITE'}
                      onChange={() => setScheduleDurationType('INDEFINITE')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Tiempo Indefinido (Recomendado)</span>
                      <span className="text-[11px] text-slate-500 block">
                        Se aplica todos los días en el horario indicado de forma permanente hasta que se desactive.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="durationType"
                      checked={scheduleDurationType === 'DATE_RANGE'}
                      onChange={() => setScheduleDurationType('DATE_RANGE')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Tiempo Definido (Rango de fechas)</span>
                      <span className="text-[11px] text-slate-500 block">
                        Solo tendrá validez entre una fecha de inicio y una fecha de finalización específicas.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {scheduleDurationType === 'DATE_RANGE' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/60 rounded-xl border border-amber-200 animate-fade-in">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Fecha Desde:</label>
                    <input
                      type="date"
                      required
                      value={scheduleStartDate}
                      onChange={(e) => setScheduleStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Fecha Hasta:</label>
                    <input
                      type="date"
                      required
                      value={scheduleEndDate}
                      onChange={(e) => setScheduleEndDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Days of Week */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Días de la Semana:
                </label>
                <div className="flex items-center gap-1.5">
                  {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((dayName, idx) => {
                    const isSelected = scheduleDaysOfWeek.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (scheduleDaysOfWeek.length > 1) {
                              setScheduleDaysOfWeek((prev) => prev.filter((d) => d !== idx));
                            }
                          } else {
                            setScheduleDaysOfWeek((prev) => [...prev, idx]);
                          }
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                        title={dayName}
                      >
                        {dayName.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Notas / Justificación:
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Estrategia de precios matutina basada en cotización del Euro"
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSchedule}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs"
                >
                  {isSubmittingSchedule ? 'Guardando...' : editingScheduleId ? 'Actualizar Script' : 'Crear Script'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL (HISTORY ITEM) */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Eliminar Registro de Tasa</h3>
            <p className="text-xs text-slate-500">
              ¿Está seguro de eliminar el registro de tasa del{' '}
              <strong>{new Date(itemToDelete.rateDate).toLocaleDateString('es-VE')}</strong> (Bs. {itemToDelete.usdRate.toFixed(2)})?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL (SCHEDULE SCRIPT) */}
      {scheduleToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Eliminar Script de Horario</h3>
            <p className="text-xs text-slate-500">
              ¿Está seguro de eliminar el script <strong>"{scheduleToDelete.name}"</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setScheduleToDelete(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteSchedule}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
