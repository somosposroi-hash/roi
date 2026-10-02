import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gift, 
  Plus, 
  Trash2, 
  Edit, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Search, 
  Layers, 
  Calendar, 
  X, 
  Copy, 
  Save, 
  Package, 
  Check, 
  AlertTriangle,
  ArrowRight,
  Boxes,
  Zap,
  Tag,
  DollarSign
} from 'lucide-react';
import { Combo, ComboFixedItem, ComboType, Product } from '../types';
import { 
  getLocalCombos, 
  syncCombos, 
  persistCombo, 
  removeCombo, 
  calculateUnitsToDeduct, 
  formatComboItemQuantity, 
  isComboAvailableNow, 
  checkComboStockAvailability,
  DAYS_OF_WEEK 
} from '../utils/combosHelper';
import { getProductEmoji } from '../utils/product-meta';
import { getLocalEnabledModules } from '../utils/systemModules';
import { getBeerBuckets, BeerBucket } from '../utils/bottleBucketService';

interface CombosViewProps {
  products: Product[];
  bcvRate: number;
}

export function CombosView({ products, bcvRate }: CombosViewProps) {
  const [combos, setCombos] = useState<Combo[]>(getLocalCombos);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | 'FIXED' | 'SELECTABLE'>('ALL');
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Partial<Combo> | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states for combo editor
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formCategory, setFormCategory] = useState('Combos');
  const [formType, setFormType] = useState<ComboType>('FIXED');
  const [formPrice, setFormPrice] = useState<number>(10);
  const [formIsActive, setFormIsActive] = useState(true);

  // Schedule states
  const [formIsAlwaysAvailable, setFormIsAlwaysAvailable] = useState(true);
  const [formAvailableDays, setFormAvailableDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [formHasTimeRange, setFormHasTimeRange] = useState(false);
  const [formStartTime, setFormStartTime] = useState('12:00');
  const [formEndTime, setFormEndTime] = useState('22:00');
  const [formHasDateRange, setFormHasDateRange] = useState(false);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');

  // Fixed items states
  const [formFixedItems, setFormFixedItems] = useState<ComboFixedItem[]>([]);
  const [selectedAddProductId, setSelectedAddProductId] = useState('');
  const [addQuantity, setAddQuantity] = useState<number>(1);
  const [addUnit, setAddUnit] = useState<string>('UND');

  // Selectable variety states
  const [formTotalSelectableQuantity, setFormTotalSelectableQuantity] = useState<number>(5);
  const [formSelectableProductIds, setFormSelectableProductIds] = useState<string[]>([]);
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');

  // Beer Bucket (Tobo de cerveza) configuration states (Envases module)
  const enabledModules = getLocalEnabledModules();
  const isEnvasesEnabled = enabledModules.includes('envases');
  const [beerBucketsList, setBeerBucketsList] = useState<BeerBucket[]>(getBeerBuckets);
  const [formIncludesBucket, setFormIncludesBucket] = useState<boolean>(false);
  const [formBucketId, setFormBucketId] = useState<string>('');
  const [formBucketQuantity, setFormBucketQuantity] = useState<number>(1);
  const [formIsBucketLoanable, setFormIsBucketLoanable] = useState<boolean>(true);
  const [formBucketDepositPrice, setFormBucketDepositPrice] = useState<number>(5.0);

  useEffect(() => {
    syncCombos().then(setCombos);
    setBeerBucketsList(getBeerBuckets());
  }, []);

  const handleOpenCreate = () => {
    setEditingCombo(null);
    setFormName('');
    setFormDescription('');
    setFormImageUrl('');
    setFormCategory('Combos');
    setFormType('FIXED');
    setFormPrice(10);
    setFormIsActive(true);
    setFormIsAlwaysAvailable(true);
    setFormAvailableDays([1, 2, 3, 4, 5, 6, 0]);
    setFormHasTimeRange(false);
    setFormStartTime('12:00');
    setFormEndTime('22:00');
    setFormHasDateRange(false);
    setFormStartDate('');
    setFormEndDate('');
    setFormFixedItems([]);
    setFormTotalSelectableQuantity(5);
    setFormSelectableProductIds([]);
    setFormIncludesBucket(false);
    setFormBucketId(beerBucketsList[0]?.id || '');
    setFormBucketQuantity(1);
    setFormIsBucketLoanable(true);
    setFormBucketDepositPrice(5.0);
    setIsEditingModalOpen(true);
  };

  const handleOpenEdit = (combo: Combo) => {
    setEditingCombo(combo);
    setFormName(combo.name);
    setFormDescription(combo.description || '');
    setFormImageUrl(combo.imageUrl || '');
    setFormCategory(combo.category || 'Combos');
    setFormType(combo.type);
    setFormPrice(combo.price);
    setFormIsActive(combo.isActive);
    setFormIsAlwaysAvailable(combo.isAlwaysAvailable ?? true);
    setFormAvailableDays(combo.availableDays || [1, 2, 3, 4, 5, 6, 0]);
    setFormHasTimeRange(combo.hasTimeRange ?? false);
    setFormStartTime(combo.startTime || '12:00');
    setFormEndTime(combo.endTime || '22:00');
    setFormHasDateRange(combo.hasDateRange ?? false);
    setFormStartDate(combo.startDate || '');
    setFormEndDate(combo.endDate || '');
    setFormFixedItems(combo.items ? [...combo.items] : []);
    setFormTotalSelectableQuantity(combo.totalSelectableQuantity || 5);
    setFormSelectableProductIds(combo.selectableProductIds ? [...combo.selectableProductIds] : []);
    setFormIncludesBucket(combo.includesBucket || false);
    setFormBucketId(combo.bucketId || beerBucketsList[0]?.id || '');
    setFormBucketQuantity(combo.bucketQuantity || 1);
    setFormIsBucketLoanable(combo.isBucketLoanable ?? true);
    setFormBucketDepositPrice(combo.bucketDepositPrice ?? 5.0);
    setIsEditingModalOpen(true);
  };

  const handleAddFixedItem = () => {
    if (!selectedAddProductId) return;
    const prod = products.find(p => p.id === selectedAddProductId);
    if (!prod) return;

    const unitsToDeduct = calculateUnitsToDeduct(prod.unit, addUnit, addQuantity);

    const newItem: ComboFixedItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: prod.id,
      productName: prod.name,
      productBarcode: prod.barcode,
      quantity: addQuantity,
      unit: addUnit,
      unitsToDeduct,
      unitPrice: prod.price,
      imageUrl: prod.imageUrl
    };

    setFormFixedItems(prev => [...prev, newItem]);
    setSelectedAddProductId('');
    setAddQuantity(1);
    setAddUnit('UND');
  };

  const handleRemoveFixedItem = (itemId: string) => {
    setFormFixedItems(prev => prev.filter(i => i.id !== itemId));
  };

  const handleToggleSelectableProduct = (productId: string) => {
    setFormSelectableProductIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleSelectAllBeers = () => {
    const beerIds = products
      .filter(p => p.name.toLowerCase().includes('cerveza') || p.category.toLowerCase().includes('licor') || p.unit === 'BOT')
      .map(p => p.id);
    setFormSelectableProductIds(Array.from(new Set([...formSelectableProductIds, ...beerIds])));
  };

  const handleSaveCombo = async () => {
    if (!formName.trim()) {
      setFeedback({ type: 'error', message: 'Debe ingresar un nombre para el combo.' });
      return;
    }
    if (formPrice < 0 || isNaN(formPrice)) {
      setFeedback({ type: 'error', message: 'El precio del combo debe ser un valor numérico válido.' });
      return;
    }

    if (formType === 'FIXED' && formFixedItems.length === 0) {
      setFeedback({ type: 'error', message: 'Un combo fijo debe contener al menos un producto.' });
      return;
    }

    if (formType === 'SELECTABLE' && formSelectableProductIds.length === 0) {
      setFeedback({ type: 'error', message: 'Debe seleccionar al menos un producto elegible para el combo variado.' });
      return;
    }

    const comboId = editingCombo?.id || `combo-${Date.now()}`;
    const comboToSave: Combo = {
      id: comboId,
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      imageUrl: formImageUrl.trim() || undefined,
      type: formType,
      price: Number(formPrice),
      category: formCategory,
      isActive: formIsActive,
      isAlwaysAvailable: formIsAlwaysAvailable,
      availableDays: formIsAlwaysAvailable ? undefined : formAvailableDays,
      hasTimeRange: formIsAlwaysAvailable ? false : formHasTimeRange,
      startTime: formHasTimeRange ? formStartTime : undefined,
      endTime: formHasTimeRange ? formEndTime : undefined,
      hasDateRange: formIsAlwaysAvailable ? false : formHasDateRange,
      startDate: formHasDateRange ? formStartDate : undefined,
      endDate: formHasDateRange ? formEndDate : undefined,
      items: formType === 'FIXED' ? formFixedItems : undefined,
      totalSelectableQuantity: formType === 'SELECTABLE' ? Number(formTotalSelectableQuantity) : undefined,
      selectableProductIds: formType === 'SELECTABLE' ? formSelectableProductIds : undefined,
      includesBucket: isEnvasesEnabled ? formIncludesBucket : undefined,
      bucketId: isEnvasesEnabled && formIncludesBucket ? formBucketId : undefined,
      bucketQuantity: isEnvasesEnabled && formIncludesBucket ? formBucketQuantity : undefined,
      isBucketLoanable: isEnvasesEnabled && formIncludesBucket ? formIsBucketLoanable : undefined,
      bucketDepositPrice: isEnvasesEnabled && formIncludesBucket ? formBucketDepositPrice : undefined,
      createdAt: editingCombo?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await persistCombo(comboToSave);
    if (result.success) {
      setCombos(getLocalCombos());
      setIsEditingModalOpen(false);
      setFeedback({ type: 'success', message: '¡Combo guardado exitosamente!' });
      setTimeout(() => setFeedback(null), 4000);
    } else {
      setFeedback({ type: 'error', message: result.error || 'No se pudo guardar el combo.' });
    }
  };

  const handleDeleteCombo = async (id: string) => {
    const result = await removeCombo(id);
    if (result.success) {
      setCombos(getLocalCombos());
      setDeleteConfirmId(null);
      setFeedback({ type: 'success', message: 'Combo eliminado exitosamente.' });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const filteredCombos = useMemo(() => {
    return combos.filter(c => {
      const matchesSearch = !searchQuery.trim() || 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;
      if (selectedTypeFilter === 'FIXED') return c.type === 'FIXED';
      if (selectedTypeFilter === 'SELECTABLE') return c.type === 'SELECTABLE';
      return true;
    });
  }, [combos, searchQuery, selectedTypeFilter]);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-950 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Gift className="w-3 h-3 text-amber-400" />
                <span>Módulo Opcional de Ventas Agrupadas</span>
              </div>
              <div className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Descuento de Stock Fraccionado (KG/G/UND/L)</span>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Combos & Paquetes Promocionales
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Cree combos de productos fijos o paquetes seleccionables variados (ej. 5 cervezas a escoger) con horarios y días específicos de disponibilidad. Al venderse en el POS, el inventario descuenta de forma exacta cada producto incluido.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Nuevo Combo</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {feedback && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-semibold ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="flex-1">{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toolbar & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o descripción..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedTypeFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({combos.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedTypeFilter('FIXED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedTypeFilter === 'FIXED'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📦 Combos Fijos
          </button>
          <button
            type="button"
            onClick={() => setSelectedTypeFilter('SELECTABLE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedTypeFilter === 'SELECTABLE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🔀 Seleccionables / Variados
          </button>
        </div>
      </div>

      {/* Combos Cards / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCombos.length === 0 ? (
          <div className="col-span-full py-16 text-center space-y-3 bg-white border border-slate-200 rounded-3xl">
            <Gift className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-base font-bold text-slate-700">No hay combos registrados</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Presione el botón "Crear Nuevo Combo" para agregar paquetes de productos fijos o variados.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Primer Combo</span>
            </button>
          </div>
        ) : (
          filteredCombos.map((combo, idx) => {
            const avail = isComboAvailableNow(combo);
            const stock = checkComboStockAvailability(combo, products);
            const isFixed = combo.type === 'FIXED';

            return (
              <div
                key={`combo-card-${combo.id || idx}-${idx}`}
                className={`bg-white border rounded-3xl p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md relative ${
                  !combo.isActive 
                    ? 'border-slate-200 opacity-60' 
                    : !avail.isAvailable 
                    ? 'border-amber-200 bg-amber-50/20' 
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div>
                  {/* Top Badges & Image */}
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center text-3xl shadow-xs">
                      {combo.imageUrl ? (
                        <img src={combo.imageUrl} alt={combo.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>🎁</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          combo.type === 'SELECTABLE'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : 'bg-blue-100 text-blue-900 border border-blue-200'
                        }`}>
                          {combo.type === 'SELECTABLE' ? '🔀 Variado' : '📦 Fijo'}
                        </span>

                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          avail.isAvailable 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          <Clock className="w-2.5 h-2.5" />
                          <span>{avail.statusLabel}</span>
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-black text-slate-900 mt-1 line-clamp-1">
                        {combo.name}
                      </h3>

                      {combo.category && (
                        <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                          Categoría: {combo.category}
                        </span>
                      )}
                    </div>
                  </div>

                  {combo.description && (
                    <p className="text-xs text-slate-600 mb-3 line-clamp-2 leading-relaxed">
                      {combo.description}
                    </p>
                  )}

                  {/* Included items breakdown */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1.5 mb-3">
                    {isFixed && combo.items && (
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                          Productos en el combo:
                        </div>
                        <div className="space-y-1">
                          {combo.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px] text-slate-700">
                              <span className="font-semibold">{item.productName}</span>
                              <span className="font-mono text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                {formatComboItemQuantity(item)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {combo.type === 'SELECTABLE' && (
                      <div className="text-[11px] text-amber-900 font-medium">
                        <span>🎯 El cliente selecciona <strong>{combo.totalSelectableQuantity || 5} unidades</strong> entre {combo.selectableProductIds?.length || 0} marcas registradas.</span>
                      </div>
                    )}

                    {/* Stock indicator */}
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">Stock para armar:</span>
                      <span className={`font-bold ${stock.hasStock ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {stock.hasStock ? `${stock.maxCombosAvailable} disponibles` : 'Sin existencias'}
                      </span>
                    </div>
                  </div>

                  {/* Schedule Details */}
                  {!combo.isAlwaysAvailable && (
                    <div className="text-[10px] text-slate-500 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100 space-y-0.5 mb-3">
                      <div className="font-bold text-blue-900 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-blue-600" />
                        <span>Horario Programado:</span>
                      </div>
                      {combo.availableDays && (
                        <div>
                          Días: {combo.availableDays.map(d => DAYS_OF_WEEK.find(day => day.day === d)?.short).join(', ')}
                        </div>
                      )}
                      {combo.hasTimeRange && (
                        <div>Horas: {combo.startTime} a {combo.endTime}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Row: Price & Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-base font-black font-mono text-slate-900">
                      ${combo.price.toFixed(2)} USD
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      Bs. {(combo.price * bcvRate).toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(combo)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                      title="Editar Combo"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(combo.id)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                      title="Eliminar Combo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Delete confirmation dialog */}
                {deleteConfirmId === combo.id && (
                  <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xs rounded-3xl p-5 flex flex-col justify-center items-center text-center text-white z-20 space-y-3">
                    <AlertTriangle className="w-8 h-8 text-amber-400" />
                    <div>
                      <h4 className="text-sm font-bold">¿Eliminar este combo?</h4>
                      <p className="text-[11px] text-slate-300">Esta acción no elimina los productos individuales de su inventario.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteCombo(combo.id)}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
                      >
                        Sí, Eliminar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1.5 rounded-xl bg-slate-700 text-white text-xs font-bold hover:bg-slate-600 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* CREATE / EDIT COMBO MODAL */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {editingCombo ? 'Editar Combo Promocional' : 'Configurar Nuevo Combo'}
                  </h3>
                  <p className="text-xs text-blue-100">
                    Defina los productos, precios, fraccionamiento y horarios de venta.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {/* SECTION 1: General Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <span>Información General del Combo</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Nombre del Combo *
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ej: Combo Cervezas 5x$10, Combo Desayuno Criollo..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Precio de Venta del Combo (USD) *
                    </label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        value={formPrice}
                        onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-4 py-2.5 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                      Bs. {(formPrice * bcvRate).toFixed(2)} (Tasa BCV {bcvRate.toFixed(2)})
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Categoría
                    </label>
                    <input
                      type="text"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      placeholder="Ej: Licores, Alimentos, Promociones..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      URL de Imagen del Combo (Opcional)
                    </label>
                    <input
                      type="text"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Descripción o Detalles
                    </label>
                    <textarea
                      rows={2}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Explique qué incluye el combo o las condiciones de venta..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Combo Type Selection */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Boxes className="w-4 h-4 text-blue-600" />
                  <span>Tipo de Estructura del Combo</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setFormType('FIXED')}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      formType === 'FIXED'
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-5 h-5 text-blue-600" />
                      <h5 className="text-xs font-black text-slate-900">📦 Combo Fijo</h5>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Incluye productos exactos y cantidades configuradas por unidades, gramos, kilos o litros (ej. 1 Harina P.A.N. + 500g de Queso).
                    </p>
                  </div>

                  <div
                    onClick={() => setFormType('SELECTABLE')}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      formType === 'SELECTABLE'
                        ? 'border-amber-600 bg-amber-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Gift className="w-5 h-5 text-amber-600" />
                      <h5 className="text-xs font-black text-slate-900">🔀 Combo Seleccionable / Variado</h5>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      El cliente escoge la combinación que desee entre varias marcas (ej. Lleva 5 cervezas de 4 marcas disponibles por $10).
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 3A: If FIXED -> Products & Quantities / Measurements */}
              {formType === 'FIXED' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Productos Incluidos en el Combo Fijo
                    </h5>
                    <span className="text-[11px] font-bold text-slate-500">
                      {formFixedItems.length} productos agregados
                    </span>
                  </div>

                  {/* Add Product Line Controls */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-6">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                          Seleccionar Producto del Inventario
                        </label>
                        <select
                          value={selectedAddProductId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedAddProductId(val);
                            const prod = products.find(p => p.id === val);
                            if (prod) {
                              if (prod.unit === 'KG') setAddUnit('G');
                              else if (prod.unit === 'LTR') setAddUnit('ML');
                              else setAddUnit(prod.unit);
                            }
                          }}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                        >
                          <option value="">-- Escoja un producto --</option>
                          {products.filter(p => p.isActive).map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.barcode}) - Stock: {p.stock} {p.unit}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                          Cantidad
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={addQuantity}
                          onChange={(e) => setAddQuantity(parseFloat(e.target.value) || 1)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600 focus:bg-white"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                          Unidad
                        </label>
                        <select
                          value={addUnit}
                          onChange={(e) => setAddUnit(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-600 focus:bg-white"
                        >
                          <option value="UND">Unidades (UND)</option>
                          <option value="G">Gramos (g)</option>
                          <option value="KG">Kilos (kg)</option>
                          <option value="ML">Mililitros (ml)</option>
                          <option value="LTR">Litros (L)</option>
                          <option value="PAQ">Paquete (PAQ)</option>
                          <option value="BOT">Botella (BOT)</option>
                          <option value="MTS">Metros (MTS)</option>
                          <option value="CM">Centímetros (CM)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        disabled={!selectedAddProductId}
                        onClick={handleAddFixedItem}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          selectedAddProductId
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir Producto al Combo</span>
                      </button>
                    </div>
                  </div>

                  {/* List of Added Fixed Items */}
                  <div className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {formFixedItems.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No ha añadido ningún producto a este combo todavía.
                      </div>
                    ) : (
                      formFixedItems.map((item, idx) => (
                        <div key={item.id || idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h5 className="font-bold text-slate-900 truncate">
                                {item.productName}
                              </h5>
                              <span className="text-[10px] text-slate-500 font-mono">
                                ({item.productBarcode}) • Descuenta: {item.unitsToDeduct} unidades de stock
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold text-slate-800">
                              {formatComboItemQuantity(item)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFixedItem(item.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 3B: If SELECTABLE -> Pool & Quota Configuration */}
              {formType === 'SELECTABLE' && (
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h5 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                        Configuración de Variedad & Cuota
                      </h5>
                      <p className="text-[11px] text-amber-800">
                        Defina cuántas unidades totales conforma el combo y marque las opciones permitidas.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-amber-950">
                        Cuota Requerida:
                      </label>
                      <input
                        type="number"
                        min="2"
                        max="100"
                        value={formTotalSelectableQuantity}
                        onChange={(e) => setFormTotalSelectableQuantity(parseInt(e.target.value, 10) || 5)}
                        className="w-20 bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-mono font-black text-center"
                      />
                      <span className="text-xs font-bold text-amber-900">unidades</span>
                    </div>
                  </div>

                  {/* Candidate Product Picker */}
                  <div className="bg-white p-4 rounded-xl border border-amber-200 space-y-3">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={candidateSearchQuery}
                          onChange={(e) => setCandidateSearchQuery(e.target.value)}
                          placeholder="Filtrar marcas disponibles..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSelectAllBeers}
                        className="text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                      >
                        🍺 Marcar Todas las Cervezas
                      </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                      {products
                        .filter(p => (p.isActive !== false && (p.isActive as any) !== 0) && (!candidateSearchQuery.trim() || p.name.toLowerCase().includes(candidateSearchQuery.toLowerCase())))
                        .map((p, idx) => {
                          const isSelected = formSelectableProductIds.includes(p.id);

                          return (
                            <div
                              key={`combo-cand-prod-${p.id}-${idx}`}
                              onClick={() => handleToggleSelectableProduct(p.id)}
                              className={`p-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                                isSelected ? 'bg-amber-50/80 font-bold' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                                />
                                <span className="truncate text-slate-900">{p.name}</span>
                              </div>

                              <div className="flex items-center gap-3 shrink-0 text-slate-500 font-mono text-[11px]">
                                <span>Stock: {p.stock} {p.unit}</span>
                                <span>Ref: ${p.price.toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    <div className="text-[11px] text-amber-900 font-medium">
                      ✓ <strong>{formSelectableProductIds.length} productos</strong> seleccionados para que el cliente escoja {formTotalSelectableQuantity} unidades en el POS.
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: Tobo de Cerveza (Envases & Tobos Module) */}
              {isEnvasesEnabled && (
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5 border-b border-amber-100 pb-2">
                    <span className="text-base">🪣</span>
                    <span>Tobo de Cerveza & Baldes (Envases y Retornables)</span>
                  </h4>

                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer select-none bg-white p-3 rounded-xl border border-amber-200">
                      <input
                        type="checkbox"
                        checked={formIncludesBucket}
                        onChange={(e) => setFormIncludesBucket(e.target.checked)}
                        className="w-4.5 h-4.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          ¿Este combo incluye tobo de cerveza para servir o prestar?
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Permite escoger qué tobo de su inventario usa y controlar el préstamo con garantía al cliente en el POS.
                        </span>
                      </div>
                    </label>

                    {formIncludesBucket && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-white rounded-xl border border-amber-200 animate-fade-in">
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Seleccionar Tobo del Inventario:
                          </label>
                          <select
                            value={formBucketId}
                            onChange={(e) => setFormBucketId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-600"
                          >
                            {beerBucketsList.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name} (Disponibles: {b.availableStock} de {b.totalStock})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Cant. Tobos:
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={formBucketQuantity}
                            onChange={(e) => setFormBucketQuantity(parseInt(e.target.value, 10) || 1)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-amber-600"
                          />
                        </div>

                        <div className="sm:col-span-3 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                            <input
                              type="checkbox"
                              checked={formIsBucketLoanable}
                              onChange={(e) => setFormIsBucketLoanable(e.target.checked)}
                              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                            />
                            <span>Permitir prestar tobo al cliente fuera del local</span>
                          </label>

                          {formIsBucketLoanable && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 font-medium">Depósito sugerido:</span>
                              <div className="relative w-28">
                                <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">$</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={formBucketDepositPrice}
                                  onChange={(e) => setFormBucketDepositPrice(parseFloat(e.target.value) || 0)}
                                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-6 pr-2 py-1 text-xs text-slate-900 font-mono font-bold"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 4: Schedule & Availability */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Programación de Horarios & Días de Disponibilidad</span>
                </h4>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  {/* Always available toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-black text-slate-900">
                        Disponibilidad 24/7 Permanente
                      </h5>
                      <p className="text-[11px] text-slate-500">
                        El combo estará disponible en cualquier día y horario mientras el negocio esté abierto.
                      </p>
                    </div>

                    <div 
                      onClick={() => setFormIsAlwaysAvailable(!formIsAlwaysAvailable)}
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                        formIsAlwaysAvailable ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                      }`}
                    >
                      <div className="w-5 h-5 bg-white rounded-full shadow-md" />
                    </div>
                  </div>

                  {/* If not always available -> Specific schedule controls */}
                  {!formIsAlwaysAvailable && (
                    <div className="pt-4 border-t border-slate-200 space-y-4 animate-in fade-in duration-200">
                      
                      {/* Day of Week Selector */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-slate-800">
                            Días de la semana permitidos:
                          </label>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setFormAvailableDays([1, 2, 3, 4, 5, 6, 0])}
                              className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 font-bold"
                            >
                              Todos
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormAvailableDays([1, 2, 3, 4, 5])}
                              className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 font-bold"
                            >
                              Lun a Vie
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormAvailableDays([6, 0])}
                              className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 font-bold"
                            >
                              Fines de Semana
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {DAYS_OF_WEEK.map((d) => {
                            const isDaySelected = formAvailableDays.includes(d.day);

                            return (
                              <button
                                key={d.day}
                                type="button"
                                onClick={() => {
                                  if (isDaySelected) {
                                    setFormAvailableDays(prev => prev.filter(x => x !== d.day));
                                  } else {
                                    setFormAvailableDays(prev => [...prev, d.day]);
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                  isDaySelected
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {d.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Hour Time Range */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800">
                            Restringir a Horario Específico (ej. Happy Hour)
                          </label>
                          <input
                            type="checkbox"
                            checked={formHasTimeRange}
                            onChange={(e) => setFormHasTimeRange(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                        </div>

                        {formHasTimeRange && (
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                                Hora Inicio
                              </label>
                              <input
                                type="time"
                                value={formStartTime}
                                onChange={(e) => setFormStartTime(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                                Hora Fin
                              </label>
                              <input
                                type="time"
                                value={formEndTime}
                                onChange={(e) => setFormEndTime(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Campaign Date Range */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800">
                            Vigencia por Rango de Fechas (Campaña Temporal)
                          </label>
                          <input
                            type="checkbox"
                            checked={formHasDateRange}
                            onChange={(e) => setFormHasDateRange(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                        </div>

                        {formHasDateRange && (
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                                Fecha Inicio
                              </label>
                              <input
                                type="date"
                                value={formStartDate}
                                onChange={(e) => setFormStartDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                                Fecha Fin
                              </label>
                              <input
                                type="date"
                                value={formEndDate}
                                onChange={(e) => setFormEndDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSaveCombo}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-blue-500/25 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{editingCombo ? 'Guardar Cambios' : 'Crear Combo'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
