import React, { useState, useRef } from 'react';
import { Package, ArrowLeft, Camera, Sparkles, Check, AlertCircle, Trash2, Box, Layers, Tag, ShoppingBag, Plus, Wine } from 'lucide-react';
import { Product, ProductPresentation, PresentationType } from '../types';
import { GoogleImageSearchModal } from './GoogleImageSearchModal';
import { detectMeasurementCategory } from '../utils/measurementHelper';
import { getLocalEnabledModules } from '../utils/systemModules';
import { getProductReturnableConfig, getEmptyBottlesMap, saveEmptyBottlesMap } from '../utils/bottleBucketService';

interface ProductFormPageProps {
  product?: Product | null;
  onSave: () => void;
  onCancel: () => void;
}

export const ProductFormPage: React.FC<ProductFormPageProps> = ({
  product,
  onSave,
  onCancel,
}) => {
  const enabledModules = getLocalEnabledModules();
  const isEnvasesEnabled = enabledModules.includes('envases');

  const [name, setName] = useState(product ? product.name : '');
  const [barcode, setBarcode] = useState(product ? product.barcode : '');
  const [sku, setSku] = useState(product ? product.sku : '');
  const [category, setCategory] = useState(product ? product.category : 'Alimentos');
  const [price, setPrice] = useState(product ? product.price.toString() : '');
  const [wholesalePrice, setWholesalePrice] = useState(product && product.wholesalePrice !== undefined && product.wholesalePrice !== null ? product.wholesalePrice.toString() : '');
  const [cost, setCost] = useState(product ? product.cost.toString() : '');
  const [stock, setStock] = useState(product ? product.stock.toString() : '20');
  const [minStock, setMinStock] = useState(product ? product.minStock.toString() : '5');
  const [unit, setUnit] = useState(product ? product.unit : 'UND');
  const [imageUrl, setImageUrl] = useState<string | null>(product ? product.imageUrl || null : null);

  // Returnable Bottle Configuration State
  const initialBottleConfig = product ? getProductReturnableConfig(product) : {
    hasReturnableBottle: false,
    bottleName: '',
    emptyBottleStock: 0,
    bottleDepositPrice: 0.5,
    supplierReturnPackSize: 24,
  };
  const [hasReturnableBottle, setHasReturnableBottle] = useState<boolean>(initialBottleConfig.hasReturnableBottle || false);
  const [bottleName, setBottleName] = useState<string>(initialBottleConfig.bottleName || '');
  const [emptyBottleStock, setEmptyBottleStock] = useState<number>(
    product ? (getEmptyBottlesMap()[product.id] ?? initialBottleConfig.emptyBottleStock ?? 0) : 0
  );
  const [bottleDepositPrice, setBottleDepositPrice] = useState<number>(initialBottleConfig.bottleDepositPrice ?? 0.5);
  const [supplierReturnPackSize, setSupplierReturnPackSize] = useState<number>(initialBottleConfig.supplierReturnPackSize ?? 24);

  // Scale / Weighable Product Configuration State
  const [isWeighable, setIsWeighable] = useState<boolean>(product?.isWeighable || false);
  const [plu, setPlu] = useState<string>(product?.plu || '');

  // Variable Price Configuration State
  const [isVariablePrice, setIsVariablePrice] = useState<boolean>(product?.isVariablePrice || false);
  const [variablePriceCurrency, setVariablePriceCurrency] = useState<'USD' | 'BS'>(product?.variablePriceCurrency || 'USD');

  // Profit Margin Calculation State
  const [calcMargin, setCalcMargin] = useState<boolean>(false);
  const [marginPercent, setMarginPercent] = useState<string>('30');

  const calculatePriceFromMargin = (cStr: string, mStr: string) => {
    const costVal = parseFloat(cStr) || 0;
    const marginVal = parseFloat(mStr) || 0;
    if (costVal > 0 && marginVal > 0 && marginVal < 100) {
      const calculated = costVal / (1 - marginVal / 100);
      setPrice(calculated.toFixed(2));
    }
  };

  const handleCostChange = (newCost: string) => {
    setCost(newCost);
    if (calcMargin) {
      calculatePriceFromMargin(newCost, marginPercent);
    }
  };

  const handleMarginChange = (newMargin: string) => {
    setMarginPercent(newMargin);
    calculatePriceFromMargin(cost, newMargin);
  };

  const handleToggleCalcMargin = (checked: boolean) => {
    setCalcMargin(checked);
    if (checked) {
      calculatePriceFromMargin(cost, marginPercent);
    }
  };

  const initialPresentations: ProductPresentation[] = product?.presentations || (
    product?.presentationsJson ? JSON.parse(product.presentationsJson) : []
  );
  const [presentations, setPresentations] = useState<ProductPresentation[]>(initialPresentations);
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSearchOpen, setIsGoogleSearchOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryType = detectMeasurementCategory(unit);

  const getPresentation = (type: PresentationType): ProductPresentation => {
    const found = presentations.find((p) => p.type === type);
    if (found) return found;

    // Default presets
    let name = '';
    let unitsToDeduct = 1;
    if (type === 'CAJA') { name = 'Caja de mercancía'; unitsToDeduct = 12; }
    else if (type === 'SIXPACK') { name = 'Sixpack (6 unds)'; unitsToDeduct = 6; }
    else if (type === 'COMBO') { name = 'Combo oferta'; unitsToDeduct = 6; }
    else if (type === 'BULTO') { name = categoryType === 'WEIGHT' ? 'Bulto de peso' : categoryType === 'LENGTH' ? 'Atado de metros' : categoryType === 'VOLUME' ? 'Tambor / Cesta' : 'Bulto al mayor'; unitsToDeduct = 20; }
    else { name = 'Presentación personalizada'; unitsToDeduct = 5; }

    return {
      id: `pres-${type.toLowerCase()}`,
      type,
      name,
      unitsToDeduct,
      packagePrice: parseFloat(price || '0') * unitsToDeduct * 0.9,
      enabled: false,
    };
  };

  const togglePresentation = (type: PresentationType) => {
    setPresentations((prev) => {
      const idx = prev.findIndex((p) => p.type === type);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
        return updated;
      } else {
        const newPres = getPresentation(type);
        newPres.enabled = true;
        return [...prev, newPres];
      }
    });
  };

  const updatePresentationField = (type: PresentationType, field: keyof ProductPresentation, value: any) => {
    setPresentations((prev) => {
      const idx = prev.findIndex((p) => p.type === type);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], [field]: value };
        return updated;
      } else {
        const newPres = getPresentation(type);
        (newPres as any)[field] = value;
        return [...prev, newPres];
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !barcode.trim() || !price) {
      setErrorMessage('Por favor complete los campos obligatorios: Nombre, Código de Barras y Precio.');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = product ? `/api/v1/products/${product.id}` : '/api/v1/products';
      const method = product ? 'PATCH' : 'POST';

      const returnableConfig = hasReturnableBottle ? {
        hasReturnableBottle: true,
        bottleName: bottleName.trim() || `Botella ${name.trim()} Retornable`,
        emptyBottleStock: Number(emptyBottleStock) || 0,
        bottleDepositPrice: Number(bottleDepositPrice) || 0.5,
        supplierReturnPackSize: Number(supplierReturnPackSize) || 24,
      } : {
        hasReturnableBottle: false,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          barcode: barcode.trim(),
          sku: sku.trim() || undefined,
          category,
          price: isVariablePrice ? 0 : (parseFloat(price) || 0),
          wholesalePrice: (isVariablePrice || !wholesalePrice) ? null : parseFloat(wholesalePrice),
          cost: isVariablePrice ? 0 : (cost ? parseFloat(cost) : (parseFloat(price) || 0) * 0.7),
          stock: isVariablePrice ? 99999 : (parseFloat(stock) || 0),
          minStock: isVariablePrice ? 0 : (parseFloat(minStock) || 5),
          unit,
          imageUrl,
          presentations: isVariablePrice ? [] : presentations.filter((p) => p.enabled),
          returnableBottleConfig: isVariablePrice ? { hasReturnableBottle: false } : returnableConfig,
          isWeighable: isVariablePrice ? false : isWeighable,
          plu: (isVariablePrice || !plu) ? undefined : plu.trim(),
          isVariablePrice,
          variablePriceCurrency,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const savedProdId = data.data?.id || product?.id;
        if (savedProdId && hasReturnableBottle) {
          const emptyMap = getEmptyBottlesMap();
          emptyMap[savedProdId] = Number(emptyBottleStock) || 0;
          saveEmptyBottlesMap(emptyMap);
        }
        onSave();
      } else {
        setErrorMessage(data.error?.message || 'Error al guardar el producto');
      }
    } catch {
      setErrorMessage('Error de conexión con el servidor local');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-fade-in">
      
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Inventario</span>
        </button>

        <h2 className="text-base font-extrabold text-slate-900">
          {product ? `Editar Producto: ${product.name}` : 'Registrar Nuevo Producto'}
        </h2>

        <div className="w-24" /> {/* Spacer */}
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        
        {/* Photo Section with Google Image Search & Upload */}
        <div>
          <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">
            Imagen del Producto (Google Imágenes / Archivo Local)
          </label>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            {/* Preview Box */}
            <div className="aspect-square bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden flex items-center justify-center relative shadow-inner">
              {imageUrl ? (
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Package className="w-12 h-12 text-slate-400" />
              )}
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700 transition-colors cursor-pointer"
                  title="Quitar foto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="sm:col-span-2 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />

              <button
                type="button"
                onClick={() => setIsGoogleSearchOpen(true)}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              >
                <Sparkles className="w-5 h-5 text-amber-300" />
                <span>Buscar 10 Fotos en Google Imágenes</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-200"
              >
                <Camera className="w-4 h-4 text-blue-600" />
                <span>Subir Imagen desde mi Computadora</span>
              </button>

              <p className="text-[11px] text-slate-500 text-center">
                El buscador de Google extraerá opciones de alta resolución usando el nombre del producto.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          
          {/* Product Name */}
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Nombre del Producto *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Nutella Frasco 350g, Harina PAN..."
              className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          {/* Barcode */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Código de Barras *
            </label>
            <input
              type="text"
              required
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Ej: 7591011000123"
              className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          {/* SKU */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              SKU (Referencia Interna)
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Ej: NUTC-350"
              className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Categoría
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="Alimentos">Alimentos</option>
              <option value="Licores y Bebidas">Licores y Bebidas</option>
              <option value="Importados & Dulces">Importados & Dulces</option>
              <option value="Lácteos & Delicatessen">Lácteos & Delicatessen</option>
              <option value="Snacks">Snacks</option>
              <option value="Cuidado Personal & Limpieza">Cuidado Personal & Limpieza</option>
            </select>
          </div>

          {/* Unit */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Unidad Base de Medida
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="UND">UND (Unidades / Piezas)</option>
              <option value="KG">KG (Kilogramos)</option>
              <option value="G">G (Gramos)</option>
              <option value="MTS">MTS (Metros)</option>
              <option value="CM">CM (Centímetros)</option>
              <option value="LTR">LTR (Litros)</option>
              <option value="ML">ML (Mililitros)</option>
              <option value="PAQ">PAQ (Paquetes)</option>
              <option value="BOT">BOT (Botellas)</option>
            </select>
          </div>

          {!isVariablePrice && (
            <>
              {/* Cost USD - FIRST */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Costo Base ($ USD)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={cost}
                  onChange={(e) => handleCostChange(e.target.value)}
                  placeholder="Ej: 100.00"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              {/* Profit Margin Calculator Checkbox & Controls */}
              <div className="col-span-1 sm:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={calcMargin}
                      onChange={(e) => handleToggleCalcMargin(e.target.checked)}
                      className="w-4.5 h-4.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Calcular margen de ganancia automáticamente</span>
                    </span>
                  </label>
                  <span className="text-[10px] font-mono bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md border border-blue-200">
                    Fórmula ERP Retail
                  </span>
                </div>

                {calcMargin && (
                  <div className="space-y-3 pt-2 border-t border-slate-200 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="w-full sm:w-48">
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          % Margen de Ganancia deseado
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            max="99"
                            value={marginPercent}
                            onChange={(e) => handleMarginChange(e.target.value)}
                            placeholder="30"
                            className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 text-sm text-slate-900 font-mono font-bold pr-8"
                          />
                          <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                        </div>
                      </div>

                      {/* Preset Margin Buttons */}
                      <div className="flex-1">
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Márgenes Estándar Retail:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {['10', '15', '20', '25', '30', '35', '40', '50'].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleMarginChange(preset)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer ${
                                marginPercent === preset
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {preset}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Calculation breakdown summary */}
                    {parseFloat(cost) > 0 && parseFloat(marginPercent) > 0 && (
                      <div className="bg-white border border-blue-100 rounded-xl p-3 text-xs space-y-1 font-mono text-slate-700">
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Fórmula: Precio = Costo / (1 - {parseFloat(marginPercent) / 100})</span>
                          <span className="font-bold text-blue-600">
                            Denominador: {(1 - parseFloat(marginPercent) / 100).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-bold text-slate-900 pt-1 border-t border-slate-100">
                          <span>Ganancia Nula Bruta:</span>
                          <span className="text-emerald-600">
                            +${((parseFloat(price) || 0) - (parseFloat(cost) || 0)).toFixed(2)} USD
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Margen Bruto Real sobre Ventas en Caja:</span>
                          <span className="font-bold text-slate-800">
                            {(((parseFloat(price) || 0) - (parseFloat(cost) || 0)) / (parseFloat(price) || 1) * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Price USD - SECOND */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Precio Unitario Base ($ USD) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  required={!isVariablePrice}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Ej: 142.86"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              {/* Wholesale Price USD - OPTIONAL */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center justify-between">
                  <span>Precio al Mayor ($ USD)</span>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    Opcional • POS Con Clave
                  </span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(e.target.value)}
                  placeholder="Ej: 120.00"
                  className="w-full bg-slate-50 border border-purple-200 focus:border-purple-600 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-purple-600/20"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Precio especial para ventas al mayor. Para activarlo en el POS requerirá escanear o ingresar la clave de supervisor.
                </p>
              </div>

              {/* Initial Stock */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Stock Inicial ({unit})
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              {/* Min Stock */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Stock Mínimo (Alerta)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </>
          )}

        </div>

        {/* SCALE / WEIGHABLE PRODUCT CONFIGURATION CARD */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isWeighable}
                onChange={(e) => {
                  setIsWeighable(e.target.checked);
                  if (e.target.checked && !plu) {
                    setPlu('2244');
                  }
                }}
                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <div>
                <span className="text-sm font-black text-emerald-950 flex items-center gap-2">
                  <span>⚖️ Producto Pesable (Balanza Etiquetadora)</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 uppercase">
                    EAN-13 / EAN-14 Prefijo 21
                  </span>
                </span>
                <span className="text-xs text-emerald-800/80 block mt-0.5">
                  Usa código EAN-13 / EAN-14 con prefijo 21 (PLU + Precio dinámico) para carnicerías, charcuterías y productos al peso.
                </span>
              </div>
            </label>
          </div>

          {isWeighable && (
            <div className="space-y-4 pt-3 border-t border-emerald-200/80 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-emerald-950 block mb-1">
                    Código / PLU de la Balanza *
                  </label>
                  <input
                    type="text"
                    required={isWeighable}
                    value={plu}
                    onChange={(e) => setPlu(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Ej: 2244 o 2222"
                    className="w-full bg-white border border-emerald-300 focus:border-emerald-600 rounded-xl px-4 py-2.5 text-sm font-mono font-black text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="text-[10px] text-emerald-800 font-medium mt-1">
                    Código/PLU (debe coincidir con el PLU programado en la memoria de su balanza)
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Vista previa de Código EAN-14 impreso
                  </label>
                  <div className="bg-white border border-emerald-300 rounded-xl p-2.5 font-mono text-xs font-black text-emerald-900 flex items-center justify-between">
                    <span>2100{(plu || '2244').padStart(4, '0').slice(-4)}000994</span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">14 Dígitos</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Formato: Prefijo 21 + 00 + PLU ({plu || '2244'}) + Precio*100 (00099 = $0.99) + Dígito
                  </p>
                </div>
              </div>

              {/* Informational Box */}
              <div className="bg-white/90 border border-emerald-300 rounded-xl p-4 text-xs text-slate-800 space-y-2 leading-relaxed shadow-xs">
                <div className="font-black text-emerald-950 flex items-center gap-1.5 text-xs">
                  <span>ℹ️ Configuración de Balanza EAN-13 / EAN-14:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700">
                  <li><strong>Código/PLU:</strong> {plu || '2222'} (Debe coincidir con el PLU asignado en la balanza)</li>
                  <li><strong>Formato EAN-14:</strong> <code>21</code> + <code>0</code> + <code>PLU (5 dígitos)</code> + <code>Precio*100 (5 dígitos)</code> + <code>Dígito</code></li>
                  <li><strong>Ejemplo:</strong> Si el código es <code>{plu || '2244'}</code> y el precio es <code>$0.99</code> → <code>2100{(plu || '2244').padStart(4, '0').slice(-4)}000994</code> (Total: 14 dígitos)</li>
                  <li className="text-emerald-900 font-semibold">El precio y el peso se leen dinámicamente del código para que al escanear etiquetas de su balanza etiquetadora el sistema sepa decodificarlas y agregarlas al carrito.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* VARIABLE PRICE PRODUCT CONFIGURATION CARD */}
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isVariablePrice}
                onChange={(e) => {
                  setIsVariablePrice(e.target.checked);
                  if (e.target.checked) {
                    // Set stock to 99999 and cost to 0 if it's variable price (as per user request "sin stock sin costo")
                    setStock('99999');
                    setCost('0');
                  }
                }}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <div>
                <span className="text-sm font-black text-indigo-950 flex items-center gap-2">
                  <span>🏷️ Producto con Precio Modificable (Open Price)</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-200 text-indigo-900 uppercase">
                    Especial Servicios / Varios
                  </span>
                </span>
                <span className="text-xs text-indigo-800/80 block mt-0.5">
                  El precio NO está fijo. Al marcar el producto en el POS, se le solicitará ingresar el monto manualmente.
                </span>
              </div>
            </label>
          </div>

          {isVariablePrice && (
            <div className="space-y-4 pt-3 border-t border-indigo-200/80 animate-fade-in">
              <div className="bg-white/90 border border-indigo-300 rounded-xl p-4 space-y-3 shadow-xs">
                <label className="text-xs font-black text-indigo-950 block">
                  Moneda solicitada al ingresar precio en POS:
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setVariablePriceCurrency('USD')}
                    className={`flex-1 py-3 rounded-xl border-2 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      variablePriceCurrency === 'USD'
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                    }`}
                  >
                    <span>$ Dólares (USD)</span>
                    {variablePriceCurrency === 'USD' && <Check className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVariablePriceCurrency('BS')}
                    className={`flex-1 py-3 rounded-xl border-2 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      variablePriceCurrency === 'BS'
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                    }`}
                  >
                    <span>Bs. Bolívares (VES)</span>
                    {variablePriceCurrency === 'BS' && <Check className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-indigo-800 font-medium leading-tight">
                  ℹ️ Si escoge Bs, el sistema convertirá el monto a la tasa del día para guardarlo en el carrito (USD).
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Nota:</strong> Al habilitar precio modificable, el stock se ajustará automáticamente a un valor alto (99,999) y el costo a 0.00, ya que estos productos suelen ser genéricos o servicios.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Presentations & Packaging Configuration Block */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Box className="w-4 h-4 text-blue-600" />
                <span>Presentaciones de Venta y Embalajes (Cajas, Sixpacks, Bultos, Combos)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure precios especiales y la cantidad exacta de {unit} a descontar del inventario cuando se vende un paquete completo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            
            {/* CAJA (Only for unit products) */}
            {categoryType === 'UNIT' && (
              <div className={`p-4 rounded-xl border transition-all ${getPresentation('CAJA').enabled ? 'bg-white border-amber-300 shadow-xs ring-2 ring-amber-500/10' : 'bg-slate-100/60 border-slate-200 opacity-80'}`}>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-900">
                    <input
                      type="checkbox"
                      checked={getPresentation('CAJA').enabled}
                      onChange={() => togglePresentation('CAJA')}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <Box className="w-4 h-4 text-amber-600" />
                    <span>Venta por Caja</span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">CAJA</span>
                </div>

                {getPresentation('CAJA').enabled && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nombre / Etiqueta</label>
                      <input
                        type="text"
                        value={getPresentation('CAJA').name}
                        onChange={(e) => updatePresentationField('CAJA', 'name', e.target.value)}
                        placeholder="Ej: Caja de 12 unds"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Unidades trae la caja</label>
                        <input
                          type="number"
                          value={getPresentation('CAJA').unitsToDeduct}
                          onChange={(e) => updatePresentationField('CAJA', 'unitsToDeduct', parseFloat(e.target.value) || 1)}
                          placeholder="12"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Precio por Caja ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={getPresentation('CAJA').packagePrice}
                          onChange={(e) => updatePresentationField('CAJA', 'packagePrice', parseFloat(e.target.value) || 0)}
                          placeholder="8.00"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Código de Barras de la Caja (Opcional)</label>
                      <input
                        type="text"
                        value={getPresentation('CAJA').barcode || ''}
                        onChange={(e) => updatePresentationField('CAJA', 'barcode', e.target.value)}
                        placeholder="Ej: 7501234567890 (Escaneable en POS)"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SIXPACK (Only for unit products) */}
            {categoryType === 'UNIT' && (
              <div className={`p-4 rounded-xl border transition-all ${getPresentation('SIXPACK').enabled ? 'bg-white border-blue-300 shadow-xs ring-2 ring-blue-500/10' : 'bg-slate-100/60 border-slate-200 opacity-80'}`}>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-900">
                    <input
                      type="checkbox"
                      checked={getPresentation('SIXPACK').enabled}
                      onChange={() => togglePresentation('SIXPACK')}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Venta por Sixpack (6 unds)</span>
                  </label>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">SIXPACK</span>
                </div>

                {getPresentation('SIXPACK').enabled && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nombre / Etiqueta</label>
                      <input
                        type="text"
                        value={getPresentation('SIXPACK').name}
                        onChange={(e) => updatePresentationField('SIXPACK', 'name', e.target.value)}
                        placeholder="Ej: Sixpack Cerveza"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Unidades a descontar</label>
                        <input
                          type="number"
                          value={getPresentation('SIXPACK').unitsToDeduct}
                          onChange={(e) => updatePresentationField('SIXPACK', 'unitsToDeduct', parseFloat(e.target.value) || 6)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Precio Sixpack ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={getPresentation('SIXPACK').packagePrice}
                          onChange={(e) => updatePresentationField('SIXPACK', 'packagePrice', parseFloat(e.target.value) || 0)}
                          placeholder="5.00"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Código de Barras del Sixpack (Opcional)</label>
                      <input
                        type="text"
                        value={getPresentation('SIXPACK').barcode || ''}
                        onChange={(e) => updatePresentationField('SIXPACK', 'barcode', e.target.value)}
                        placeholder="Ej: 7501234567891 (Escaneable en POS)"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BULTO / SACO / ATADO */}
            <div className={`p-4 rounded-xl border transition-all ${getPresentation('BULTO').enabled ? 'bg-white border-purple-300 shadow-xs ring-2 ring-purple-500/10' : 'bg-slate-100/60 border-slate-200 opacity-80'}`}>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-900">
                  <input
                    type="checkbox"
                    checked={getPresentation('BULTO').enabled}
                    onChange={() => togglePresentation('BULTO')}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <Package className="w-4 h-4 text-purple-600" />
                  <span>Venta por Bulto / Saco / Tambor</span>
                </label>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">BULTO</span>
              </div>

              {getPresentation('BULTO').enabled && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nombre / Etiqueta</label>
                    <input
                      type="text"
                      value={getPresentation('BULTO').name}
                      onChange={(e) => updatePresentationField('BULTO', 'name', e.target.value)}
                      placeholder={`Ej: Bulto de 20 ${unit}`}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Cantidad ({unit}) a descontar</label>
                      <input
                        type="number"
                        step="0.001"
                        value={getPresentation('BULTO').unitsToDeduct}
                        onChange={(e) => updatePresentationField('BULTO', 'unitsToDeduct', parseFloat(e.target.value) || 1)}
                        placeholder="20"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Precio por Bulto ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={getPresentation('BULTO').packagePrice}
                        onChange={(e) => updatePresentationField('BULTO', 'packagePrice', parseFloat(e.target.value) || 0)}
                        placeholder="25.00"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Código de Barras del Bulto (Opcional)</label>
                    <input
                      type="text"
                      value={getPresentation('BULTO').barcode || ''}
                      onChange={(e) => updatePresentationField('BULTO', 'barcode', e.target.value)}
                      placeholder="Ej: 7501234567892 (Escaneable en POS)"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* COMBO (Promociones) */}
            <div className={`p-4 rounded-xl border transition-all ${getPresentation('COMBO').enabled ? 'bg-white border-emerald-300 shadow-xs ring-2 ring-emerald-500/10' : 'bg-slate-100/60 border-slate-200 opacity-80'}`}>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-900">
                  <input
                    type="checkbox"
                    checked={getPresentation('COMBO').enabled}
                    onChange={() => togglePresentation('COMBO')}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <span>Venta por Combo / Oferta Especial</span>
                </label>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">COMBO</span>
              </div>

              {getPresentation('COMBO').enabled && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nombre / Oferta</label>
                    <input
                      type="text"
                      value={getPresentation('COMBO').name}
                      onChange={(e) => updatePresentationField('COMBO', 'name', e.target.value)}
                      placeholder="Ej: Combo 6 unds x 1$"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Cantidad ({unit}) incluye combo</label>
                      <input
                        type="number"
                        step="0.001"
                        value={getPresentation('COMBO').unitsToDeduct}
                        onChange={(e) => updatePresentationField('COMBO', 'unitsToDeduct', parseFloat(e.target.value) || 1)}
                        placeholder="6"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Precio Combo ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={getPresentation('COMBO').packagePrice}
                        onChange={(e) => updatePresentationField('COMBO', 'packagePrice', parseFloat(e.target.value) || 0)}
                        placeholder="1.00"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Código de Barras del Combo (Opcional)</label>
                    <input
                      type="text"
                      value={getPresentation('COMBO').barcode || ''}
                      onChange={(e) => updatePresentationField('COMBO', 'barcode', e.target.value)}
                      placeholder="Ej: 7501234567893 (Escaneable en POS)"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* CUSTOM / PERSONALIZADO */}
            <div className={`p-4 rounded-xl border transition-all col-span-1 md:col-span-2 ${getPresentation('CUSTOM').enabled ? 'bg-white border-slate-400 shadow-xs ring-2 ring-slate-500/10' : 'bg-slate-100/60 border-slate-200 opacity-80'}`}>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-900">
                  <input
                    type="checkbox"
                    checked={getPresentation('CUSTOM').enabled}
                    onChange={() => togglePresentation('CUSTOM')}
                    className="w-4 h-4 rounded text-slate-700 focus:ring-slate-500 cursor-pointer"
                  />
                  <ShoppingBag className="w-4 h-4 text-slate-700" />
                  <span>Presentación Personalizada (Nombre y Descuento a Medida)</span>
                </label>
                <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md">PERSONALIZADO</span>
              </div>

              {getPresentation('CUSTOM').enabled && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nombre Personalizado</label>
                      <input
                        type="text"
                        value={getPresentation('CUSTOM').name}
                        onChange={(e) => updatePresentationField('CUSTOM', 'name', e.target.value)}
                        placeholder="Ej: Cartón de 30"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Cantidad ({unit}) a descontar</label>
                      <input
                        type="number"
                        step="0.001"
                        value={getPresentation('CUSTOM').unitsToDeduct}
                        onChange={(e) => updatePresentationField('CUSTOM', 'unitsToDeduct', parseFloat(e.target.value) || 1)}
                        placeholder="30"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Precio Especial ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={getPresentation('CUSTOM').packagePrice}
                        onChange={(e) => updatePresentationField('CUSTOM', 'packagePrice', parseFloat(e.target.value) || 0)}
                        placeholder="4.50"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Código de Barras Personalizado (Opcional)</label>
                    <input
                      type="text"
                      value={getPresentation('CUSTOM').barcode || ''}
                      onChange={(e) => updatePresentationField('CUSTOM', 'barcode', e.target.value)}
                      placeholder="Ej: 7501234567894 (Escaneable en POS)"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Returnable Bottle / Container (Envases Vacíos) Section (Optional Modular feature) */}
        {isEnvasesEnabled && (
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-3">
              <div>
                <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                  <Wine className="w-4.5 h-4.5 text-amber-600" />
                  <span>Control de Envase y Botella Retornable (Cervezas / Licores)</span>
                </h4>
                <p className="text-xs text-amber-800/80 mt-0.5">
                  Al activarlo, cada vez que venda este producto en el POS o en combos, el sistema acumulará automáticamente botellas vacías en el Inventario de Botellas.
                </p>
              </div>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                Módulo Envases
              </span>
            </div>

            <div className="space-y-4 pt-1">
              <label className="flex items-center gap-3 cursor-pointer select-none bg-white p-3 rounded-xl border border-amber-200">
                <input
                  type="checkbox"
                  checked={hasReturnableBottle}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHasReturnableBottle(checked);
                    if (checked && !bottleName) {
                      setBottleName(`Botella ${name.trim() || 'Cerveza'} Retornable`);
                    }
                  }}
                  className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    ¿Este producto utiliza envase / botella retornable a descontar o acumular?
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Suma +1 botella vacía en depósito por cada unidad vendida (ej: Polar Pilsen, Solera, Zulia).
                  </span>
                </div>
              </label>

              {hasReturnableBottle && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-white rounded-xl border border-amber-200 animate-fade-in">
                  <div className="col-span-1 sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Nombre o Identificador del Envase:
                    </label>
                    <input
                      type="text"
                      value={bottleName}
                      onChange={(e) => setBottleName(e.target.value)}
                      placeholder="Ej: Botella Polar Pilsen 222ml Retornable"
                      className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Stock Inicial Botellas Vacías:
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={emptyBottleStock}
                      onChange={(e) => setEmptyBottleStock(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono font-bold focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Botellas por Caja / Huacal:
                    </label>
                    <select
                      value={supplierReturnPackSize}
                      onChange={(e) => setSupplierReturnPackSize(parseInt(e.target.value, 10) || 24)}
                      className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 rounded-lg px-3 py-2 text-xs text-slate-900 font-bold focus:bg-white focus:outline-none"
                    >
                      <option value={24}>24 unidades (Estándar)</option>
                      <option value={36}>36 unidades</option>
                      <option value={12}>12 unidades</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="pt-6 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSubmitting ? 'Guardando...' : product ? 'Guardar Cambios' : 'Registrar Producto'}</span>
          </button>
        </div>

      </form>

      {/* Google Image Search Modal */}
      <GoogleImageSearchModal
        isOpen={isGoogleSearchOpen}
        onClose={() => setIsGoogleSearchOpen(false)}
        productName={name || 'producto'}
        onSelectPhoto={(url) => setImageUrl(url)}
      />

    </div>
  );
};
