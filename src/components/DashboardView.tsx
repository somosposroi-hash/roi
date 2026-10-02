import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  Package, 
  ClipboardCheck, 
  Coins, 
  Receipt, 
  AlertTriangle, 
  Clock, 
  UserCheck, 
  UserX, 
  Calendar, 
  RefreshCw, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  BarChart3, 
  PieChart as PieChartIcon, 
  ShieldAlert, 
  CheckCircle2, 
  Flame, 
  ArrowUpRight, 
  Sparkles,
  Layers,
  ArrowRight,
  Filter,
  Eye,
  Percent,
  Wallet
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Product, RestockAlert, Sale, Client } from '../types';
import { safeFetchJson } from '../utils/api';
import { getPurchaseReceipts } from '../utils/cxpHelper';
import { getClientsList } from '../utils/configHelper';
import { calculateOverallCxcStats, ClientDebtSummary } from '../utils/cxcHelper';

type DashboardPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type UserRole = 'ADMIN' | 'CASHIER';
type CurrencyMode = 'USD' | 'VES';

interface DashboardStatsResponse {
  period: string;
  dateRange: {
    currentStart: string;
    currentEnd: string;
    prevStart: string;
    prevEnd: string;
  };
  kpis: {
    revenue: {
      current: number;
      previous: number;
      changePercent: number;
      transactionsCount: number;
      prevTransactionsCount: number;
    };
    profit: {
      current: number;
      previous: number;
      changePercent: number;
      totalCost: number;
      marginPercent: number;
    };
    paymentBreakdown: Array<{
      method: string;
      label: string;
      count: number;
      total: number;
      percentage: number;
    }>;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    category: string;
    currentStock: number;
    totalQuantity: number;
    totalRevenue: number;
    unitCost: number;
    totalMargin: number;
    marginPercent: number;
    revenueSharePercent: number;
  }>;
  hourlySales: Array<{
    hour: number;
    hourLabel: string;
    transactions: number;
    sales: number;
  }>;
  peakHourInfo: {
    hourLabel: string;
    sales: number;
    transactions: number;
  } | null;
}

interface DashboardViewProps {
  bcvRate: number;
  onOpenBcvModal?: () => void;
  onNavigate: (tab: any, options?: { tabSubview?: string }) => void;
  products: Product[];
  alerts: RestockAlert[];
  onRefreshProducts?: () => void;
  currentUser?: any;
}

const PIE_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e5'];

