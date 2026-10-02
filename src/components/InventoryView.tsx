import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  AlertCircle, 
  CheckCircle, 
  RotateCw, 
  PlusCircle, 
  Camera, 
  Trash2,
  Edit3,
  ChevronDown,
  Filter,
  Wine
} from 'lucide-react';
import { Product } from '../types';
import { getProductEmoji } from '../utils/product-meta';
import { getPOSConfig } from '../utils/configHelper';
import { ProductFormPage } from './ProductFormPage';
import { ProductActionModal } from './ProductActionModal';
import { BottlesAndBucketsView } from './BottlesAndBucketsView';
import { getLocalEnabledModules } from '../utils/systemModules';

interface InventoryViewProps {
  products: Product[];
  bcvRate: number;
  onRefresh: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ products, bcvRate, onRefresh }) => {
  const posConfig = getPOSConfig();
  const enabledModules = getLocalEnabledModules();
  const isEnvasesEnabled = enabledModules.includes('envases');

  const [inventorySubTab, setInventorySubTab] = useState<'CATALOG' | 'BOTTLES_BUCKETS'>('CATALOG');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  
  // Navigation / View states inside inventory
  const [currentView, setCurrentView] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [actionModalProduct, setActionModalProduct] = useState<Product | null>(null);

  // Restock modal from action modal
  const [restockModalProduct, setRestockModalProduct] = useState<Product | null>(null);
  const [restockQuantity, setRestockQuantity] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Automatically refresh products on mount and when inventory updates across the app
  useEffect(() => {
    onRefresh();

    const handleInventorySync = () => {
      onRefresh();
    };

    window.addEventListener('inventory-sync', handleInventorySync);
    return () => {
      window.removeEventListener('inventory-sync', handleInventorySync);
    };
  }, [onRefresh]);

  // Keep action modal product in sync with fresh product data from props
  useEffect(() => {
    if (actionModalProduct) {
      const fresh = products.find(p => p.id === actionModalProduct.id);
      if (fresh) setActionModalProduct(fresh);
    }
  }, [products]);

  // Extract unique categories
  const categories = ['TODAS', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'TODAS' || p.category === selectedCategory;
    
    // If showInactive is checked, show ONLY inactive. Otherwise, show ONLY active.
    // We treat null/undefined/1 as active, and false/0 as inactive.
    const isActive = p.isActive !== false && (p.isActive as any) !== 0;
    const matchesActive = showInactive ? !isActive : isActive;
    
    return matchesSearch && matchesCategory && matchesActive;
  });

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockModalProduct) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/products/${restockModalProduct.id}/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: restockQuantity,
          reason: 'Reabastecimiento manual desde inventario Nubly',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`Se agregaron +${restockQuantity} unidades a ${restockModalProduct.name}`);
        setRestockModalProduct(null);
        onRefresh();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('inventory-sync', { detail: { type: 'restock', timestamp: Date.now() } }));
          try {
            localStorage.setItem('nubly_last_inventory_sync', Date.now().toString());
          } catch {}
        }
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch {
      alert('Error al reabastecer producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (product: Product, targetStatus: boolean) => {
    const actionLabel = targetStatus ? 'activar' : 'desactivar';
    // Simplified confirmation for smoother UX
    if (!window.confirm(`¿Desea ${actionLabel} el producto "${product.name}"?`)) {
      throw new Error('Cancelled');
    }
    
    try {
      console.log(`[Inventory] Toggling ${product.id} to ${targetStatus}...`);
      const res = await fetch(`/api/v1/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: targetStatus }),
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        console.log('[Inventory] Toggle success:', data.data);
        setSuccessMessage(`Producto "${product.name}" ${targetStatus ? 'activado' : 'desactivado'} correctamente.`);
        onRefresh();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('inventory-sync', { detail: { type: 'update', timestamp: Date.now() } }));
        }
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        console.error('[Inventory] Toggle failed:', data);
        alert(data.error || `Error al ${actionLabel} el producto`);
        throw new Error(data.error);
      }
    } catch (err: any) {
      if (err.message === 'Cancelled') throw err;
      console.error('[Inventory] Network error:', err);
      alert(`Error de conexión al ${actionLabel} el producto`);
      throw err;
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`¿Está seguro de ELIMINAR PERMANENTEMENTE el producto "${product.name}"? Esta acción no se puede deshacer.`)) {
      throw new Error('Cancelled');
    }
    try {
      const res = await fetch(`/api/v1/products/${product.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSuccessMessage(`Producto "${product.name}" eliminado exitosamente.`);
        onRefresh();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('inventory-sync', { detail: { type: 'delete', timestamp: Date.now() } }));
        }
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        const err = await res.json();
        alert(err.error || 'No se pudo eliminar el producto');
        throw new Error(err.error);
      }
    } catch (err: any) {
      if (err.message === 'Cancelled') throw err;
      alert('Error al eliminar el producto');
      throw err;
    }
  };

  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.minStock && p.stock > 0).length;
  const criticalStockCount = products.filter((p) => p.stock <= 0).length;

  if (currentView === 'CREATE') {
    return (
      <ProductFormPage
        onSave={() => {
          setCurrentView('LIST');
          onRefresh();
          setSuccessMessage('Nuevo producto registrado exitosamente.');
          setTimeout(() => setSuccessMessage(null), 4000);
        }}
        onCancel={() => setCurrentView('LIST')}
      />
    );
  }

  if (currentView === 'EDIT' && editingProduct) {
    return (
      <ProductFormPage
        product={editingProduct}
        onSave={() => {
          setCurrentView('LIST');
          setEditingProduct(null);
          onRefresh();
          setSuccessMessage('Producto actualizado exitosamente.');
          setTimeout(() => setSuccessMessage(null), 4000);
        }}
        onCancel={() => {
          setCurrentView('LIST');
          setEditingProduct(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Optional Modular Subtabs (if envases module is enabled) */}
      {isEnvasesEnabled && (
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setInventorySubTab('CATALOG')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              inventorySubTab === 'CATALOG'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Catálogo General de Productos</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              inventorySubTab === 'CATALOG' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {products.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setInventorySubTab('BOTTLES_BUCKETS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              inventorySubTab === 'BOTTLES_BUCKETS'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Wine className="w-4 h-4" />
            <span>🍾 Inventario de Botellas Vacías & Tobos</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              inventorySubTab === 'BOTTLES_BUCKETS' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-900'
            }`}>
              Especial Licorería
            </span>
          </button>
        </div>
      )}

      {/* When viewing Bottles & Buckets */}
      {isEnvasesEnabled && inventorySubTab === 'BOTTLES_BUCKETS' ? (
        <BottlesAndBucketsView
          products={products}
          bcvRate={bcvRate}
          onRefreshProducts={onRefresh}
        />
      ) : (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Catálogo
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 mt-2">
            {products.length} <span className="text-xs font-semibold text-slate-400 font-sans">artículos</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">{totalUnits} unidades en stock total</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Stock Saludable
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-700 mt-2">
            {products.filter((p) => p.stock > p.minStock).length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Por encima del nivel mínimo</div>
        </div>

        <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              Stock Bajo (Alerta)
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-amber-700 mt-2">
            {lowStockCount}
          </div>
          <div className="text-xs text-amber-700/80 mt-1">Requiere pedido a proveedor</div>
        </div>

        <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
              Agotados (Crítico)
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-700 mt-2">
            {criticalStockCount}
          </div>
          <div className="text-xs text-rose-700/80 mt-1">Generando alerta activa en Cron</div>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-sm flex items-center gap-2 shadow-xs animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Filter and Actions Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, código o SKU..."
              className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
            />
          </div>

          <div className="relative inline-block text-left w-full md:w-56 z-30">
            <button
              id="category-dropdown-btn"
              type="button"
              onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all flex items-center justify-between gap-2 cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">Categoría: {selectedCategory === 'TODAS' ? 'Todas' : selectedCategory}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isCategoryDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setIsCategoryDropdownOpen(false)} 
                />
                <div className="absolute right-0 left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-40 max-h-60 overflow-y-auto divide-y divide-slate-100 py-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat);
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors block cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-blue-50 text-blue-700 font-extrabold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {cat === 'TODAS' ? 'Todas las Categorías' : cat}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            {/* Checkbox to see inactive products */}
            <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all text-xs font-bold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500/25 cursor-pointer"
              />
              <span>Ver Solo Inactivos</span>
            </label>

            <button
              type="button"
              onClick={() => setCurrentView('CREATE')}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nuevo Producto</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              className="text-xs text-slate-600 hover:text-blue-600 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors shrink-0 cursor-pointer font-medium"
              title="Actualizar catálogo"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Actualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Products Table (Clicking row opens action modal with Reabastecer, Editar, Eliminar) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-200">
              <tr>
                {!posConfig.hideProductPhotosAndEmojis && (
                  <th className="px-4 py-3.5">Foto / Ícono</th>
                )}
                <th className="px-4 py-3.5">Código / SKU</th>
                <th className="px-4 py-3.5">Producto</th>
                <th className="px-4 py-3.5">Categoría</th>
                <th className="px-4 py-3.5 text-right">Precio Venta</th>
                <th className="px-4 py-3.5 text-right">Costo Base</th>
                <th className="px-4 py-3.5 text-center">Stock Actual</th>
                <th className="px-4 py-3.5 text-center">Mínimo</th>
                <th className="px-4 py-3.5 text-center">Estado</th>
                <th className="px-4 py-3.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p, idx) => {
                const isCritical = p.stock <= 0;
                const isWarning = p.stock <= p.minStock && !isCritical;
                const margin = ((p.price - p.cost) / p.price) * 100;
                const emoji = getProductEmoji(p);

                return (
                  <tr 
                    key={`inv-prod-${p.id}-${idx}`} 
                    onClick={() => setActionModalProduct(p)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    title="Haga clic para reabastecer, editar o gestionar stock"
                  >
                    {/* Photo / Thumbnail column */}
                    {!posConfig.hideProductPhotosAndEmojis && (
                      <td className="px-4 py-3">
                        <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl">{emoji}</span>
                          )}
                        </div>
                      </td>
                    )}

                    <td className="px-4 py-3 font-mono text-xs">
                      <div className="text-blue-700 font-bold">{p.barcode}</div>
                      <div className="text-slate-400 text-[11px]">{p.sku}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{p.name}</div>
                      <div className="text-xs text-slate-500">Unidad: {p.unit}</div>
                    </td>

                    <td className="px-4 py-3 text-xs">
                      <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-lg border border-slate-200">
                        {p.category}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      ${p.price.toFixed(2)}
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">
                      ${p.cost.toFixed(2)}
                      <span className="text-[10px] text-emerald-600 font-semibold ml-1">({margin.toFixed(0)}%)</span>
                    </td>

                    <td className="px-4 py-3 text-center font-mono font-bold text-base">
                      <span className={isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-700'}>
                        {p.stock}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center font-mono text-xs text-slate-500">
                      {p.minStock}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {(p.isActive === false || (p.isActive as any) === 0) ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-slate-500">
                          Inactivo
                        </span>
                      ) : isCritical ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 border border-rose-200 text-rose-700">
                          Agotado
                        </span>
                      ) : isWarning ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700">
                          Stock Bajo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800">
                          Óptimo
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        Gestionar ▾
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRODUCT ACTION MODAL (Reabastecer, Editar, Eliminar) */}
      <ProductActionModal
        product={actionModalProduct}
        onClose={() => setActionModalProduct(null)}
        onOpenRestock={(product) => {
          setRestockModalProduct(product);
          setRestockQuantity(10);
        }}
        onOpenEdit={(product) => {
          setEditingProduct(product);
          setCurrentView('EDIT');
        }}
        onToggleActive={handleToggleActive}
        onDeleteProduct={handleDeleteProduct}
      />

      {/* RESTOCK MODAL */}
      {restockModalProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-blue-600" />
              Reabastecer Inventario
            </h3>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900">{restockModalProduct.name}</div>
              <div className="text-slate-500 font-mono">Código: {restockModalProduct.barcode}</div>
              <div className="text-slate-600">
                Stock actual: <span className="font-bold text-emerald-700">{restockModalProduct.stock}</span> (Mínimo: {restockModalProduct.minStock})
              </div>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1.5">
                  Cantidad a ingresar ({restockModalProduct.unit}):
                </label>
                <div className="flex gap-2 mb-2">
                  {[5, 10, 20, 50].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRestockQuantity(val)}
                      className={`flex-1 py-1 text-xs font-mono font-bold rounded-lg border transition-colors cursor-pointer ${
                        restockQuantity === val
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      +{val}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  value={restockQuantity}
                  onChange={(e) => setRestockQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl px-3 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockModalProduct(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20 cursor-pointer"
                >
                  {isSubmitting ? 'Guardando...' : 'Confirmar Ingreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}

    </div>
  );
};
