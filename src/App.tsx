import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { 
  ShoppingCart, 
  Package, 
  Bell, 
  Cpu, 
  Layers, 
  Store, 
  Zap, 
  Database, 
  ShieldCheck,
  Check,
  RotateCw,
  Menu,
  X,
  Search,
  Server,
  Activity,
  TrendingUp,
  Pin,
  PinOff,
  RefreshCw,
  Calendar,
  History,
  Contact,
  Settings,
  Coins,
  Receipt,
  FileSpreadsheet,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Boxes,
  Gift
} from 'lucide-react';
import { Product, RestockAlert, BcvRateInfo } from './types';
import { safeFetchJson } from './utils/api';
import { DashboardView } from './components/DashboardView';
import { PosTerminal } from './components/PosTerminal';
import { InventoryView } from './components/InventoryView';
import { ConfigView } from './components/ConfigView';
import { LoginView } from './components/LoginView';
import { BcvRateModal } from './components/BcvRateModal';
import { PrinterStatusModal } from './components/PrinterStatusModal';
import { subscribePrinterStatus, getPrinterStatus, PrinterStatus } from './utils/printerService';
import { getPOSConfig } from './utils/configHelper';
import { getLocalEnabledModules, syncSystemModules } from './utils/systemModules';
import { OnboardingWizard } from './components/OnboardingWizard';

// Code-Splitting: Lazy load optional components on demand (Zero bundle overhead when inactive)
const CombosView = lazy(() => import('./components/CombosView').then(m => ({ default: m.CombosView })));
const CxcView = lazy(() => import('./components/CxcView').then(m => ({ default: m.CxcView })));
const CuentasPorPagarView = lazy(() => import('./components/CuentasPorPagarView').then(m => ({ default: m.CuentasPorPagarView })));
const InventoryAuditsView = lazy(() => import('./components/InventoryAuditsView').then(m => ({ default: m.InventoryAuditsView })));
const KardexView = lazy(() => import('./components/KardexView').then(m => ({ default: m.KardexView })));
const RecentSalesView = lazy(() => import('./components/RecentSalesView').then(m => ({ default: m.RecentSalesView })));
const ArqueoDeCajaView = lazy(() => import('./components/ArqueoDeCajaView').then(m => ({ default: m.ArqueoDeCajaView })));
const ClientsView = lazy(() => import('./components/ClientsView').then(m => ({ default: m.ClientsView })));
const AlertsDrawer = lazy(() => import('./components/AlertsDrawer').then(m => ({ default: m.AlertsDrawer })));
const ConcurrencySimulator = lazy(() => import('./components/ConcurrencySimulator').then(m => ({ default: m.ConcurrencySimulator })));
const ArchitectureViewer = lazy(() => import('./components/ArchitectureViewer').then(m => ({ default: m.ArchitectureViewer })));
const ExchangeRateHistoryView = lazy(() => import('./components/ExchangeRateHistoryView').then(m => ({ default: m.ExchangeRateHistoryView })));

type ActiveTab = 'dashboard' | 'pos' | 'combos' | 'shifts' | 'kardex' | 'audits' | 'inventory' | 'sales' | 'cxc' | 'cxp' | 'alerts' | 'concurrency' | 'architecture' | 'clients' | 'config' | 'rates';

export interface AppUser {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
  role?: string;
  imageUrl?: string;
  allowedDepartments?: string[];
  allowedFunctions?: string[];
  canConfigurePrinters?: boolean;
  canModifyManualRate?: boolean;
  cashRegister?: string;
  canViewOtherShifts?: boolean;
  canViewAllSales?: boolean;
  dashboardType?: 'ADMIN' | 'CAJERO';
  canRegisterExpenses?: boolean;
  canApplyDiscountOrSurcharge?: boolean;
  canSellOnCredit?: boolean;
  canVoidSales?: boolean;
  canCancelSales?: boolean;
}

