import React, { useState, useEffect, useMemo } from 'react';
import {
  Wine,
  Package,
  Plus,
  RefreshCw,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  UserCheck,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Trash2,
  Edit3,
  Check,
  History,
  Info,
  DollarSign
} from 'lucide-react';
import { Product } from '../types';
import { getProductEmoji } from '../utils/product-meta';
import {
  BeerBucket,
  BucketLoan,
  BottleMovement,
  ReturnableBottleConfig,
  getEmptyBottlesMap,
  saveEmptyBottlesMap,
  getProductReturnableConfig,
  adjustProductEmptyBottles,
  getBeerBuckets,
  saveOrUpdateBucket,
  deleteBeerBucket,
  getBucketLoans,
  returnBucketLoan,
  registerBucketLoan,
  getBottleMovements
} from '../utils/bottleBucketService';
import { safeFetchJson } from '../utils/api';

interface BottlesAndBucketsViewProps {
  products: Product[];
  bcvRate: number;
  onRefreshProducts: () => void;
}

export function BottlesAndBucketsView({ products, bcvRate, onRefreshProducts }: BottlesAndBucketsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'BOTTLES' | 'BUCKETS' | 'LOANS' | 'HISTORY'>('BOTTLES');
  
  // State for bottles and buckets
  const [emptyBottlesMap, setEmptyBottlesMap] = useState<Record<string, number>>(getEmptyBottlesMap);
  const [buckets, setBuckets] = useState<BeerBucket[]>(getBeerBuckets);
  const [loans, setLoans] = useState<BucketLoan[]>(getBucketLoans);
  const [movements, setMovements] = useState<BottleMovement[]>(getBottleMovements);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLoanStatus, setFilterLoanStatus] = useState<'ALL' | 'ACTIVE' | 'RETURNED'>('ACTIVE');

  // Modals state
  const [isAdjustBottleModalOpen, setIsAdjustBottleModalOpen] = useState(false);
  const [selectedProductForBottle, setSelectedProductForBottle] = useState<Product | null>(null);
  const [adjustBottleDelta, setAdjustBottleDelta] = useState<number>(24);
  const [adjustBottleMode, setAdjustBottleMode] = useState<'ADD' | 'SUBTRACT' | 'SET'>('ADD');
  const [adjustBottleReason, setAdjustBottleReason] = useState<string>('Recepción de vacías en depósito');

  // Supplier delivery modal (Devolver al camión de Polar/Regional)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierCratesCount, setSupplierCratesCount] = useState<number>(1);
  const [supplierBottlePackSize, setSupplierBottlePackSize] = useState<number>(24);
  const [supplierNotes, setSupplierNotes] = useState<string>('Entrega de cajas vacías al camión de Polar');

  // Bucket Edit/Create modal
  const [isBucketModalOpen, setIsBucketModalOpen] = useState(false);
  const [editingBucket, setEditingBucket] = useState<Partial<BeerBucket> | null>(null);

  // Bottle Cost & Price config modal
  const [isBottleCostModalOpen, setIsBottleCostModalOpen] = useState(false);
  const [bottleCostProduct, setBottleCostProduct] = useState<Product | null>(null);
  const [bottleCostValue, setBottleCostValue] = useState<number>(0.25);
  const [bottleDepositValue, setBottleDepositValue] = useState<number>(0.50);
  const [bottlePackSizeValue, setBottlePackSizeValue] = useState<number>(24);
  const [bottleNameValue, setBottleNameValue] = useState<string>('');

  // Manual Loan creation modal
  const [isManualLoanModalOpen, setIsManualLoanModalOpen] = useState(false);
  const [manualLoanBucketId, setManualLoanBucketId] = useState<string>('');
  const [manualLoanClientName, setManualLoanClientName] = useState<string>('');
  const [manualLoanClientPhone, setManualLoanClientPhone] = useState<string>('');
  const [manualLoanClientDoc, setManualLoanClientDoc] = useState<string>('');
  const [manualLoanQty, setManualLoanQty] = useState<number>(1);
  const [manualLoanDeposit, setManualLoanDeposit] = useState<number>(5.0);
  const [manualLoanNotes, setManualLoanNotes] = useState<string>('');

  // Toast / Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync with window events
  useEffect(() => {
    const handleEmptySync = () => setEmptyBottlesMap(getEmptyBottlesMap());
    const handleBucketSync = () => setBuckets(getBeerBuckets());
    const handleLoanSync = () => setLoans(getBucketLoans());
    const handleMovSync = () => setMovements(getBottleMovements());

    window.addEventListener('empty-bottles-updated', handleEmptySync);
    window.addEventListener('beer-buckets-updated', handleBucketSync);
    window.addEventListener('bucket-loans-updated', handleLoanSync);
    window.addEventListener('bottle-movements-updated', handleMovSync);
    window.addEventListener('inventory-sync', handleEmptySync);

    return () => {
      window.removeEventListener('empty-bottles-updated', handleEmptySync);
      window.removeEventListener('beer-buckets-updated', handleBucketSync);
      window.removeEventListener('bucket-loans-updated', handleLoanSync);
      window.removeEventListener('bottle-movements-updated', handleMovSync);
      window.removeEventListener('inventory-sync', handleEmptySync);
    };
  }, []);

  // Filter products that have returnable bottles or are in beer/liquor categories
  const returnableProducts = useMemo(() => {
    return products.filter((p) => {
      const config = getProductReturnableConfig(p);
      const name = p.name.toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const isLiquid = cat.includes('licor') || cat.includes('cerveza') || cat.includes('bebida') ||
                      name.includes('polar') || name.includes('solera') || name.includes('zulia') ||
                      name.includes('cerveza') || name.includes('tercio') || name.includes('botella');
      return config.hasReturnableBottle || isLiquid;
    });
  }, [products]);

  const filteredReturnableProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return returnableProducts;
    return returnableProducts.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.barcode.includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [returnableProducts, searchQuery]);

  // Overall Statistics
  const totalEmptyBottlesCount = useMemo(() => {
    return returnableProducts.reduce((sum, p) => {
      const empty = emptyBottlesMap[p.id] !== undefined ? emptyBottlesMap[p.id] : (p.returnableBottleConfig?.emptyBottleStock || 0);
      return sum + empty;
    }, 0);
  }, [returnableProducts, emptyBottlesMap]);

  const totalFullBottlesCount = useMemo(() => {
    return returnableProducts.reduce((sum, p) => sum + p.stock, 0);
  }, [returnableProducts]);

  const totalBucketsCount = useMemo(() => {
    return buckets.reduce((sum, b) => sum + b.totalStock, 0);
  }, [buckets]);

  const totalAvailableBuckets = useMemo(() => {
    return buckets.reduce((sum, b) => sum + b.availableStock, 0);
  }, [buckets]);

  const totalLoanedBuckets = useMemo(() => {
    return buckets.reduce((sum, b) => sum + (b.loanedStock || 0), 0);
  }, [buckets]);

  const activeLoansList = useMemo(() => {
    return loans.filter((l) => l.status === 'ACTIVE');
  }, [loans]);

  // Handle bottle adjust
  const handleSaveBottleAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForBottle) return;

    const current = emptyBottlesMap[selectedProductForBottle.id] !== undefined 
      ? emptyBottlesMap[selectedProductForBottle.id] 
      : (selectedProductForBottle.returnableBottleConfig?.emptyBottleStock || 0);

    let delta = 0;
    if (adjustBottleMode === 'ADD') {
      delta = Math.abs(adjustBottleDelta);
    } else if (adjustBottleMode === 'SUBTRACT') {
      delta = -Math.abs(adjustBottleDelta);
    } else {
      delta = Math.abs(adjustBottleDelta) - current;
    }

    const newStock = adjustProductEmptyBottles(
      selectedProductForBottle,
      delta,
      'MANUAL_ADJUST',
      adjustBottleReason.trim() || 'Ajuste manual desde Inventario de Botellas'
    );

    setEmptyBottlesMap(getEmptyBottlesMap());
    setMovements(getBottleMovements());
    setIsAdjustBottleModalOpen(false);
    setSelectedProductForBottle(null);
    showToast(`✓ Stock de botellas vacías actualizado: ${newStock} unidades`);
  };

  // Handle supplier delivery (camión Polar)
  const handleSaveSupplierDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForBottle) return;

    const totalBottlesToDeliver = supplierCratesCount * supplierBottlePackSize;
    const current = emptyBottlesMap[selectedProductForBottle.id] !== undefined 
      ? emptyBottlesMap[selectedProductForBottle.id] 
      : (selectedProductForBottle.returnableBottleConfig?.emptyBottleStock || 0);

    if (totalBottlesToDeliver > current) {
      if (!confirm(`Advertencia: Va a despachar ${totalBottlesToDeliver} botellas vacías pero solo figuran ${current} en inventario. ¿Desea continuar?`)) {
        return;
      }
    }

    const newStock = adjustProductEmptyBottles(
      selectedProductForBottle,
      -totalBottlesToDeliver,
      'SUPPLIER_RETURN',
      `Devolución de ${supplierCratesCount} cajas (${totalBottlesToDeliver} botellas) al proveedor/camión. ${supplierNotes}`
    );

    setEmptyBottlesMap(getEmptyBottlesMap());
    setMovements(getBottleMovements());
    setIsSupplierModalOpen(false);
    setSelectedProductForBottle(null);
    showToast(`✓ Se registraron -${totalBottlesToDeliver} botellas entregadas al camión proveedor.`);
  };

  // Handle save bucket
  const handleSaveBucket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBucket?.name?.trim()) return;

    saveOrUpdateBucket({
      id: editingBucket.id,
      name: editingBucket.name,
      brand: editingBucket.brand,
      color: editingBucket.color,
      totalStock: Number(editingBucket.totalStock) || 0,
      depositPrice: Number(editingBucket.depositPrice) || 5.0,
      costPrice: Number(editingBucket.costPrice) || 0,
      notes: editingBucket.notes,
    });

    setBuckets(getBeerBuckets());
    setIsBucketModalOpen(false);
    setEditingBucket(null);
    showToast('✓ Tobo guardado en el inventario con éxito.');
  };

  // Handle save bottle cost configuration
  const handleSaveBottleCosts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bottleCostProduct) return;

    try {
      const currentConfig = getProductReturnableConfig(bottleCostProduct);
      const updatedConfig: ReturnableBottleConfig = {
        ...currentConfig,
        hasReturnableBottle: true,
        bottleName: bottleNameValue || currentConfig.bottleName || `Botella ${bottleCostProduct.name}`,
        costPrice: Number(bottleCostValue) || 0,
        bottleDepositPrice: Number(bottleDepositValue) || 0,
        supplierReturnPackSize: Number(bottlePackSizeValue) || 24,
      };

      let presentations: any = {};
      if (bottleCostProduct.presentationsJson) {
        try {
          presentations = JSON.parse(bottleCostProduct.presentationsJson);
        } catch {
          presentations = {};
        }
      }
      presentations.returnableBottleConfig = updatedConfig;

      const res = await safeFetchJson<any>(`/api/v1/products/${bottleCostProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentationsJson: JSON.stringify(presentations),
        }),
      });

      if (res.ok) {
        showToast(`✓ Costos y garantía de envase para "${bottleCostProduct.name}" actualizados.`);
        setIsBottleCostModalOpen(false);
        setBottleCostProduct(null);
        if (onRefreshProducts) onRefreshProducts();
      } else {
        alert(res.error || 'No se pudo guardar la configuración del envase');
      }
    } catch {
      alert('Error guardando costo de la botella');
    }
  };

  const handleDeleteBucket = (bucket: BeerBucket) => {
    try {
      if (confirm(`¿Está seguro de eliminar el tobo "${bucket.name}" del catálogo?`)) {
        deleteBeerBucket(bucket.id);
        setBuckets(getBeerBuckets());
        showToast('✓ Tobo eliminado del catálogo.');
      }
    } catch (err: any) {
      alert(err.message || 'Error al eliminar tobo');
    }
  };

  // Handle manual loan creation
  const handleSaveManualLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLoanBucketId || !manualLoanClientName.trim()) {
      alert('Seleccione un tobo e indique el nombre del cliente');
      return;
    }

    try {
      registerBucketLoan({
        bucketId: manualLoanBucketId,
        clientName: manualLoanClientName,
        clientPhone: manualLoanClientPhone,
        clientDoc: manualLoanClientDoc,
        quantity: Number(manualLoanQty) || 1,
        depositAmountUsd: Number(manualLoanDeposit) || 0,
        notes: manualLoanNotes.trim() || 'Préstamo manual directo',
      });

      setBuckets(getBeerBuckets());
      setLoans(getBucketLoans());
      setIsManualLoanModalOpen(false);
      setManualLoanClientName('');
      setManualLoanClientPhone('');
      setManualLoanClientDoc('');
      setManualLoanNotes('');
      showToast('✓ Préstamo de tobo registrado con éxito.');
    } catch (err: any) {
      alert(err.message || 'Error registrando préstamo');
    }
  };

  // Handle return loan
  const handleReturnLoan = (loanId: string) => {
    if (confirm('¿Confirmar que el cliente ha devuelto este tobo a la barra/depósito?')) {
      returnBucketLoan(loanId);
      setBuckets(getBeerBuckets());
      setLoans(getBucketLoans());
      showToast('✓ Tobo devuelto y reingresado al stock disponible.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-800 flex items-center gap-3 animate-fade-in text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                Licorerías & Bodegones • Envases Retornables
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Auto-Suma en POS Activa
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5 tracking-tight">
              <Wine className="w-7 h-7 text-amber-600" />
              <span>Inventario de Botellas Vacías & Tobos</span>
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Gestión automatizada de envases de cerveza retornables (Polar, Solera, Zulia) y control de stock / préstamos de tobos de cerveza para clientes.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setEditingBucket({
                  name: '',
                  brand: 'Empresas Polar',
                  color: 'Azul',
                  totalStock: 10,
                  depositPrice: 5.0,
                  notes: '',
                });
                setIsBucketModalOpen(true);
              }}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              <span>+ Nuevo Tobo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (buckets.length > 0) setManualLoanBucketId(buckets[0].id);
                setIsManualLoanModalOpen(true);
              }}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>+ Prestar Tobo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEmptyBottlesMap(getEmptyBottlesMap());
                setBuckets(getBeerBuckets());
                setLoans(getBucketLoans());
                setMovements(getBottleMovements());
                onRefreshProducts();
                showToast('Datos de botellas y tobos actualizados');
              }}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Refrescar datos"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          {/* Card 1: Botellas Vacías */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
            <div className="flex items-center justify-between text-amber-800 text-xs font-bold">
              <span>Botellas Vacías en Patio</span>
              <Wine className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-950 font-mono">
                {totalEmptyBottlesCount}
              </span>
              <span className="text-xs font-bold text-amber-700">
                unds ({Math.floor(totalEmptyBottlesCount / 24)} cajas de 24)
              </span>
            </div>
            <div className="text-[11px] text-amber-700/80 mt-1">
              Retornables acumulados por ventas
            </div>
          </div>

          {/* Card 2: Botellas Llenas (Stock para venta) */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
              <span>Cervezas Llenas (Venta)</span>
              <Package className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-950 font-mono">
                {totalFullBottlesCount}
              </span>
              <span className="text-xs font-bold text-emerald-700">
                unds ({Math.floor(totalFullBottlesCount / 24)} cajas)
              </span>
            </div>
            <div className="text-[11px] text-emerald-700/80 mt-1">
              En anaqueles / cavas frías
            </div>
          </div>

          {/* Card 3: Tobos Disponibles */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200">
            <div className="flex items-center justify-between text-blue-800 text-xs font-bold">
              <span>Tobos Disponibles</span>
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-blue-950 font-mono">
                {totalAvailableBuckets}
              </span>
              <span className="text-xs font-bold text-blue-700">
                / {totalBucketsCount} total
              </span>
            </div>
            <div className="text-[11px] text-blue-700/80 mt-1">
              Listos para servir en local / combos
            </div>
          </div>

          {/* Card 4: Tobos Prestados */}
          <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200">
            <div className="flex items-center justify-between text-purple-800 text-xs font-bold">
              <span>Tobos Prestados a Clientes</span>
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-950 font-mono">
                {totalLoanedBuckets}
              </span>
              <span className="text-xs font-bold text-purple-700">
                ({activeLoansList.length} préstamos activos)
              </span>
            </div>
            <div className="text-[11px] text-purple-700/80 mt-1">
              En calle / pendientes por devolución
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('BOTTLES')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'BOTTLES'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Wine className="w-4 h-4" />
          <span>🍾 Botellas Vacías Retornables</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeSubTab === 'BOTTLES' ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {returnableProducts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('BUCKETS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'BUCKETS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>🪣 Inventario de Tobos</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeSubTab === 'BUCKETS' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {buckets.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('LOANS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'LOANS'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>📋 Préstamos de Tobos</span>
          {activeLoansList.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
              {activeLoansList.length} activos
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('HISTORY')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'HISTORY'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>📊 Kardex / Movimientos Envases</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* SUBTAB 1: BOTELLAS VACÍAS (RETORNABLES)                         */}
      {/* ============================================================== */}
      {activeSubTab === 'BOTTLES' && (
        <div className="space-y-4 animate-fade-in">
          {/* Filter & Info Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cerveza por marca, nombre o código..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:bg-white"
              />
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Cada venta en POS o combo suma automáticamente botellas vacías aquí.</span>
            </div>
          </div>

          {/* Products with Returnable Bottles Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                    <th className="py-3 px-4">Cerveza / Producto</th>
                    <th className="py-3 px-4">Tipo de Envase</th>
                    <th className="py-3 px-4 text-center">Stock Lleno (Venta)</th>
                    <th className="py-3 px-4 text-center">Botellas Vacías en Patio</th>
                    <th className="py-3 px-4 text-center">Cajas Equivalentes</th>
                    <th className="py-3 px-4 text-right pr-6">Acciones de Envases</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReturnableProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Wine className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-slate-600">No se encontraron cervezas o licores retornables</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Al crear o editar un producto, active la opción "¿Lleva botella retornable?" para gestionarlo aquí.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredReturnableProducts.map((p, idx) => {
                      const config = getProductReturnableConfig(p);
                      const emptyStock = emptyBottlesMap[p.id] !== undefined ? emptyBottlesMap[p.id] : (config.emptyBottleStock || 0);
                      const packSize = config.supplierReturnPackSize || 24;
                      const equivalentCrates = (emptyStock / packSize).toFixed(1);
                      const fullCrates = Math.floor(emptyStock / packSize);
                      const looseBottles = emptyStock % packSize;

                      return (
                        <tr key={`bottle-prod-${p.id}-${idx}`} className="hover:bg-amber-50/20 transition-colors">
                          {/* Product Info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 text-base">
                                {p.imageUrl ? (
                                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{getProductEmoji(p)}</span>
                                )}
                              </div>
                              <div>
                                <strong className="text-slate-900 font-bold block">{p.name}</strong>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {p.barcode} • {p.category}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Bottle Info */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-medium">
                                <Wine className="w-3.5 h-3.5 text-amber-600" />
                                <span>{config.bottleName || 'Botella Retornable'}</span>
                              </span>
                              <div className="flex items-center gap-2 text-[10px] font-mono">
                                <span className="text-amber-800 font-bold">Costo: ${(config.costPrice || 0.25).toFixed(2)}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-emerald-700 font-bold">Garantía: ${(config.bottleDepositPrice || 0.50).toFixed(2)}</span>
                              </div>
                            </div>
                          </td>

                          {/* Full Stock */}
                          <td className="py-3 px-4 text-center">
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                              {p.stock} {p.unit}
                            </span>
                          </td>

                          {/* Empty Stock */}
                          <td className="py-3 px-4 text-center">
                            <span className="font-mono font-black text-amber-900 bg-amber-100 px-3 py-1 rounded-lg border border-amber-300 text-sm inline-flex items-center gap-1">
                              <span>{emptyStock}</span>
                              <span className="text-[10px] font-normal text-amber-800">vacías</span>
                            </span>
                          </td>

                          {/* Equivalent Crates */}
                          <td className="py-3 px-4 text-center">
                            <div className="font-bold text-slate-800">
                              {fullCrates} cajas <span className="text-slate-400 text-[10px]">({looseBottles} sueltas)</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">Base: {packSize} bot/caja</span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right pr-6">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setBottleCostProduct(p);
                                  setBottleCostValue(config.costPrice !== undefined ? config.costPrice : 0.25);
                                  setBottleDepositValue(config.bottleDepositPrice !== undefined ? config.bottleDepositPrice : 0.50);
                                  setBottlePackSizeValue(config.supplierReturnPackSize || 24);
                                  setBottleNameValue(config.bottleName || `Botella ${p.name} Retornable`);
                                  setIsBottleCostModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                                title="Editar costo y garantía de la botella vacía"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Editar Costo</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProductForBottle(p);
                                  setAdjustBottleDelta(24);
                                  setAdjustBottleMode('ADD');
                                  setAdjustBottleReason('Recepción / canje de botellas vacías');
                                  setIsAdjustBottleModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                                title="Ajustar o sumar botellas vacías"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Ajustar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProductForBottle(p);
                                  setSupplierCratesCount(Math.max(1, fullCrates));
                                  setSupplierBottlePackSize(packSize);
                                  setSupplierNotes(`Devolución al camión repartidor de ${p.name}`);
                                  setIsSupplierModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                                title="Registrar entrega de cajas vacías al camión"
                              >
                                <Truck className="w-3.5 h-3.5 text-amber-400" />
                                <span>Devolver a Camión</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUBTAB 2: INVENTARIO DE TOBOS (BALDES / CUBETAS)                */}
      {/* ============================================================== */}
      {activeSubTab === 'BUCKETS' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Catálogo de Tobos & Baldes de Cerveza</h3>
              <p className="text-xs text-slate-500">
                Configure los tipos de tobos disponibles en su local para servicio de mesa, eventos o alquiler.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingBucket({
                  name: '',
                  brand: 'Empresas Polar',
                  color: 'Azul',
                  totalStock: 15,
                  depositPrice: 5.0,
                  notes: '',
                });
                setIsBucketModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Agregar Tipo de Tobo</span>
            </button>
          </div>

          {/* Buckets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {buckets.map((b, idx) => (
              <div
                key={`bucket-card-${b.id}-${idx}`}
                className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-400 transition-all shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-lg shrink-0">
                        🪣
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{b.name}</h4>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {b.brand} • Color: {b.color}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        ${b.depositPrice.toFixed(2)} garantía
                      </span>
                      <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                        Costo: ${(b.costPrice || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {b.notes && (
                    <p className="text-xs text-slate-500 mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {b.notes}
                    </p>
                  )}
                </div>

                {/* Stock breakdown */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">Total</span>
                      <span className="text-base font-black text-slate-900 font-mono">{b.totalStock}</span>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-emerald-700 font-bold block uppercase">En Local</span>
                      <span className="text-base font-black text-emerald-900 font-mono">{b.availableStock}</span>
                    </div>
                    <div className={`p-2 rounded-xl border ${b.loanedStock > 0 ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[10px] text-purple-700 font-bold block uppercase">Prestados</span>
                      <span className="text-base font-black text-purple-950 font-mono">{b.loanedStock}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBucket(b);
                        setIsBucketModalOpen(true);
                      }}
                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteBucket(b)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar tobo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUBTAB 3: PRÉSTAMOS DE TOBOS                                   */}
      {/* ============================================================== */}
      {activeSubTab === 'LOANS' && (
        <div className="space-y-4 animate-fade-in">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterLoanStatus('ACTIVE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  filterLoanStatus === 'ACTIVE'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Activos ({activeLoansList.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterLoanStatus('RETURNED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  filterLoanStatus === 'RETURNED'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Devueltos ({loans.filter((l) => l.status === 'RETURNED').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterLoanStatus('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  filterLoanStatus === 'ALL'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Todos ({loans.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (buckets.length > 0) setManualLoanBucketId(buckets[0].id);
                setIsManualLoanModalOpen(true);
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>+ Registrar Nuevo Préstamo</span>
            </button>
          </div>

          {/* Loans Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Tobo Prestado</th>
                    <th className="py-3 px-4 text-center">Cantidad</th>
                    <th className="py-3 px-4">Fecha & Factura / Combo</th>
                    <th className="py-3 px-4 text-center">Garantía ($)</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right pr-6">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loans.filter((l) => filterLoanStatus === 'ALL' || l.status === filterLoanStatus).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <UserCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-slate-600">No hay préstamos de tobos registrados</p>
                      </td>
                    </tr>
                  ) : (
                    loans
                      .filter((l) => filterLoanStatus === 'ALL' || l.status === filterLoanStatus)
                      .map((loan, idx) => (
                        <tr key={`loan-row-${loan.id}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                          {/* Client */}
                          <td className="py-3 px-4">
                            <strong className="text-slate-900 block font-bold">{loan.clientName}</strong>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {loan.clientPhone ? `Tel: ${loan.clientPhone}` : ''} {loan.clientDoc ? `• Doc: ${loan.clientDoc}` : ''}
                            </span>
                          </td>

                          {/* Bucket */}
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <span>🪣</span>
                              <span>{loan.bucketName}</span>
                            </span>
                            {loan.notes && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-xs">{loan.notes}</span>
                            )}
                          </td>

                          {/* Quantity */}
                          <td className="py-3 px-4 text-center">
                            <span className="font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                              {loan.quantity} tobo{loan.quantity > 1 ? 's' : ''}
                            </span>
                          </td>

                          {/* Date & Invoice */}
                          <td className="py-3 px-4">
                            <span className="text-slate-700 font-medium block">
                              {new Date(loan.loanDate).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                            <span className="text-[10px] text-blue-600 font-mono font-bold">
                              {loan.invoiceNumber ? `Fac: ${loan.invoiceNumber}` : ''} {loan.comboName ? `• ${loan.comboName}` : ''}
                            </span>
                          </td>

                          {/* Deposit */}
                          <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">
                            {loan.depositAmountUsd ? `$${loan.depositAmountUsd.toFixed(2)}` : 'Sin depósito'}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            {loan.status === 'ACTIVE' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>En Calle / Prestado</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>Devuelto</span>
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 text-right pr-6">
                            {loan.status === 'ACTIVE' ? (
                              <button
                                type="button"
                                onClick={() => handleReturnLoan(loan.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ml-auto cursor-pointer shadow-2xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Marcar Devuelto</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {loan.returnDate ? new Date(loan.returnDate).toLocaleDateString('es-VE') : 'Completado'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUBTAB 4: KARDEX / MOVIMIENTOS DE ENVASES                       */}
      {/* ============================================================== */}
      {activeSubTab === 'HISTORY' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Historial de Movimientos de Botellas Vacías</h3>
            <p className="text-xs text-slate-500">
              Registro inmutable de botellas acumuladas por ventas en el POS, canjes de clientes y despachos al camión de Polar/Regional.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Producto & Envase</th>
                    <th className="py-3 px-4 text-center">Tipo de Movimiento</th>
                    <th className="py-3 px-4 text-center">Cantidad</th>
                    <th className="py-3 px-4">Concepto / Factura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-slate-600">No hay movimientos de botellas vacías registrados</p>
                      </td>
                    </tr>
                  ) : (
                    movements.map((m, idx) => (
                      <tr key={`mov-${m.id}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {new Date(m.date).toLocaleString('es-VE')}
                        </td>
                        <td className="py-3 px-4">
                          <strong className="text-slate-900 block font-bold">{m.productName}</strong>
                          <span className="text-[10px] text-amber-800 font-medium">{m.bottleName}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {m.type === 'SALE_CONSUMED' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                              Venta POS
                            </span>
                          ) : m.type === 'SUPPLIER_RETURN' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800">
                              Camión Proveedor
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                              Ajuste / Canje
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-mono font-black text-sm px-2 py-0.5 rounded-lg ${
                            m.quantity >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                          }`}>
                            {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{m.reason}</div>
                          {m.saleInvoice && (
                            <span className="text-[10px] text-blue-600 font-mono font-bold">Ticket: {m.saleInvoice}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: AJUSTAR BOTELLAS VACÍAS (CANJE O CONTEO)                */}
      {/* ============================================================== */}
      {isAdjustBottleModalOpen && selectedProductForBottle && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wine className="w-5 h-5 text-amber-600" />
                <span>Ajustar Botellas Vacías</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustBottleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBottleAdjust} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="font-bold text-slate-900 text-sm">{selectedProductForBottle.name}</div>
                <div className="text-xs text-amber-800 mt-0.5">
                  Stock actual de botellas vacías:{' '}
                  <strong className="font-mono text-base text-amber-950">
                    {emptyBottlesMap[selectedProductForBottle.id] || 0}
                  </strong>{' '}
                  unds
                </div>
              </div>

              {/* Mode */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Tipo de Operación</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustBottleMode('ADD')}
                    className={`py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      adjustBottleMode === 'ADD'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    + Sumar Vacías
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustBottleMode('SUBTRACT')}
                    className={`py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      adjustBottleMode === 'SUBTRACT'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    - Restar Vacías
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustBottleMode('SET')}
                    className={`py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      adjustBottleMode === 'SET'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    = Fijar Total
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Cantidad de Botellas Vacías:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={adjustBottleDelta}
                    onChange={(e) => setAdjustBottleDelta(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-slate-900"
                  />
                  {/* Quick crate shortcuts */}
                  <button
                    type="button"
                    onClick={() => setAdjustBottleDelta(24)}
                    className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 shrink-0"
                  >
                    1 Caja (24)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustBottleDelta(48)}
                    className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 shrink-0"
                  >
                    2 Cajas (48)
                  </button>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Concepto / Motivo:
                </label>
                <input
                  type="text"
                  required
                  value={adjustBottleReason}
                  onChange={(e) => setAdjustBottleReason(e.target.value)}
                  placeholder="Ej: Canje de cliente, conteo físico en patio..."
                  className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 rounded-xl px-4 py-2.5 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustBottleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Guardar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: DEVOLVER A CAMIÓN PROVEEDOR (POLAR / REGIONAL)          */}
      {/* ============================================================== */}
      {isSupplierModalOpen && selectedProductForBottle && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-purple-600" />
                <span>Devolución de Cajas Vacías a Camión</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSupplierDelivery} className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                <div className="font-bold text-slate-900 text-sm">{selectedProductForBottle.name}</div>
                <div className="text-xs text-purple-900 mt-0.5">
                  Botellas vacías disponibles en patio:{' '}
                  <strong className="font-mono text-base">
                    {emptyBottlesMap[selectedProductForBottle.id] || 0}
                  </strong>{' '}
                  unds
                </div>
              </div>

              {/* Number of crates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    N° Cajas a Entregar:
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={supplierCratesCount}
                    onChange={(e) => setSupplierCratesCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Botellas por Caja:
                  </label>
                  <select
                    value={supplierBottlePackSize}
                    onChange={(e) => setSupplierBottlePackSize(parseInt(e.target.value, 10) || 24)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-bold"
                  >
                    <option value={24}>24 unidades (Estándar Polar/Solera)</option>
                    <option value={36}>36 unidades (Caja grande)</option>
                    <option value={12}>12 unidades (Media caja)</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between font-mono">
                <span className="text-slate-500">Total botellas a descontar:</span>
                <span className="text-base font-black text-rose-700">
                  -{supplierCratesCount * supplierBottlePackSize} botellas
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Número de Guía / Chofer / Notas:
                </label>
                <input
                  type="text"
                  value={supplierNotes}
                  onChange={(e) => setSupplierNotes(e.target.value)}
                  placeholder="Ej: Guía Polar #8492 - Chofer Carlos"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-4 py-2.5 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Registrar Salida de Cajas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDITAR / CREAR TIPO DE TOBO                             */}
      {/* ============================================================== */}
      {isBucketModalOpen && editingBucket && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>🪣</span>
                <span>{editingBucket.id ? 'Editar Tobo' : 'Nuevo Tipo de Tobo'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsBucketModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBucket} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Nombre del Tobo / Balde *
                </label>
                <input
                  type="text"
                  required
                  value={editingBucket.name || ''}
                  onChange={(e) => setEditingBucket({ ...editingBucket, name: e.target.value })}
                  placeholder="Ej: Tobo Polar Pilsen Azul Metal"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Marca / Línea
                  </label>
                  <input
                    type="text"
                    value={editingBucket.brand || ''}
                    onChange={(e) => setEditingBucket({ ...editingBucket, brand: e.target.value })}
                    placeholder="Polar, Solera, Corona..."
                    className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Color / Material
                  </label>
                  <input
                    type="text"
                    value={editingBucket.color || ''}
                    onChange={(e) => setEditingBucket({ ...editingBucket, color: e.target.value })}
                    placeholder="Azul, Metal, Negro..."
                    className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Stock Total de Tobos:
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingBucket.totalStock || 0}
                    onChange={(e) => setEditingBucket({ ...editingBucket, totalStock: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-sm font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Garantía / Depósito ($):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editingBucket.depositPrice || 5.0}
                    onChange={(e) => setEditingBucket({ ...editingBucket, depositPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-sm font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Costo del Tobo ($ USD):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editingBucket.costPrice || 0}
                    onChange={(e) => setEditingBucket({ ...editingBucket, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-sm font-mono font-bold text-slate-900"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Notas / Descripción
                </label>
                <input
                  type="text"
                  value={editingBucket.notes || ''}
                  onChange={(e) => setEditingBucket({ ...editingBucket, notes: e.target.value })}
                  placeholder="Ej: Capacidad para 10 tercios con hielo"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBucketModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Guardar Tobo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: PRÉSTAMO MANUAL DE TOBO A CLIENTE                       */}
      {/* ============================================================== */}
      {isManualLoanModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-purple-600" />
                <span>Registrar Préstamo de Tobo</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsManualLoanModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualLoan} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Seleccionar Tobo *
                </label>
                <select
                  required
                  value={manualLoanBucketId}
                  onChange={(e) => setManualLoanBucketId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-bold"
                >
                  {buckets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (Disponibles: {b.availableStock} de {b.totalStock})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={manualLoanClientName}
                  onChange={(e) => setManualLoanClientName(e.target.value)}
                  placeholder="Ej: Carlos Pérez"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Teléfono Cliente
                  </label>
                  <input
                    type="text"
                    value={manualLoanClientPhone}
                    onChange={(e) => setManualLoanClientPhone(e.target.value)}
                    placeholder="0414-1234567"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Cédula / RIF
                  </label>
                  <input
                    type="text"
                    value={manualLoanClientDoc}
                    onChange={(e) => setManualLoanClientDoc(e.target.value)}
                    placeholder="V-18234567"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Cantidad de Tobos:
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={manualLoanQty}
                    onChange={(e) => setManualLoanQty(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-4 py-2 text-sm font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Depósito Garantía ($):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={manualLoanDeposit}
                    onChange={(e) => setManualLoanDeposit(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-4 py-2 text-sm font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Notas / Observaciones
                </label>
                <input
                  type="text"
                  value={manualLoanNotes}
                  onChange={(e) => setManualLoanNotes(e.target.value)}
                  placeholder="Ej: Mesa 4, evento familiar..."
                  className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsManualLoanModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Registrar Préstamo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDITAR COSTOS Y GARANTÍA DE BOTELLA RETORNABLE          */}
      {/* ============================================================== */}
      {isBottleCostModalOpen && bottleCostProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wine className="w-5 h-5 text-amber-600" />
                <span>Configurar Costos y Garantía de Envase</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsBottleCostModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBottleCosts} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="font-bold text-slate-900 text-sm">{bottleCostProduct.name}</div>
                <div className="text-xs text-amber-900 font-mono mt-0.5">
                  {bottleCostProduct.barcode} • {bottleCostProduct.category}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Nombre Personalizado del Envase:
                </label>
                <input
                  type="text"
                  required
                  value={bottleNameValue}
                  onChange={(e) => setBottleNameValue(e.target.value)}
                  placeholder="Ej: Botella Polar Pilsen 222ml Retornable"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Costo Botella Vacía ($ USD):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={bottleCostValue}
                    onChange={(e) => setBottleCostValue(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Costo de reposición</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Garantía / Depósito ($ USD):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={bottleDepositValue}
                    onChange={(e) => setBottleDepositValue(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Cobro/Depósito en POS</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Botellas por Caja / Huacal:
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={bottlePackSizeValue}
                  onChange={(e) => setBottlePackSizeValue(parseInt(e.target.value, 10) || 24)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBottleCostModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Guardar Costos de Envase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