export function DashboardView({
  bcvRate,
  onOpenBcvModal,
  onNavigate,
  products,
  alerts,
  onRefreshProducts,
  currentUser,
}: DashboardViewProps) {
  // Global Filters & Settings
  const [period, setPeriod] = useState<DashboardPeriod>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Role & Permissions (Saved to localStorage)
  const [userRole, setUserRole] = useState<UserRole>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nubly_pos_user_role');
      if (saved === 'CASHIER' || saved === 'ADMIN') return saved;
    }
    return 'ADMIN';
  });

  // Currency Toggle (Saved to localStorage)
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nubly_pos_dashboard_currency');
      if (saved === 'USD' || saved === 'VES') return saved;
    }
    return 'USD';
  });

  // Top Products View Mode: Chart vs Table
  const [topProductsView, setTopProductsView] = useState<'table' | 'chart'>('table');

  // Accordion state for Payment Methods Breakdown
  const [isPaymentsBreakdownOpen, setIsPaymentsBreakdownOpen] = useState<boolean>(false);

  // Data Loading States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLinuxModalOpen, setIsLinuxModalOpen] = useState<boolean>(false);
  const [statsData, setStatsData] = useState<DashboardStatsResponse | null>(null);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);

  // Save role and currency changes
  const handleRoleChange = (newRole: UserRole) => {
    setUserRole(newRole);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nubly_pos_user_role', newRole);
    }
  };

  const handleCurrencyChange = (mode: CurrencyMode) => {
    setCurrencyMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nubly_pos_dashboard_currency', mode);
    }
  };

  // Fetch Dashboard Stats from Backend (Native SQLite Aggregation)
  const fetchDashboardStats = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/v1/dashboard/stats?period=${period}`;
      if (period === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${customStartDate}&endDate=${customEndDate}`;
      }

      const [statsRes, salesRes] = await Promise.all([
        safeFetchJson<DashboardStatsResponse>(url),
        safeFetchJson<Sale[]>('/api/v1/sales?limit=200')
      ]);

      if (statsRes.ok && statsRes.data) {
        setStatsData(statsRes.data);
      }
      if (salesRes.ok && Array.isArray(salesRes.data)) {
        setSalesHistory(salesRes.data);
      }
    } catch (e) {
      console.error('Error fetching dashboard stats:', e);
    } finally {
      setIsLoading(false);
    }
  }, [period, customStartDate, customEndDate]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  // Compute CXC (Cuentas por Cobrar) real stats
  const cxcStats = useMemo(() => {
    const clients = getClientsList();
    return calculateOverallCxcStats(clients, salesHistory, bcvRate);
  }, [salesHistory, bcvRate]);

  // Compute CXP (Cuentas por Pagar) real stats
  const cxpStats = useMemo(() => {
    const receipts = getPurchaseReceipts();
    const unpaid = receipts.filter(r => r.status !== 'PAGADO' && r.remainingBalanceUsd > 0.01);
    const totalPayableUsd = unpaid.reduce((acc, r) => acc + r.remainingBalanceUsd, 0);

    const now = new Date();
    const in7Days = new Date();
    in7Days.setDate(now.getDate() + 7);

    const dueSoonReceipts = unpaid.filter(r => {
      if (!r.dueDate) return false;
      const due = new Date(r.dueDate);
      return due <= in7Days; // Due in next 7 days or overdue
    });

    const dueSoonPayableUsd = dueSoonReceipts.reduce((acc, r) => acc + r.remainingBalanceUsd, 0);
    const overdueReceipts = unpaid.filter(r => {
      if (!r.dueDate) return false;
      const due = new Date(r.dueDate);
      return due < now;
    });

    return {
      totalPayableUsd,
      dueSoonPayableUsd,
      unpaidCount: unpaid.length,
      dueSoonCount: dueSoonReceipts.length,
      overdueCount: overdueReceipts.length,
      dueSoonReceipts,
    };
  }, []);

  // Format currency helper
  const formatMoney = useCallback((amountInUsd: number) => {
    if (currencyMode === 'VES') {
      const inBs = amountInUsd * bcvRate;
      return `Bs. ${inBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${amountInUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [currencyMode, bcvRate]);

  // Period display label
  const periodLabel = useMemo(() => {
    switch (period) {
      case 'today': return 'del Día (Hoy)';
      case 'yesterday': return 'de Ayer';
      case 'week': return 'de los Últimos 7 Días';
      case 'month': return 'del Mes en Curso';
      case 'custom': return 'del Período Seleccionado';
    }
  }, [period]);

  const kpis = statsData?.kpis;
  const topProducts = statsData?.topProducts || [];
  const hourlySales = statsData?.hourlySales || [];
  const peakHourInfo = statsData?.peakHourInfo;

  // Pie chart data for Top Products
  const pieChartData = useMemo(() => {
    return topProducts.map((p) => ({
      name: p.productName.length > 20 ? p.productName.slice(0, 18) + '...' : p.productName,
      fullName: p.productName,
      value: p.totalQuantity,
      revenue: p.totalRevenue,
      margin: p.totalMargin
    }));
  }, [topProducts]);

  // Cashier Role / Configured Dashboard Type Customization
  const isCajero = currentUser?.dashboardType === 'CAJERO' || (!currentUser?.dashboardType && (currentUser?.role?.toUpperCase() === 'CAJERO' || currentUser?.role?.toLowerCase()?.includes('caje')));

  const clientQueMasAtiende = useMemo(() => {
    const cashierSales = salesHistory.filter(s => s.cashierName === (currentUser?.name || ''));
    if (cashierSales.length === 0) return 'Ninguno aún';

    const clientCounts: Record<string, number> = {};
    cashierSales.forEach(s => {
      let clientName = 'Cliente General';
      if (s.notes && s.notes.startsWith('METADATA_JSON:')) {
        try {
          const meta = JSON.parse(s.notes.replace('METADATA_JSON:', ''));
          if (meta.client?.name) {
            clientName = meta.client.name;
          }
        } catch {}
      } else if (s.notes && s.notes.startsWith('CLIENT_DATA_JSON:')) {
        try {
          const parts = s.notes.split(' | REFERENCE: ');
          const clientData = JSON.parse(parts[0].replace('CLIENT_DATA_JSON:', ''));
          if (clientData.name) {
            clientName = clientData.name;
          }
        } catch {}
      }
      
      clientCounts[clientName] = (clientCounts[clientName] || 0) + 1;
    });

    let bestClient = 'Cliente General';
    let maxCount = 0;
    for (const [name, count] of Object.entries(clientCounts)) {
      if (count > maxCount) {
        maxCount = count;
        bestClient = name;
      }
    }
    return `${bestClient} (${maxCount} atenciones)`;
  }, [salesHistory, currentUser]);

  const quickActionsList = [
    { id: 'pos', label: 'Punto de Venta', desc: 'Cargar venta inmediata', icon: ShoppingCart, bg: 'from-blue-50/50 to-white', hoverBorder: 'hover:border-blue-400', hoverText: 'group-hover:text-blue-600', bgIcon: 'bg-blue-600', action: () => onNavigate('pos') },
    { id: 'shifts', label: 'Arqueo de Caja', desc: 'Control de turnos', icon: Coins, bg: 'from-amber-50/50 to-white', hoverBorder: 'hover:border-amber-400', hoverText: 'group-hover:text-amber-600', bgIcon: 'bg-amber-600', action: () => onNavigate('shifts') },
    { id: 'cxp', label: 'Entrada / Compra', desc: 'Recepción proveedor', icon: Package, bg: 'from-emerald-50/50 to-white', hoverBorder: 'hover:border-emerald-400', hoverText: 'group-hover:text-emerald-600', bgIcon: 'bg-emerald-600', action: () => onNavigate('cxp', { tabSubview: 'recepcion' }) },
    { id: 'audits', label: 'Toma de Inventario', desc: 'Auditoría de stock', icon: ClipboardCheck, bg: 'from-purple-50/50 to-white', hoverBorder: 'hover:border-purple-400', hoverText: 'group-hover:text-purple-600', bgIcon: 'bg-purple-600', action: () => onNavigate('audits') },
    { id: 'cxc', label: 'Abono de Cliente', desc: 'Cobrar deuda / fiado', icon: Coins, bg: 'from-indigo-50/50 to-white', hoverBorder: 'hover:border-indigo-400', hoverText: 'group-hover:text-indigo-600', bgIcon: 'bg-indigo-600', action: () => onNavigate('cxc') },
  ];

  const allowedQuickActions = useMemo(() => {
    return quickActionsList.filter(act => {
      if (!currentUser) return true;
      if (currentUser.role === 'ADMIN') return true;

      const allowed = Array.isArray(currentUser.allowedFunctions) ? currentUser.allowedFunctions : [];
      if (allowed.length > 0) {
        return allowed.includes(act.id);
      }

      if (currentUser.role === 'CAJERO') {
        return act.id === 'pos' || act.id === 'shifts';
      }

      return true;
    });
  }, [currentUser]);

  if (isCajero) {
    const userSales = salesHistory.filter(s => s.cashierName === currentUser?.name);
    
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
        {/* Cashier Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 rounded-3xl p-6 shadow-md text-white relative overflow-hidden flex flex-col md:flex-row items-center gap-6">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-2xl pointer-events-none" />
          <div className="absolute left-10 bottom-0 w-44 h-44 bg-white/5 rounded-full -ml-20 -mb-20 blur-xl pointer-events-none" />
          
          <div className="relative shrink-0 flex items-center justify-center">
            <motion.div
              animate={{ 
                y: [0, -6, 0],
                rotate: [0, 2, -2, 0]
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-white/10 border border-white/20 shadow-lg"
            >
              <img 
                src="/images/nubecita_mascot.jpg" 
                alt="Mascota Nubecita" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>
            
            <motion.div 
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm"
            >
              Cajero
            </motion.div>
          </div>

          <div className="text-center md:text-left space-y-2 relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 border border-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
              Sesión de Cajero Activa
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              ¡Hola, {currentUser?.name}!
            </h2>
            <p className="text-sm text-blue-100 max-w-2xl font-medium leading-relaxed">
              Te saluda tu asistente <strong className="text-white">Nubecita</strong>. ¡Mucho éxito en tu jornada de hoy! El éxito es la suma de pequeños esfuerzos repetidos día tras día. ¡Buena suerte! 🍀✨
            </p>
          </div>
        </div>

        {/* Info Grid: Register + Best Client */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cash Register Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Número de Caja Asignado</span>
              <span className="text-2xl font-black text-slate-900 block mt-0.5">
                {currentUser?.cashRegister ? `Caja #${currentUser.cashRegister}` : 'Caja Principal'}
              </span>
            </div>
          </div>

          {/* Cliente que más atienden */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Cliente Que Más Atiendes</span>
              <span className="text-xl font-black text-slate-900 block mt-0.5 truncate max-w-[280px]">
                {clientQueMasAtiende}
              </span>
            </div>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Acciones Rápidas Disponibles
              </h2>
              <p className="text-xs text-slate-500">
                Acciones rápidas habilitadas específicamente para tus permisos asignados
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {allowedQuickActions.map((act) => {
              const Icon = act.icon;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={act.action}
                  className={`flex flex-col items-start p-3.5 rounded-xl border border-slate-200/90 bg-gradient-to-b ${act.bg} ${act.hoverBorder} hover:shadow-xs transition-all text-left group cursor-pointer`}
                >
                  <div className={`w-8 h-8 rounded-lg ${act.bgIcon} text-white flex items-center justify-center mb-2.5 shadow-xs group-hover:scale-105 transition-transform`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-black text-slate-900 ${act.hoverText} transition-colors`}>
                    {act.label}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    {act.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Las Últimas Ventas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Mis Últimas Ventas Realizadas
              </h3>
              <p className="text-xs text-slate-500">
                Historial de transacciones de hoy en tu turno
              </p>
            </div>
            <div className="text-xs font-mono font-bold bg-slate-50 border px-2.5 py-1 rounded-xl text-slate-600">
              Total Ventas: {userSales.length}
            </div>
          </div>

          {userSales.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <ShoppingCart className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">No has registrado ventas en esta sesión aún</p>
              <p className="text-[11px] text-slate-400">Dirígete a la sección Punto de Venta para procesar notas de entrega.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                  <tr>
                    <th className="px-4 py-3">No. Nota</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Método Pago</th>
                    <th className="px-4 py-3 text-right">Monto Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userSales.slice(0, 10).map((sale, idx) => (
                    <tr key={`dash-user-sale-${sale.id}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-bold font-mono text-blue-600">{sale.invoiceNumber}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(sale.createdAt).toLocaleString('es-VE')}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-600">
                        {sale.paymentMethod === 'CASH_USD' ? 'Efectivo $' : 
                         sale.paymentMethod === 'CASH_BS' ? 'Efectivo Bs.' : 
                         sale.paymentMethod === 'DEBIT_CARD' ? 'Tarjeta Débito' : 
                         sale.paymentMethod === 'PAGO_MOVIL' ? 'Pago Móvil' : sale.paymentMethod}
                      </td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-slate-900">
                        ${sale.total.toFixed(2)}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          Bs. {(sale.total * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
      
      {/* ============================================================ */}
      {/* NUBECITA WELCOME BANNER                                      */}
      {/* ============================================================ */}
      <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 rounded-3xl p-6 shadow-md text-white relative overflow-hidden flex flex-col md:flex-row items-center gap-6">
        {/* Decorative background vectors */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-2xl pointer-events-none" />
        <div className="absolute left-10 bottom-0 w-44 h-44 bg-white/5 rounded-full -ml-20 -mb-20 blur-xl pointer-events-none" />
        
        <div className="relative shrink-0 flex items-center justify-center">
          {/* Animated Mascot Image */}
          <motion.div
            animate={{ 
              y: [0, -6, 0],
              rotate: [0, 2, -2, 0]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-white/10 border border-white/20 shadow-lg"
          >
            <img 
              src="/images/nubecita_mascot.jpg" 
              alt="Mascota Nubecita" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </motion.div>
          
          <motion.div 
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm"
          >
            ¡HOLA!
          </motion.div>
        </div>

        <div className="text-center md:text-left space-y-2 relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 border border-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
            Identidad Nubly App
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            Bienvenido a Nubly App
          </h2>
          <p className="text-sm text-blue-100 max-w-2xl font-medium leading-relaxed">
            Tu personaje <strong className="text-white">Nubecita</strong> te saluda con entusiasmo. Esta es la Torre de Control de tu negocio: diseñada para darte un resumen ejecutivo completo de tus indicadores en menos de 5 segundos.
          </p>
        </div>
      </div>

      {/* ============================================================ */}
      {/* HEADER & CONTROL TOWER TOOLBAR                               */}
      {/* ============================================================ */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Torre de Control del Negocio
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Tiempo Real
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Diagnóstico ejecutivo integral en menos de 5 segundos • Operaciones, finanzas y alertas
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls: Rate, Currency, Roles, and Refresh */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-start xl:justify-end">
          
          {/* BCV Live Rate Badge */}
          <button
            type="button"
            onClick={onOpenBcvModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 font-medium transition-colors cursor-pointer shadow-2xs"
            title="Haga clic para ver o actualizar la tasa oficial BCV"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="font-semibold text-slate-500 text-[11px]">BCV:</span>
            <span className="font-mono font-black text-slate-900">
              {bcvRate > 0 ? `${bcvRate.toFixed(2)} Bs/$` : 'Sincronizando...'}
            </span>
          </button>

          {/* Currency Toggle (USD vs VES) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => handleCurrencyChange('USD')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                currencyMode === 'USD'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => handleCurrencyChange('VES')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                currencyMode === 'VES'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              VES (Bs.)
            </button>
          </div>

          {/* Role Selector Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => handleRoleChange('ADMIN')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                userRole === 'ADMIN'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vista completa con ganancia neta, costos y cuentas por pagar"
            >
              <span>👑 Admin</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('CASHIER')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                userRole === 'CASHIER'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vista restringida de caja (ganancias y CxP ocultas)"
            >
              <span>🧑‍💼 Cajero</span>
            </button>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => {
              fetchDashboardStats();
              onRefreshProducts?.();
            }}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="Refrescar métricas en tiempo real"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Role Banner Indicator if in Cashier Mode */}
      {userRole === 'CASHIER' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900 animate-fade-in">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Modo Cajero Activo:</strong> Por políticas de seguridad, las métricas de Ganancia Neta y Cuentas por Pagar están ocultas. Puede alternar a <strong>Admin</strong> en la barra superior.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleRoleChange('ADMIN')}
            className="px-2.5 py-1 rounded-lg bg-amber-200/70 hover:bg-amber-300 font-bold text-[11px] text-amber-950 transition-colors cursor-pointer shrink-0"
          >
            Cambiar a Admin
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* GLOBAL DATE FILTER BAR                                       */}
      {/* ============================================================ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Período:
          </span>

          <button
            type="button"
            onClick={() => setPeriod('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === 'today'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Hoy
          </button>

          <button
            type="button"
            onClick={() => setPeriod('yesterday')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === 'yesterday'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Ayer
          </button>

          <button
            type="button"
            onClick={() => setPeriod('week')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === 'week'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Esta Semana
          </button>

          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === 'month'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Este Mes
          </button>

          <button
            type="button"
            onClick={() => setPeriod('custom')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === 'custom'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Personalizado
          </button>
        </div>

        {/* Custom date range inputs */}
        {period === 'custom' && (
          <div className="flex items-center gap-2 w-full sm:w-auto bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Desde:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-mono focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Hasta:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-mono focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={fetchDashboardStats}
              className="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 1. FRANJA SUPERIOR: TARJETAS DE MÉTRICAS CLAVE (KPIS)        */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Ventas del Período */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between group hover:border-blue-300 transition-colors"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                Ventas {periodLabel}
              </span>

              {/* Trend Indicator */}
              {kpis && (
                <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  kpis.revenue.changePercent >= 0 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {kpis.revenue.changePercent >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(kpis.revenue.changePercent)}%
                </span>
              )}
            </div>

            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
              {formatMoney(kpis?.revenue.current || 0)}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
              <span>{kpis?.revenue.transactionsCount || 0} operaciones de venta</span>
              <span className="text-slate-400">
                Prev: {formatMoney(kpis?.revenue.previous || 0)}
              </span>
            </div>
          </div>

          {/* Collapsible Payment Methods Breakdown Toggle */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsPaymentsBreakdownOpen(!isPaymentsBreakdownOpen)}
              className="w-full flex items-center justify-between text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
            >
              <span>Desglose por método de pago</span>
              {isPaymentsBreakdownOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {isPaymentsBreakdownOpen && (
              <div className="mt-2.5 space-y-2 animate-fade-in text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                {kpis?.paymentBreakdown && kpis.paymentBreakdown.length > 0 ? (
                  kpis.paymentBreakdown.map((pm) => (
                    <div key={pm.method} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 font-medium">{pm.label}</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatMoney(pm.total)} ({pm.percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, pm.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-slate-400 italic text-center py-1">
                    Sin cobros en este período
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* KPI 2: Ganancia Neta Estimada (Oculta para Cajero) */}
        {userRole === 'ADMIN' ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between group hover:border-emerald-300 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Ganancia Neta Estimada
                </span>

                {kpis && (
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    kpis.profit.changePercent >= 0 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {kpis.profit.changePercent >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {Math.abs(kpis.profit.changePercent)}%
                  </span>
                )}
              </div>

              <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight font-mono">
                {formatMoney(kpis?.profit.current || 0)}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                <span className="font-bold text-emerald-600">
                  Margen Neto: {kpis?.profit.marginPercent.toFixed(1)}%
                </span>
                <span className="text-slate-400">
                  Costo: {formatMoney(kpis?.profit.totalCost || 0)}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Fórmula: Ventas − Costo Base</span>
              <span className="font-mono font-medium">Prev: {formatMoney(kpis?.profit.previous || 0)}</span>
            </div>
          </motion.div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center text-center text-slate-400">
            <ShieldAlert className="w-6 h-6 text-slate-400 mb-1" />
            <span className="text-xs font-bold text-slate-600">Ganancia Neta Restringida</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Visible únicamente para Administrador</span>
          </div>
        )}

        {/* KPI 3: Cuentas por Cobrar (CxC / Fiados) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          onClick={() => onNavigate('cxc')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between group hover:border-indigo-300 transition-all cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-indigo-600" />
                Por Cobrar (Fiados)
              </span>

              {/* Mora alert badge */}
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                cxcStats.moraPercentage > 25
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : cxcStats.moraPercentage > 0
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {cxcStats.moraPercentage}% en mora
              </span>
            </div>

            <div className="text-2xl sm:text-3xl font-black text-indigo-700 tracking-tight font-mono">
              {formatMoney(cxcStats.totalRemainingDebtUsd)}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
              <span>{cxcStats.activeDebtorsCount} deudores activos</span>
              <span className="text-rose-600 font-bold">
                {cxcStats.overdueDebtorsCount} en mora
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-indigo-600 font-bold">
            <span>Total ventas crédito: {formatMoney(cxcStats.totalCreditSalesUsd)}</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </motion.div>

        {/* KPI 4: Cuentas por Pagar (CxP) (Oculta para Cajero) */}
        {userRole === 'ADMIN' ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.15 }}
            onClick={() => onNavigate('cxp')}
            className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between group hover:border-amber-300 transition-all cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-amber-600" />
                  Cuentas por Pagar (CxP)
                </span>

                {cxpStats.dueSoonCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                    <Clock className="w-3 h-3" />
                    {cxpStats.dueSoonCount} en 7 días
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Al día
                  </span>
                )}
              </div>

              <div className="text-2xl sm:text-3xl font-black text-amber-800 tracking-tight font-mono">
                {formatMoney(cxpStats.totalPayableUsd)}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                <span className="text-amber-700 font-bold">
                  Próx. 7 días: {formatMoney(cxpStats.dueSoonPayableUsd)}
                </span>
                <span>{cxpStats.unpaidCount} facturas</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-amber-700 font-bold">
              <span>{cxpStats.overdueCount > 0 ? `${cxpStats.overdueCount} ya vencidas` : 'Compromisos a proveedores'}</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </motion.div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center text-center text-slate-400">
            <ShieldAlert className="w-6 h-6 text-slate-400 mb-1" />
            <span className="text-xs font-bold text-slate-600">Cuentas por Pagar Restringidas</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Visible únicamente para Administrador</span>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. ACCIONES RÁPIDAS Y FLUJO DIRECTO (QUICK ACTIONS)          */}
      {/* ============================================================ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Acciones Rápidas y Flujo Directo
            </h2>
            <p className="text-xs text-slate-500">
              Procesos más frecuentes sin tener que navegar por múltiples submenús
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          
          {/* Action 1: POS / Cargar Venta */}
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200/90 bg-gradient-to-b from-blue-50/50 to-white hover:border-blue-400 hover:shadow-xs transition-all text-left group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center mb-2.5 shadow-xs group-hover:scale-105 transition-transform">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition-colors">
              Punto de Venta
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5">
              Cargar venta inmediata
            </span>
          </button>

          {/* Action 2: Registrar Entrada de Mercancía / Compra */}
          <button
            type="button"
            onClick={() => onNavigate('cxp', { tabSubview: 'recepcion' })}
            className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200/90 bg-gradient-to-b from-emerald-50/50 to-white hover:border-emerald-400 hover:shadow-xs transition-all text-left group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-2.5 shadow-xs group-hover:scale-105 transition-transform">
              <Package className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
              Entrada / Compra
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5">
              Recepción proveedor
            </span>
          </button>

          {/* Action 3: Iniciar Auditoría de Inventario */}
          <button
            type="button"
            onClick={() => onNavigate('audits')}
            className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200/90 bg-gradient-to-b from-purple-50/50 to-white hover:border-purple-400 hover:shadow-xs transition-all text-left group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center mb-2.5 shadow-xs group-hover:scale-105 transition-transform">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-900 group-hover:text-purple-600 transition-colors">
              Toma de Inventario
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5">
              Auditoría física de stock
            </span>
          </button>

          {/* Action 4: Registrar Abono de Cliente (CxC) */}
          <button
            type="button"
            onClick={() => onNavigate('cxc')}
            className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200/90 bg-gradient-to-b from-indigo-50/50 to-white hover:border-indigo-400 hover:shadow-xs transition-all text-left group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center mb-2.5 shadow-xs group-hover:scale-105 transition-transform">
              <Coins className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
              Abono de Cliente
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5">
              Cobrar deuda / fiado
            </span>
          </button>

          {/* Action 5: Registrar Pago a Proveedor (CxP) */}
          <button
            type="button"
            disabled={userRole === 'CASHIER'}
            onClick={() => onNavigate('cxp', { tabSubview: 'aging' })}
            className={`flex flex-col items-start p-3.5 rounded-xl border transition-all text-left group ${
              userRole === 'CASHIER'
                ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
                : 'border-slate-200/90 bg-gradient-to-b from-amber-50/50 to-white hover:border-amber-400 hover:shadow-xs cursor-pointer'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg text-white flex items-center justify-center mb-2.5 shadow-xs ${
              userRole === 'CASHIER' ? 'bg-slate-400' : 'bg-amber-600 group-hover:scale-105 transition-transform'
            }`}>
              <Receipt className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-900 group-hover:text-amber-600 transition-colors">
              Pago a Proveedor
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5">
              {userRole === 'CASHIER' ? 'Restringido (Admin)' : 'Pagar factura pendiente'}
            </span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. GRÁFICOS VISUALES DE ANÁLISIS (RECHARTS)                  */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Top 5 Productos más Vendidos y Margen (8 cols - wider for clear display) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  Top 5 Productos más Vendidos
                </h3>
                <p className="text-xs text-slate-500">
                  Rotación de inventario y aporte directo al margen de ganancia ($M_p$)
                </p>
              </div>

              {/* View Switcher: Table vs Chart */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTopProductsView('table')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    topProductsView === 'table'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tabla Detallada
                </button>
                <button
                  type="button"
                  onClick={() => setTopProductsView('chart')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    topProductsView === 'chart'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Gráfico Circular
                </button>
              </div>
            </div>

            {/* Content: Table or Chart */}
            {topProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">No hay ventas registradas en este período</p>
                <p className="text-xs text-slate-400 mt-1">Realice ventas desde el POS para visualizar el ranking en tiempo real</p>
              </div>
            ) : topProductsView === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="pb-2.5 pl-1">Producto</th>
                      <th className="pb-2.5 text-center">Cant. ($Q_p$)</th>
                      <th className="pb-2.5 text-right">Total Facturado</th>
                      {userRole === 'ADMIN' && (
                        <th className="pb-2.5 text-right pr-1">Aporte Margen ($M_p$)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topProducts.map((prod, idx) => (
                      <tr key={`top-prod-${prod.productId || idx}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 pl-1">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-slate-100 font-mono text-[10px] font-bold text-slate-500 flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </span>
                            <div>
                              <strong className="text-slate-800 font-bold block text-xs">
                                {prod.productName}
                              </strong>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {prod.category} • Stock actual: {prod.currentStock}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-slate-900">
                          {prod.totalQuantity}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-slate-900">
                          {formatMoney(prod.totalRevenue)}
                        </td>
                        {userRole === 'ADMIN' && (
                          <td className="py-3 text-right pr-1 font-mono">
                            <div className="font-bold text-emerald-700">
                              +{formatMoney(prod.totalMargin)}
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">
                              ({prod.marginPercent.toFixed(0)}% margen)
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-64 flex flex-col sm:flex-row items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                    >
                      {pieChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: any, name: any, item: any) => [
                        `${val} unidades (${formatMoney(item.payload.revenue)})`,
                        item.payload.fullName
                      ]}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Math formula note in footer */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Fórmula: Q_p = Σ(qty_i) | M_p = Σ(price_i − cost_i) × qty_i</span>
            <span className="text-blue-600 font-semibold">Agregación nativa SQLite O(1)</span>
          </div>
        </div>

        {/* Right Column: Horas Pico de Venta (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Horas Pico de Venta
                </h3>
                <p className="text-xs text-slate-500">
                  Distribución de afluencia por hora para optimización de personal
                </p>
              </div>
            </div>

            {/* Peak Hour Callout Badge */}
            {peakHourInfo && peakHourInfo.sales > 0 ? (
              <div className="mb-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-200/80 rounded-xl p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="text-slate-800">
                    <strong>Pico detectado: {peakHourInfo.hourLabel}</strong> con {formatMoney(peakHourInfo.sales)} ({peakHourInfo.transactions} tickets)
                  </span>
                </div>
              </div>
            ) : (
              <div className="mb-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-500 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Registros automáticos de caja agrupados cada 60 minutos</span>
              </div>
            )}

            {/* Recharts Bar Chart */}
            <div className="h-60 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlySales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="hourLabel" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => currencyMode === 'VES' ? `${(val * bcvRate).toFixed(0)}` : `$${val}`}
                  />
                  <Tooltip 
                    formatter={(val: any, name: any, item: any) => [
                      `${formatMoney(Number(val))} (${item.payload.transactions} tickets)`,
                      'Facturado'
                    ]}
                    labelFormatter={(label) => `Hora: ${label}`}
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0', 
                      fontSize: '11px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                    }}
                  />
                  <Bar 
                    dataKey="sales" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]} 
                    animationDuration={600}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Recomendación operativa:</span>
            <strong className="text-slate-800">
              {peakHourInfo && peakHourInfo.sales > 0 ? `Reforzar caja a las ${peakHourInfo.hourLabel}` : 'Horario comercial regular'}
            </strong>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. ALERTAS OPERATIVAS Y NOTIFICACIONES AUTOMÁTICAS           */}
      {/* ============================================================ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Alertas Operativas y Notificaciones Automáticas
            </h3>
            <p className="text-xs text-slate-500">
              Detección proactiva de fugas de dinero, cuentas en mora y faltantes de stock
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-600">Total Alertas Activas:</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black font-mono">
              {cxcStats.overdueDebtorsCount + cxpStats.dueSoonCount + alerts.length}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Alert Column 1: Clientes con Límite de Crédito Excedido / Fecha Vencida */}
          <div className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                  <UserX className="w-4 h-4 text-rose-600" />
                  Crédito Excedido / En Mora
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                  {cxcStats.overdueClients.length + cxcStats.limitExceededClients.length}
                </span>
              </div>

              {cxcStats.overdueClients.length === 0 && cxcStats.limitExceededClients.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-1" />
                  <p className="text-xs font-bold text-slate-700">Sin clientes en mora</p>
                  <p className="text-[10px] text-slate-400">Todos los créditos se encuentran al día</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {/* Overdue Clients */}
                  {cxcStats.overdueClients.slice(0, 3).map((item, idx) => (
                    <div 
                      key={`overdue-${item.client.id}-${idx}`}
                      onClick={() => onNavigate('cxc')}
                      className="p-2.5 rounded-lg bg-white border border-rose-200 text-xs hover:border-rose-400 transition-colors cursor-pointer shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900 font-bold truncate max-w-[140px]">
                          {item.client.name}
                        </strong>
                        <span className="font-mono font-black text-rose-700">
                          {formatMoney(item.currentDebtUsd)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                        <span className="text-rose-600 font-bold">
                          {item.statusDetails.label}
                        </span>
                        <span className="text-slate-400">{item.client.phone || item.client.docNumber}</span>
                      </div>
                    </div>
                  ))}

                  {/* Limit exceeded clients */}
                  {cxcStats.limitExceededClients
                    .filter(c => !cxcStats.overdueClients.some(oc => oc.client.id === c.client.id))
                    .slice(0, 2)
                    .map((item, idx) => (
                      <div 
                        key={`limit-${item.client.id}-${idx}`}
                        onClick={() => onNavigate('cxc')}
                        className="p-2.5 rounded-lg bg-white border border-amber-200 text-xs hover:border-amber-400 transition-colors cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-900 font-bold truncate max-w-[140px]">
                            {item.client.name}
                          </strong>
                          <span className="font-mono font-black text-amber-700">
                            {formatMoney(item.currentDebtUsd)}
                          </span>
                        </div>
                        <div className="text-[10px] text-amber-600 font-semibold mt-1">
                          Límite superado (Máx: ${item.creditLimit})
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('cxc')}
              className="w-full py-1.5 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Ver Cuentas por Cobrar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Alert Column 2: Cuentas por Pagar Próximas a Vencer (7 días) (Oculta para Cajero) */}
          {userRole === 'ADMIN' ? (
            <div className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    CxP Próximas a Vencer
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                    {cxpStats.dueSoonReceipts.length}
                  </span>
                </div>

                {cxpStats.dueSoonReceipts.length === 0 ? (
                  <div className="py-6 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-1" />
                    <p className="text-xs font-bold text-slate-700">Sin facturas urgentes</p>
                    <p className="text-[10px] text-slate-400">No hay pagos a proveedores en los próximos 7 días</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {cxpStats.dueSoonReceipts.slice(0, 4).map((rec, idx) => (
                      <div 
                        key={`due-cxp-${rec.id}-${idx}`}
                        onClick={() => onNavigate('cxp')}
                        className="p-2.5 rounded-lg bg-white border border-amber-200 text-xs hover:border-amber-400 transition-colors cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-900 font-bold truncate max-w-[140px]">
                            {rec.supplierName}
                          </strong>
                          <span className="font-mono font-black text-amber-700">
                            {formatMoney(rec.remainingBalanceUsd)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                          <span className="text-slate-500 font-mono">{rec.receiptNumber}</span>
                          <span className="text-amber-700 font-bold">Vence: {rec.dueDate || 'Inmediato'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onNavigate('cxp')}
                className="w-full py-1.5 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Gestionar Pagos a Proveedores</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/50 flex flex-col items-center justify-center text-center text-slate-400">
              <ShieldAlert className="w-7 h-7 text-slate-400 mb-1" />
              <strong className="text-xs text-slate-600">Compromisos de Pago Ocultos</strong>
              <span className="text-[10px] text-slate-400 mt-0.5">Se requiere rol de Administrador para gestionar pagos de proveedores</span>
            </div>
          )}

          {/* Alert Column 3: Stock Bajo y Alertas de Inventario */}
          <div className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-rose-600" />
                  Stock Crítico y Reposición
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                  {alerts.length}
                </span>
              </div>

              {alerts.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-1" />
                  <p className="text-xs font-bold text-slate-700">Inventario Sano</p>
                  <p className="text-[10px] text-slate-400">Todos los productos sobre el stock mínimo</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {alerts.slice(0, 4).map((alt) => (
                    <div 
                      key={alt.id}
                      onClick={() => onNavigate('inventory')}
                      className="p-2.5 rounded-lg bg-white border border-rose-200 text-xs hover:border-rose-400 transition-colors cursor-pointer shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900 font-bold truncate max-w-[140px]">
                          {alt.product.name}
                        </strong>
                        <span className={`font-mono font-black ${
                          alt.currentStock <= 0 ? 'text-rose-700' : 'text-amber-700'
                        }`}>
                          {alt.currentStock <= 0 ? '0 und' : `${alt.currentStock} und`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                        <span className="text-slate-400">{alt.product.category}</span>
                        <span className="text-rose-600 font-bold">Mínimo: {alt.minStock}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="w-full py-1.5 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Ver Catálogo de Inventario</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* FOOTER & LINUX ENGINE TRIBUTE SECTION                        */}
      {/* ============================================================ */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        
        {/* Left side: System integrity statistics & status */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-2">
            <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Integridad del Motor de Datos Nubly
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Nubly App opera en un entorno local optimizado con soporte de concurrencia total en modo WAL (Write-Ahead Logging). El almacenamiento relacional local está indexado para garantizar lecturas en microsegundos y transacciones financieras totalmente seguras.
            </p>
          </div>
          
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 font-medium">
            <span>Base de Datos: SQLite WAL High-Speed</span>
            <span>Versión del Motor: v2.4.0 (Stable)</span>
          </div>
        </div>

        {/* Right side: Interactive Linux Honor Card */}
        <div className="w-full lg:w-[420px] shrink-0">
          <motion.div
            whileHover={{ y: -4, scale: 1.015 }}
            onClick={() => setIsLinuxModalOpen(true)}
            className="group relative h-48 rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all border border-slate-200 bg-white"
          >
            {/* Show the original image in full clarity */}
            <img 
              src="/images/linux_servers_card.jpg" 
              alt="Servidores de Nubly App Corriendo en Linux" 
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>

      </div>

      {/* ============================================================ */}
      {/* LINUX PHILOSOPHY MODAL                                       */}
      {/* ============================================================ */}
      <AnimatePresence>
        {isLinuxModalOpen && (
          <div className="fixed inset-0 bg-slate-950/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-2xl w-full border border-slate-100 flex flex-col max-h-[90vh]"
            >
              {/* Header Image or Decorative Banner */}
              <div className="relative bg-slate-950 py-10 px-6 text-white overflow-hidden shrink-0">
                <div className="absolute inset-0 opacity-40">
                  <img 
                    src="/images/linux_servers_card.jpg" 
                    alt="Linux Banner" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-900/50" />
                </div>
                
                <div className="relative space-y-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-600/95 border border-blue-400/30 rounded-full text-[10px] font-black uppercase tracking-wider">
                    Soberanía y Libertad
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                    Impulsado por Linux &amp; la Filosofía del Software Libre
                  </h3>
                  <p className="text-xs text-blue-200 font-semibold">
                    Soberanía tecnológica, estabilidad y transparencia al servicio de tu negocio.
                  </p>
                </div>
              </div>

              {/* Scrollable Body */}
              <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-sm leading-relaxed">
                
                <div className="space-y-2.5">
                  <h4 className="text-base font-black text-slate-900 tracking-tight">
                    ¿Por qué construimos Nubly sobre Linux?
                  </h4>
                  <p>
                    Nubly App no es solo un sistema de gestión; es el resultado de una visión fundamentada en la libertad, la colaboración y la eficiencia. Creemos firmemente que el software que impulsa a las empresas no debe depender de licencias restrictivas ni de ecosistemas cerrados que limitan el control sobre tus propios datos.
                  </p>
                  <p>
                    Al elegir Linux como el corazón de nuestra infraestructura y adoptar la filosofía del Open Source, garantizamos tres pilares fundamentales para tu negocio:
                  </p>
                </div>

                {/* The Three Pillars */}
                <div className="space-y-4 pt-2">
                  
                  {/* Pillar 1 */}
                  <div className="flex gap-3 items-start p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-2xl shrink-0 mt-0.5">🛡️</span>
                    <div className="space-y-1">
                      <strong className="text-slate-950 font-bold block">Rendimiento y Estabilidad Ininterrumpida</strong>
                      <p className="text-xs text-slate-600">
                        Los servidores Linux impulsan más del 90% de la infraestructura crítica del mundo. Gracias a su arquitectura ligera y modular, tu sistema responde con máxima velocidad, optimizando los recursos del servidor y garantizando una operatividad 24/7 sin caídas inesperadas.
                      </p>
                    </div>
                  </div>

                  {/* Pillar 2 */}
                  <div className="flex gap-3 items-start p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-2xl shrink-0 mt-0.5">🔓</span>
                    <div className="space-y-1">
                      <strong className="text-slate-950 font-bold block">Soberanía y Seguridad de Datos</strong>
                      <p className="text-xs text-slate-600">
                        El Software Libre nos permite auditar, adaptar y proteger cada línea de código. Tus datos contables, tu inventario y el historial de tus clientes están respaldados por entornos seguros, transparentes y libres de rastreos opacos o puertas traseras.
                      </p>
                    </div>
                  </div>

                  {/* Pillar 3 */}
                  <div className="flex gap-3 items-start p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-2xl shrink-0 mt-0.5">🤝</span>
                    <div className="space-y-1">
                      <strong className="text-slate-950 font-bold block">Desarrollo impulsado por la Comunidad</strong>
                      <p className="text-xs text-slate-600">
                        Creemos en el conocimiento compartido. Construir sobre herramientas abiertas nos permite evolucionar constantemente, integrar las mejores tecnologías globales y ofrecerte una plataforma moderna sin costos inflados por patentes o intermediarios.
                      </p>
                    </div>
                  </div>

                </div>

                {/* Plaintext/Firma Section */}
                <div className="p-4 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs space-y-2 border border-slate-800">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <span>🐧</span>
                    <span>Estado del Servidor: Linux Engine Active | Uptime: 99.9%</span>
                  </div>
                  <div className="text-slate-400 italic">
                    "La libertad no es solo la ausencia de restricciones, es la capacidad de construir el futuro que deseas."
                  </div>
                </div>

              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setIsLinuxModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 font-bold text-xs text-white transition-colors cursor-pointer"
                >
                  Entendido, ¡Soberanía Tecnológica!
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