export function App() {
  const [user, setUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });
  const [posConfig, setPosConfig] = useState(() => getPOSConfig());
  const [enabledModules, setEnabledModules] = useState<string[]>(getLocalEnabledModules);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isOnboardingActive, setIsOnboardingActive] = useState<boolean>(false);
  const [globalSearchSale, setGlobalSearchSale] = useState<any | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [globalSearchError, setGlobalSearchError] = useState<string | null>(null);

  const performGlobalSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;

    setGlobalSearchError(null);
    try {
      const res = await safeFetchJson<any[]>(`/api/v1/sales?search=${encodeURIComponent(q)}`);
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        let matched = res.data.find(
          (s: any) => s.invoiceNumber.trim().toLowerCase() === q.toLowerCase()
        );

        if (!matched) {
          const padded = q.padStart(4, '0');
          matched = res.data.find(
            (s: any) => s.invoiceNumber.trim().toLowerCase() === `ne-${padded}`.toLowerCase() ||
                        s.invoiceNumber.trim().toLowerCase() === `abo-${padded}`.toLowerCase()
          );
        }

        if (!matched) {
          matched = res.data.find(
            (s: any) => s.invoiceNumber.trim().toLowerCase().endsWith(q.toLowerCase())
          );
        }

        if (matched) {
          setGlobalSearchSale(matched);
          setGlobalSearchQuery('');
        } else {
          setGlobalSearchError('No se encontró ninguna venta con ese folio exacto.');
          setTimeout(() => setGlobalSearchError(null), 5000);
        }
      } else {
        setGlobalSearchError('No se encontró ninguna venta con ese folio exacto.');
        setTimeout(() => setGlobalSearchError(null), 5000);
      }
    } catch (err) {
      setGlobalSearchError('Error de red al buscar el folio.');
      setTimeout(() => setGlobalSearchError(null), 5000);
    }
  }, []);

  useEffect(() => {
    const handleTriggerSearch = (e: Event) => {
      const query = (e as CustomEvent).detail;
      if (typeof query === 'string') {
        performGlobalSearch(query);
      }
    };
    window.addEventListener('trigger-global-search', handleTriggerSearch);
    return () => {
      window.removeEventListener('trigger-global-search', handleTriggerSearch);
    };
  }, [performGlobalSearch]);

  const handleGlobalSearchFolio = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      performGlobalSearch(globalSearchQuery);
    }
  };

  const handleLoginSuccess = (userData: AppUser, accessToken: string) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('accessToken', accessToken);
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await safeFetchJson('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Error calling logout API:', e);
    }
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    setUser(null);
  };
  const [cxpInitialTab, setCxpInitialTab] = useState<'proveedores' | 'aging' | 'recepcion' | 'historial'>('proveedores');
  const [products, setProducts] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<RestockAlert[]>([]);
  const [cronStatus, setCronStatus] = useState<any>(null);
  const [cacheHitRate, setCacheHitRate] = useState<string>('100%');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Sidebar hover-expansion state: collapsed by default, auto-expands on mouse enter
  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(false);
  const isSidebarExpanded = isSidebarHovered || isSidebarPinned;

  // BCV live exchange rate state
  const [bcvData, setBcvData] = useState<BcvRateInfo | null>(null);
  const [isBcvSyncing, setIsBcvSyncing] = useState<boolean>(false);
  const [isBcvModalOpen, setIsBcvModalOpen] = useState<boolean>(false);

  // Printer status state
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>(() => getPrinterStatus());

  // React to modular status updates dynamically from anywhere in the app
  useEffect(() => {
    let isMounted = true;
    
    const handleModulesUpdate = (e: Event) => {
      if (!isMounted) return;
      const detail = (e as CustomEvent).detail;
      if (Array.isArray(detail)) {
        // Deep equality check to prevent infinite loops
        setEnabledModules(prev => {
          const isSame = prev.length === detail.length && prev.every(m => detail.includes(m));
          return isSame ? prev : [...detail];
        });
      }
    };
    window.addEventListener('system-modules-updated', handleModulesUpdate);
    
    // Only sync once on mount
    syncSystemModules().then(modules => {
      if (!isMounted) return;
      setEnabledModules(prev => {
        const isSame = prev.length === modules.length && prev.every(m => modules.includes(m));
        return isSame ? prev : [...modules];
      });
    });

    return () => {
      isMounted = false;
      window.removeEventListener('system-modules-updated', handleModulesUpdate);
    };
  }, []);

  // Listen to POS Config updates (departments, categories, etc.)
  useEffect(() => {
    const handleConfigUpdate = () => {
      setPosConfig(getPOSConfig());
    };
    window.addEventListener('pos-config-updated', handleConfigUpdate);
    return () => {
      window.removeEventListener('pos-config-updated', handleConfigUpdate);
    };
  }, []);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = subscribePrinterStatus((status) => {
      setPrinterStatus(status);
    });
    return () => unsubscribe();
  }, []);

  const lastEffectiveRateRef = React.useRef<number | null>(null);
  const lastScheduleNameRef = React.useRef<string | null>(null);
  const [scheduleFlashMsg, setScheduleFlashMsg] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const msg = sessionStorage.getItem('script_activated_flash');
      if (msg) {
        sessionStorage.removeItem('script_activated_flash');
        return msg;
      }
    }
    return null;
  });

  // Fetch live BCV rate with client local time for accurate schedule matching
  const fetchBcvRate = useCallback(async (force = false) => {
    setIsBcvSyncing(true);
    try {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const clientTime = `${h}:${m}`;
      const dayOfWeek = now.getDay();

      const url = `/api/v1/bcv/rate?clientTime=${clientTime}&dayOfWeek=${dayOfWeek}${force ? '&force=true' : ''}`;
      const result = await safeFetchJson<BcvRateInfo>(url);
      if (result.ok && result.data) {
        const newEffRate = result.data.effectiveRate || result.data.usdRate;
        const newSchedName = result.data.activeScheduleName || null;

        // If rate transition occurred while cashier is using app, auto-refresh (F5) cleanly
        if (
          lastEffectiveRateRef.current !== null &&
          (Math.abs(lastEffectiveRateRef.current - newEffRate) > 0.001 || lastScheduleNameRef.current !== newSchedName)
        ) {
          sessionStorage.setItem(
            'script_activated_flash',
            `⚡ Cambio de tasa por horario detectado: Ahora Bs. ${newEffRate.toFixed(2)}${newSchedName ? ` (${newSchedName})` : ''}. Sistema refrescado automáticamente.`
          );
          window.location.reload();
          return;
        }

        lastEffectiveRateRef.current = newEffRate;
        lastScheduleNameRef.current = newSchedName;
        setBcvData(result.data);
      }
    } finally {
      setIsBcvSyncing(false);
    }
  }, []);

  // Update manual rate override
  const updateManualBcvRate = async (newRate: number) => {
    const result = await safeFetchJson<BcvRateInfo>('/api/v1/bcv/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usdRate: newRate, dateLabel: 'Manual' }),
    });
    if (result.ok && result.data) {
      setBcvData(result.data);
    } else {
      throw new Error(result.error || 'Error guardando tasa manual');
    }
  };

  // Update active currency mode (USD, EUR, USDT, SCHEDULED, CUSTOM)
  const updateActiveCurrencyMode = async (mode: 'USD' | 'EUR' | 'USDT' | 'SCHEDULED' | 'CUSTOM') => {
    const result = await safeFetchJson<any>('/api/v1/bcv/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeCurrency: mode }),
    });
    if (result.ok) {
      if (mode === 'SCHEDULED') {
        sessionStorage.setItem(
          'script_activated_flash',
          '⚡ Modo Programador por Horario activado. Sistema refrescado automáticamente para sincronizar el POS.'
        );
        window.location.reload();
        return;
      }
      await fetchBcvRate(true);
    } else {
      throw new Error(result.error || 'Error actualizando modo de cotización');
    }
  };

  // Effective exchange rate dynamically evaluated (from script schedule or fixed choice)
  const effectiveExchangeRate = bcvData?.effectiveRate || bcvData?.usdRate || 849.56;

  // Fetch all products with deduplication
  const loadProducts = useCallback(async () => {
    const result = await safeFetchJson<Product[]>('/api/v1/products');
    if (result.ok && Array.isArray(result.data)) {
      const seen = new Set<string>();
      const uniqueProducts = result.data.filter((p) => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      setProducts(uniqueProducts);
    }
  }, []);

  // Fetch active restock alerts from node-cron evaluator (Zero-CPU: only if module is enabled)
  const loadAlerts = useCallback(async () => {
    if (!enabledModules.includes('alerts')) {
      setAlerts([]);
      return;
    }
    const result = await safeFetchJson<RestockAlert[]>('/api/v1/alerts');
    if (result.ok && Array.isArray(result.data)) {
      setAlerts(result.data);
    }
  }, [enabledModules]);

  // Fetch cron daemon status and cache stats (respects modular activation)
  const loadSystemStats = useCallback(async () => {
    const promises: Promise<any>[] = [safeFetchJson<any>('/api/v1/products/cache/stats')];
    if (enabledModules.includes('alerts')) {
      promises.push(safeFetchJson<any>('/api/v1/cron/status'));
    }

    const results = await Promise.all(promises);
    const cacheRes = results[0];
    const cronRes = results[1];

    if (cronRes?.ok && cronRes.data) {
      setCronStatus(cronRes.data);
    } else if (!enabledModules.includes('alerts')) {
      setCronStatus({ status: 'stopped', enabled: false, message: 'Worker 60s inactivo por optimización modular' });
    }

    if (cacheRes?.ok && cacheRes.data?.hitRate !== undefined) {
      setCacheHitRate(cacheRes.data.hitRate);
    }
  }, [enabledModules]);

  // Dark mode is disabled and reverted as requested
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Initial load and background polling
  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      // Only show full loading on first mount or if we have no products yet
      if (products.length === 0) {
        setIsLoading(true);
      }
      
      try {
        await Promise.all([
          loadProducts(), 
          loadAlerts(), 
          loadSystemStats(), 
          fetchBcvRate()
        ]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    init();

    // Background poll every 15 seconds to keep UI synced with node-cron, products inventory, rate schedules, and Base44 API
    const pollInterval = setInterval(() => {
      loadProducts();
      if (enabledModules.includes('alerts')) {
        loadAlerts();
      }
      loadSystemStats();
      fetchBcvRate(false);
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [loadProducts, loadAlerts, loadSystemStats, fetchBcvRate, enabledModules]);

  // Live Inventory Sync listener (triggered by POS sales, purchase invoices in CxP, restock, or another browser window)
  useEffect(() => {
    const handleInventorySyncEvent = () => {
      loadProducts();
      if (enabledModules.includes('alerts')) {
        loadAlerts();
      }
      loadSystemStats();
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'nubly_last_inventory_sync') {
        loadProducts();
        if (enabledModules.includes('alerts')) {
          loadAlerts();
        }
      }
    };

    const handleWindowFocus = () => {
      loadProducts();
      if (enabledModules.includes('alerts')) {
        loadAlerts();
      }
    };

    window.addEventListener('inventory-sync', handleInventorySyncEvent);
    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('inventory-sync', handleInventorySyncEvent);
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [loadProducts, loadAlerts, loadSystemStats, enabledModules]);

  // Sync configuration from localStorage
  useEffect(() => {
    const syncConfig = () => {
      const newConfig = getPOSConfig();
      setPosConfig(prev => {
        // Deep equality check to prevent redundant re-renders
        if (JSON.stringify(prev) === JSON.stringify(newConfig)) return prev;
        return newConfig;
      });
    };
    window.addEventListener('focus', syncConfig);
    const interval = setInterval(syncConfig, 3000);
    return () => {
      window.removeEventListener('focus', syncConfig);
      clearInterval(interval);
    };
  }, []);

  const criticalAlertsCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const warningAlertsCount = alerts.filter((a) => a.severity === 'WARNING').length;

  const handleNavigate = useCallback((tab: ActiveTab, options?: { tabSubview?: string }) => {
    if (tab === 'cxp' && options?.tabSubview) {
      setCxpInitialTab(options.tabSubview as any);
    }
    setActiveTab(tab);
    // Instant data refresh on tab transition so target screen has real-time fresh stock and data
    loadProducts();
    if (enabledModules.includes('alerts')) {
      loadAlerts();
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [loadProducts, loadAlerts, enabledModules]);

  const allowedNavigationItems = useMemo(() => {
    const navigationItems = [
      { id: 'dashboard' as const, label: 'Torre de Control', icon: LayoutDashboard, moduleKey: 'pos' },
      { id: 'pos' as const, label: 'Terminal POS', icon: ShoppingCart, moduleKey: 'pos' },
      { id: 'combos' as const, label: 'Combos & Promociones', icon: Gift, moduleKey: 'combos' },
      { id: 'shifts' as const, label: 'Arqueo de Caja', icon: Coins, moduleKey: 'shifts' },
      { id: 'kardex' as const, label: 'Kardex de Inventario', icon: FileSpreadsheet, moduleKey: 'kardex' },
      { id: 'audits' as const, label: 'Auditorías de Inventario', icon: ClipboardCheck, moduleKey: 'audits' },
      { id: 'sales' as const, label: 'Ventas Recientes', icon: History, moduleKey: 'sales' },
      { id: 'cxc' as const, label: 'Cuentas por Cobrar', icon: Coins, moduleKey: 'cxc' },
      { id: 'cxp' as const, label: 'Cuentas por Pagar', icon: Receipt, moduleKey: 'cxp' },
      { 
        id: 'rates' as const, 
        label: 'Tasas & Horarios', 
        icon: TrendingUp,
        badge: effectiveExchangeRate ? `Bs. ${Math.round(effectiveExchangeRate)}` : null
      },
      { id: 'inventory' as const, label: 'Inventario & Catálogo', icon: Package, moduleKey: 'inventory' },
      { 
        id: 'alerts' as const, 
        label: 'Alertas Stock 60s', 
        icon: Bell,
        badge: alerts.length > 0 ? (alerts.length as number | null) : null,
        isCritical: criticalAlertsCount > 0,
        moduleKey: 'alerts'
      },
      { id: 'clients' as const, label: 'Clientes', icon: Contact, moduleKey: 'clients' },
      { id: 'config' as const, label: 'Configuración', icon: Settings, moduleKey: 'config' },
      { id: 'concurrency' as const, label: 'Test Concurrencia', icon: Cpu },
      { id: 'architecture' as const, label: 'Arquitectura & Tests', icon: Layers },
    ];

    return navigationItems.filter(item => {
      // 0. Global Zero-Resource Check: If module is deactivated in SystemConfig, hide completely
      if (item.moduleKey && !enabledModules.includes(item.moduleKey)) {
        return false;
      }

      const isAdminUser = !user || user.isAdmin || user.role === 'ADMIN' || user.role === 'Administrador';

      if (item.id === 'concurrency' || item.id === 'architecture') {
        return isAdminUser;
      }

      if (isAdminUser) return true;

      const allowed = Array.isArray(user.allowedFunctions) ? user.allowedFunctions : [];
      if (allowed.length > 0) {
        return allowed.includes(item.id);
      }

      if (user.role === 'CAJERO' || user.role === 'Cajero') {
        return item.id === 'pos' || item.id === 'combos' || item.id === 'shifts' || item.id === 'rates' || item.id === 'dashboard';
      }

      return true;
    });
  }, [user, enabledModules, alerts.length, criticalAlertsCount]);

  // Enforce granular permission restrictions and modular availability on access
  useEffect(() => {
    if (user) {
      const allowedIds = allowedNavigationItems.map(item => item.id);
      if (allowedIds.length > 0 && !allowedIds.includes(activeTab)) {
        setActiveTab(allowedIds[0] || 'pos');
      }
    }
  }, [user, activeTab, allowedNavigationItems]);

  const memoizedWorkspace = useMemo(() => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-10 h-10 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Iniciando motor POS y conectando SQLite WAL...</p>
        </div>
      );
    }
    return (
      <>
        {activeTab === 'dashboard' && (
          <DashboardView
            bcvRate={effectiveExchangeRate}
            onOpenBcvModal={() => setIsBcvModalOpen(true)}
            onNavigate={handleNavigate}
            products={products}
            alerts={alerts}
            onRefreshProducts={loadProducts}
            currentUser={user}
          />
        )}

        {activeTab === 'pos' && (
          <PosTerminal
            products={products}
            onRefreshProducts={loadProducts}
            onRefreshAlerts={loadAlerts}
            bcvRate={effectiveExchangeRate}
            bcvRateInfo={bcvData}
            onNavigate={handleNavigate}
            currentUser={user}
          />
        )}

        {activeTab === 'combos' && enabledModules.includes('combos') && (
          <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Cargando Módulo de Combos...</div>}>
            <CombosView
              products={products}
              bcvRate={effectiveExchangeRate}
            />
          </Suspense>
        )}

        {activeTab === 'shifts' && enabledModules.includes('shifts') && (
          <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Cargando Arqueo de Caja...</div>}>
            <ArqueoDeCajaView
              bcvRate={effectiveExchangeRate}
              currentUser={user}
            />
          </Suspense>
        )}

        {activeTab === 'kardex' && enabledModules.includes('kardex') && (
          <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Cargando Kardex...</div>}>
            <KardexView />
          </Suspense>
        )}

        {activeTab === 'audits' && enabledModules.includes('audits') && (
          <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Cargando Auditorías...</div>}>
            <InventoryAuditsView
              bcvRateInfo={bcvData || undefined}
            />
          </Suspense>
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            products={products}
            bcvRate={effectiveExchangeRate}
            onRefresh={loadProducts}
          />
        )}

        {activeTab === 'sales' && enabledModules.includes('sales') && (
          <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Cargando Historial de Ventas...</div>}>
            <RecentSalesView
              bcvRate={effectiveExchangeRate}
              currentUser={user}
            />
          </Suspense>
        )}

        {activeTab === 'cxc' && enabledModules.includes('cxc') && (
          <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Cargando Cuentas por Cobrar...</div>}>
            <CxcView
              bcvRate={effectiveExchangeRate}
            />
          </Suspense>
        )}

        {activeTab === 'cxp' && enabledModules.includes('cxp') && (
          <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Cargando Cuentas por Pagar...</div>}>
            <CuentasPorPagarView
              products={products}
              onRefreshProducts={loadProducts}
              bcvRate={effectiveExchangeRate}
              initialTab={cxpInitialTab}
            />
          </Suspense>
        )}

        {activeTab === 'alerts' && enabledModules.includes('alerts') && (
          <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Cargando Alertas...</div>}>
            <AlertsDrawer
              alerts={alerts}
              cronStatus={cronStatus}
              onRefreshAlerts={loadAlerts}
              onRefreshProducts={loadProducts}
            />
          </Suspense>
        )}

        {activeTab === 'clients' && enabledModules.includes('clients') && (
          <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Cargando Directorio de Clientes...</div>}>
            <ClientsView />
          </Suspense>
        )}

        {activeTab === 'config' && (
          <ConfigView 
            currentUser={user} 
            onUpdateCurrentUser={(updatedUser) => {
              setUser(updatedUser);
              localStorage.setItem('user', JSON.stringify(updatedUser));
            }}
          />
        )}

        {activeTab === 'concurrency' && (
          <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Cargando Simulador...</div>}>
            <ConcurrencySimulator
              products={products}
              onRefresh={loadProducts}
            />
          </Suspense>
        )}

        {activeTab === 'rates' && (
          <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Cargando Historial de Tasas...</div>}>
            <ExchangeRateHistoryView
              currentUser={user}
              onRefreshLiveBcv={() => fetchBcvRate(true)}
            />
          </Suspense>
        )}

        {activeTab === 'architecture' && (
          <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Cargando Arquitectura...</div>}>
            <ArchitectureViewer />
          </Suspense>
        )}
      </>
    );
  }, [
    activeTab,
    products,
    alerts,
    bcvData,
    cxpInitialTab,
    cronStatus,
    handleNavigate,
    loadProducts,
    loadAlerts,
    isBcvSyncing,
    isLoading
  ]);

  if (!user) {
    if (isOnboardingActive) {
      return (
        <OnboardingWizard 
          onComplete={() => {
            setIsOnboardingActive(false);
            window.location.reload();
          }} 
          onCancel={() => setIsOnboardingActive(false)} 
        />
      );
    }
    return (
      <LoginView 
        onLoginSuccess={handleLoginSuccess} 
        onCreateCompany={() => setIsOnboardingActive(true)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans antialiased transition-colors duration-200">
      
      {/* MOBILE SIDEBAR BACKDROP */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* LATERAL SIDEBAR DESPLEGABLE (Auto-expands on mouse hover) */}
      <aside 
        id="app-sidebar"
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-300 ease-in-out lg:static shadow-sm ${
          isMobileSidebarOpen 
            ? 'translate-x-0 w-64' 
            : '-translate-x-full lg:translate-x-0'
        } ${
          isSidebarExpanded ? 'w-64 xl:w-72' : 'lg:w-20'
        }`}
      >
        
        {/* Sidebar Header & Brand */}
        <div className={`p-4 border-b border-slate-100 flex items-center transition-all ${
          isSidebarExpanded ? 'justify-between' : 'justify-center'
        }`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shrink-0 border border-slate-100 bg-teal-50">
              <img 
                src="/images/nubly_logo.jpg" 
                alt="Nubly Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            {isSidebarExpanded && (
              <div className="animate-fade-in truncate">
                <h1 className="text-sm font-black tracking-tight text-slate-900 truncate">
                  NUBLY APP
                </h1>
                <span className="text-[10px] uppercase font-bold font-mono px-1.5 py-0.2 rounded bg-blue-50 border border-blue-200 text-blue-700">
                  POS High-Speed
                </span>
              </div>
            )}
          </div>

          {/* Desktop Pin/Unpin Toggle Button */}
          {isSidebarExpanded && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsSidebarPinned(!isSidebarPinned)}
                className={`p-1.5 rounded-lg text-xs transition-colors hidden lg:flex cursor-pointer ${
                  isSidebarPinned ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
                title={isSidebarPinned ? 'Desanclar (ocultar automáticamente)' : 'Fijar barra lateral'}
              >
                {isSidebarPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 lg:hidden cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Navigation Items */}
        <div className="p-3 space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden">
          {(() => {
            const renderNavItem = (item: any, keyPrefix = 'nav') => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={`${keyPrefix}-${item.id}`}
                  id={`sidebar-nav-${item.id}`}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  title={!isSidebarExpanded ? item.label : undefined}
                  className={`w-full flex items-center rounded-xl transition-all font-medium text-xs cursor-pointer relative ${
                    isSidebarExpanded ? 'justify-between px-3.5 py-2.5' : 'justify-center p-3'
                  } ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                    {isSidebarExpanded && <span className="truncate">{item.label}</span>}
                  </div>

                  {item.badge !== null && item.badge !== undefined && (
                    isSidebarExpanded ? (
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isSelected
                          ? 'bg-white text-blue-700'
                          : item.isCritical
                          ? 'bg-rose-100 text-rose-700 animate-pulse'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.badge}
                      </span>
                    ) : (
                      <span className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                        item.isCritical ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                      }`} />
                    )
                  )}
                </button>
              );
            };

            const rawCategories = posConfig.sidebarCategories || [];
            const categories = rawCategories.map(cat => {
              if (cat.id === 'cat-sales') {
                let ids = [...cat.itemIds];
                if (!ids.includes('combos')) {
                  ids = ['pos', 'combos', ...ids.filter(id => id !== 'pos' && id !== 'combos')];
                }
                if (!ids.includes('rates')) {
                  ids.push('rates');
                }
                return {
                  ...cat,
                  itemIds: ids
                };
              }
              return cat;
            });
            if (categories.length === 0) {
              return (
                <>
                  {isSidebarExpanded && (
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5 animate-fade-in">
                      Módulos del Sistema
                    </div>
                  )}
                  {allowedNavigationItems.map((item, idx) => renderNavItem(item, `nav-all-${idx}`))}
                </>
              );
            }

            // Grouping logic
            const renderedItemIds = new Set<string>();
            const grouped = categories.map((cat) => {
              const catItems = allowedNavigationItems.filter((item) => cat.itemIds.includes(item.id));
              catItems.forEach((item) => renderedItemIds.add(item.id));
              return { ...cat, items: catItems };
            });

            const unassignedItems = allowedNavigationItems.filter((item) => !renderedItemIds.has(item.id));

            return (
              <div className="space-y-4">
                {grouped.map((cat, cIdx) => {
                  if (cat.items.length === 0) return null;
                  return (
                    <div key={`side-cat-${cat.id || cIdx}-${cIdx}`} className="space-y-1">
                      {isSidebarExpanded ? (
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-1 animate-fade-in flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          <span className="truncate">{cat.name}</span>
                        </div>
                      ) : (
                        <div className="border-t border-slate-200/60 my-2" />
                      )}
                      {cat.items.map((item, iIdx) => renderNavItem(item, `nav-${cat.id}-${iIdx}`))}
                    </div>
                  );
                })}

                {unassignedItems.length > 0 && (
                  <div className="space-y-1">
                    {isSidebarExpanded ? (
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-1.5 animate-fade-in flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                        <span>Otros</span>
                      </div>
                    ) : (
                      <div className="border-t border-slate-200/60 my-2" />
                    )}
                    {unassignedItems.map((item, uIdx) => renderNavItem(item, `nav-unassigned-${uIdx}`))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Sidebar Footer: User Profile, Telemetry & Logout */}
        <div className={`border-t border-slate-200 bg-slate-50 transition-all ${
          isSidebarExpanded ? 'p-4 space-y-3.5 text-xs' : 'p-3 flex flex-col items-center gap-3.5'
        }`}>
          {isSidebarExpanded ? (
            <>
              {/* User Profile Info card */}
              <div className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-xs shrink-0">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate" title={user?.name}>
                    {user?.name || 'Usuario'}
                  </div>
                  <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider truncate">
                    {user?.role || 'Administrador'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Servidor Local Online
                </span>
                <span className="font-mono text-slate-600 font-bold">Port 3000</span>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 text-slate-600">
                <span className="flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                  SQLite WAL Mode
                </span>
                <span className="font-mono text-blue-700 font-bold">Atómico</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-600 pb-1">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  Búsqueda Barcode
                </span>
                <span className="font-mono text-slate-800 font-bold">&lt; 0.5 ms</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar Sesión</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  title={`${user.name} - ${user.role}`}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div 
                  title={`${user.name} - ${user.role}`}
                  className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0"
                >
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div 
                title="Servidor Local en Línea (Puerto 3000, SQLite WAL Atómico)"
                className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"
              />
              <button
                type="button"
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-y-auto">
        
        {/* TOP STATUS APPBAR */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            
            {/* Mobile Sidebar Toggle Button & Current View Title */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  {activeTab === 'pos' && 'Terminal Punto de Venta (POS)'}
                  {activeTab === 'shifts' && 'Arqueo de Caja & Control de Turnos'}
                  {activeTab === 'kardex' && 'Kardex de Inventario & Auditoría Físico-Contable'}
                  {activeTab === 'sales' && 'Ventas y Notas de Entrega Recientes'}
                  {activeTab === 'cxc' && 'Cuentas por Cobrar & Créditos a Clientes'}
                  {activeTab === 'cxp' && 'Cuentas por Pagar & Recepción de Compras'}
                  {activeTab === 'inventory' && 'Control de Inventario & Catálogo'}
                  {activeTab === 'alerts' && 'Alertas de Reabastecimiento Automáticas'}
                  {activeTab === 'clients' && 'Directorio de Clientes / RIF'}
                  {activeTab === 'config' && 'Configuración de Parámetros POS'}
                  {activeTab === 'rates' && 'Historial de Tasas de Cambio & Bitácora BCV'}
                  {activeTab === 'concurrency' && 'Simulador de Concurrencia y Transacciones'}
                  {activeTab === 'architecture' && 'Arquitectura Clean & Pruebas Unitarias'}
                </h2>
                <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {user?.imageUrl ? (
                      <img
                        src={user.imageUrl}
                        alt={user.name}
                        referrerPolicy="no-referrer"
                        className="w-5 h-5 rounded-full object-cover border border-slate-200 shadow-2xs"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-[9px] uppercase">
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <span className="font-bold text-slate-700">{user?.name || 'Usuario'}</span>
                    <span className="text-[9px] bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.2 rounded font-extrabold uppercase select-none tracking-wider">
                      {user?.role || 'Cajero'}
                    </span>
                  </div>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setIsBcvModalOpen(true)}
                    className="text-blue-600 hover:text-blue-700 font-semibold font-mono flex items-center gap-1 cursor-pointer transition-colors"
                    title="Click para ver detalles, cambiar moneda o ajustar tasas"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      {bcvData?.activeCurrency === 'SCHEDULED'
                        ? `⚡ Script: Bs. ${effectiveExchangeRate.toFixed(2)}`
                        : bcvData?.activeCurrency === 'EUR'
                        ? `Euro: Bs. ${effectiveExchangeRate.toFixed(2)} (€)`
                        : bcvData?.activeCurrency === 'USDT'
                        ? `USDT: Bs. ${effectiveExchangeRate.toFixed(2)} (₮)`
                        : `Tasa BCV: Bs. ${effectiveExchangeRate.toFixed(2)}`}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions & Dynamic Rate Badge */}
            <div className="flex items-center gap-2.5">
              
              {/* Global Folio Search Input */}
              <div className="relative hidden md:flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Escriba el folio exacto (Enter)..."
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  onKeyDown={handleGlobalSearchFolio}
                  className="bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all w-48 font-semibold shadow-2xs"
                />
                {globalSearchError && (
                  <div className="absolute right-0 top-full mt-1.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg p-2 text-[10px] font-bold shadow-md z-50 whitespace-nowrap animate-fade-in">
                    {globalSearchError}
                  </div>
                )}
              </div>

              {/* Dynamic Rate Badge (Interactive) */}
              <div className={`hidden md:flex items-center gap-2 border rounded-xl px-3 py-1.5 text-xs transition-all ${
                bcvData?.activeCurrency === 'SCHEDULED'
                  ? 'bg-amber-50/90 border-amber-300 text-amber-900 shadow-xs'
                  : bcvData?.activeCurrency === 'EUR'
                  ? 'bg-indigo-50/90 border-indigo-200 text-indigo-900 shadow-xs'
                  : bcvData?.activeCurrency === 'USDT'
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900 shadow-xs'
                  : 'bg-blue-50/80 border-blue-200 text-blue-900'
              }`}>
                <button
                  type="button"
                  onClick={() => setIsBcvModalOpen(true)}
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  title="Ver cotización activa, cambiar moneda o programar scripts de horarios"
                >
                  {bcvData?.activeCurrency === 'SCHEDULED' ? (
                    <Zap className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  <span className="font-bold text-slate-700">
                    {bcvData?.activeCurrency === 'SCHEDULED'
                      ? (bcvData.activeScheduleName ? `${bcvData.activeScheduleName.slice(0, 16)}...:` : 'Script Horario:')
                      : bcvData?.activeCurrency === 'EUR'
                      ? 'Euro BCV:'
                      : bcvData?.activeCurrency === 'USDT'
                      ? 'USDT Cripto:'
                      : 'BCV:'}
                  </span>
                  <span className={`font-black font-mono text-sm ${
                    bcvData?.activeCurrency === 'SCHEDULED'
                      ? 'text-amber-800'
                      : bcvData?.activeCurrency === 'EUR'
                      ? 'text-indigo-700'
                      : bcvData?.activeCurrency === 'USDT'
                      ? 'text-emerald-700'
                      : 'text-blue-700'
                  }`}>
                    Bs. {effectiveExchangeRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => fetchBcvRate(true)}
                  disabled={isBcvSyncing}
                  className="p-1 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
                  title="Sincronizar tasa en tiempo real desde la API"
                >
                  <RefreshCw className={`w-3 h-3 ${isBcvSyncing ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* PRINTER STATUS BADGE (AL LADO DE LA TASA DEL DÍA) */}
              <button
                type="button"
                id="header-printer-status-badge"
                onClick={() => setIsPrinterModalOpen(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                  printerStatus.isConnected
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                    : 'bg-slate-100/90 border-slate-300 text-slate-600 hover:bg-slate-200/80'
                }`}
                title={`Estado de Impresora: ${printerStatus.statusText} (Click para configurar)`}
              >
                <img src="/images/impresora.svg" alt="Impresora Icono" className="w-4.5 h-4.5 object-contain" />
                
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  printerStatus.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`} />

                <span className="truncate max-w-[130px] font-extrabold">
                  {printerStatus.isConnected ? printerStatus.printerName : 'Sin impresora'}
                </span>
              </button>

              {/* Alert button shortcut (Zero CPU: Only shown when alerts module is active) */}
              {enabledModules.includes('alerts') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('alerts')}
                  className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                    alerts.length > 0
                      ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">Cron 60s:</span>
                  <span>{alerts.length > 0 ? `${alerts.length} alertas` : 'Stock OK'}</span>
                </button>
              )}

              {/* Refresh all system data */}
              <button
                type="button"
                onClick={() => {
                  loadProducts();
                  loadAlerts();
                  loadSystemStats();
                  fetchBcvRate(true);
                }}
                className="p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                title="Sincronizar datos y catálogo"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* MAIN BODY WORKSPACE */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto space-y-4">
          {scheduleFlashMsg && (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl p-4 shadow-md flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <Zap className="w-5 h-5 text-amber-200 animate-bounce shrink-0" />
                <span className="text-xs font-bold">{scheduleFlashMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setScheduleFlashMsg(null)}
                className="text-white hover:text-amber-200 font-bold text-sm cursor-pointer p-1"
              >
                ×
              </button>
            </div>
          )}
          {memoizedWorkspace}
        </main>

        {/* COMPACT FOOTER */}
        <footer className="bg-white border-t border-slate-200 py-3 text-xs text-slate-500 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              Bodegón POS High-Speed Engine • Servidor Local 100% Autónomo
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
              <span>Node.js + Express</span>
              <span>•</span>
              <span>Prisma ORM + SQLite WAL</span>
              <span>•</span>
              <span>node-cron (60s)</span>
            </div>
          </div>
        </footer>
      </div>

      {/* BCV RATE DETAILS, CURRENCY SELECTOR & SCHEDULES MODAL */}
      <BcvRateModal
        isOpen={isBcvModalOpen}
        onClose={() => setIsBcvModalOpen(false)}
        bcvData={bcvData}
        onSyncLiveRate={() => fetchBcvRate(true)}
        onUpdateManualRate={updateManualBcvRate}
        onSelectActiveCurrency={updateActiveCurrencyMode}
        isSyncing={isBcvSyncing}
        onOpenRateHistory={() => handleNavigate('rates')}
        onOpenScheduleConfig={() => handleNavigate('rates')}
      />

      {/* QUICK PRINTER STATUS MODAL */}
      <PrinterStatusModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
        onOpenFullSettings={() => setActiveTab('config')}
      />

      {/* GLOBAL SALE DETAIL MODAL */}
      {globalSearchSale && (() => {
        const isVoided = globalSearchSale.status === 'VOIDED';
        
        let clientName = 'Contado / Cliente General';
        let docType = '';
        let docNumber = '';
        let clientPhone = '';
        let discount: any = null;
        let charge: any = null;
        let reference = globalSearchSale.notes || '';
        let adjustedTotalUsd: number | null = null;
        let adjustedTotalBs: number | null = null;
        let voidReason = '';

        const notes = globalSearchSale.notes;
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
              }
              discount = meta.discount || null;
              charge = meta.charge || null;
              reference = meta.paymentReference || '';
              if (meta.adjustedTotalUsd !== undefined) adjustedTotalUsd = meta.adjustedTotalUsd;
              if (meta.adjustedTotalBs !== undefined) adjustedTotalBs = meta.adjustedTotalBs;
            } catch (e) {}
          }
        }

        const displayTotalUsd = adjustedTotalUsd !== null ? adjustedTotalUsd : globalSearchSale.total;
        const displayTotalBs = adjustedTotalBs !== null ? adjustedTotalBs : (globalSearchSale.total * effectiveExchangeRate);

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              
              <div className="text-center pb-3 border-b border-slate-100">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
                  isVoided 
                    ? 'bg-rose-100 border border-rose-200 text-rose-600' 
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                }`}>
                  {isVoided ? <X className="w-7 h-7" /> : <Check className="w-7 h-7" />}
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {isVoided ? 'Nota de Entrega ANULADA' : 'Resumen de Nota de Entrega'}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {globalSearchSale.invoiceNumber}
                </p>
              </div>

              {isVoided && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-center text-rose-900">
                  <div className="font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1">
                    <span>ESTA NOTA DE ENTREGA FUE ANULADA</span>
                  </div>
                  <p className="text-[11px] text-rose-700">
                    {voidReason ? `Motivo: ${voidReason}` : 'Transacción revocada: el inventario fue reintegrado y el dinero descontado.'}
                  </p>
                </div>
              )}

              {/* Receipt Ticket Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-800 space-y-2 select-all">
                <div className="text-center pb-2 border-b border-dashed border-slate-300 space-y-0.5">
                  <div className="font-bold text-sm text-slate-900 tracking-wider">NUBLY APP POS</div>
                  <div>Cajero: {globalSearchSale.cashierName || 'Caja 1 - Principal'}</div>
                  <div>Fecha: {new Date(globalSearchSale.createdAt).toLocaleString('es-VE')}</div>
                  {docNumber ? (
                    <>
                      <div className="font-bold text-slate-950">Cliente: {clientName}</div>
                      <div>Documento: {docType}-{docNumber}</div>
                      {clientPhone && <div>Tlf: {clientPhone}</div>}
                    </>
                  ) : (
                    <div>Cliente: Contado / General</div>
                  )}
                </div>

                {/* Items List */}
                <div className="py-2 border-b border-dashed border-slate-300 space-y-1.5">
                  {globalSearchSale.items?.map((item: any, idx: number) => {
                    const itemBs = (item.subtotal || 0) * effectiveExchangeRate;
                    return (
                      <div key={`global-modal-sale-item-${idx}`} className="space-y-0.5">
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
                      ${globalSearchSale.total.toFixed(2)} USD
                    </span>
                  </div>
                  {discount && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Descuento ({discount.description}):</span>
                      <span>-{discount.type === 'USD' ? `$${discount.amount.toFixed(2)}` : `Bs. ${discount.amount.toFixed(2)}`}</span>
                    </div>
                  )}
                  {charge && (
                    <div className="flex justify-between text-amber-600 font-bold">
                      <span>Cargo Extra ({charge.description}):</span>
                      <span>+{charge.type === 'USD' ? `$${charge.amount.toFixed(2)}` : `Bs. ${charge.amount.toFixed(2)}`}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Tasa BCV Aplicada:</span>
                    <span>Bs. {effectiveExchangeRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/USD</span>
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
                      <span>• {globalSearchSale.paymentMethod === 'DEBIT_CARD' ? 'Tarjeta Débito (Punto)' :
                               globalSearchSale.paymentMethod === 'PAGO_MOVIL' ? 'Pago Móvil (Bs)' :
                               globalSearchSale.paymentMethod === 'CASH_USD' ? 'Efectivo USD ($)' :
                               globalSearchSale.paymentMethod === 'CASH_BS' ? 'Efectivo Bolívares (Bs)' :
                               globalSearchSale.paymentMethod === 'BINANCE' ? 'Binance Pay' :
                               globalSearchSale.paymentMethod === 'CREDIT' ? 'Crédito' :
                               globalSearchSale.paymentMethod === 'SPLIT' ? 'Pago Mixto' :
                               globalSearchSale.paymentMethod}:</span>
                      <span>${displayTotalUsd.toFixed(2)} USD</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer text-center"
                >
                  Imprimir Ticket
                </button>
                <button
                  type="button"
                  onClick={() => setGlobalSearchSale(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

            </div>
          </div>
        );
      })()}</div>
  );
}
export default App;
