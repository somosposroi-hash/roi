import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { 
  getMeasurementConfig, 
  detectMeasurementCategory, 
  convertToBaseQuantity, 
  UnitMode 
} from '../utils/measurementHelper';
import { getProductEmoji } from '../utils/product-meta';
import { Scale, Ruler, Droplets, CheckCircle2, AlertTriangle, ArrowRight, X } from 'lucide-react';

interface MeasurementQuantityModalProps {
  product: Product | null;
  initialQuantity?: number; // Base quantity if editing existing cart item
  isOpen: boolean;
  bcvRate: number;
  onClose: () => void;
  onConfirm: (baseQuantity: number) => void;
  priceOverride?: number;
}

export const MeasurementQuantityModal: React.FC<MeasurementQuantityModalProps> = ({
  product,
  initialQuantity = 1,
  isOpen,
  bcvRate,
  onClose,
  onConfirm,
  priceOverride,
}) => {
  const [unitMode, setUnitMode] = useState<UnitMode>('BASE'); // 'BASE' or 'SUB'
  const [inputValue, setInputValue] = useState<string>('1');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const category = product ? detectMeasurementCategory(product.unit) : 'UNIT';
  const config = getMeasurementConfig(category);

  // Initialize input value when product or mode changes
  useEffect(() => {
    if (isOpen && product) {
      setError(null);
      // Default mode is BASE (kg, m, L)
      setUnitMode('BASE');
      if (initialQuantity > 0) {
        setInputValue(String(initialQuantity));
      } else {
        setInputValue(category === 'WEIGHT' ? '1' : '1');
      }

      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const parsedVal = parseFloat(inputValue) || 0;
  const baseQuantity = convertToBaseQuantity(parsedVal, unitMode, config);
  const currentPrice = priceOverride !== undefined ? priceOverride : product.price;
  const lineSubtotal = currentPrice * baseQuantity;
  const lineSubtotalBs = lineSubtotal * bcvRate;
  const newStock = Math.round((product.stock - baseQuantity) * 1000) / 1000;
  const emoji = getProductEmoji(product);

  const handleUnitModeChange = (newMode: UnitMode) => {
    setUnitMode(newMode);
    setError(null);

    // Convert current base quantity to new mode input for smooth toggle
    if (baseQuantity > 0) {
      if (newMode === 'SUB') {
        // e.g. 0.100 kg -> 100 g
        const subVal = Math.round(baseQuantity * config.scale * 100) / 100;
        setInputValue(String(subVal));
      } else {
        // e.g. 100 g -> 0.100 kg
        setInputValue(String(baseQuantity));
      }
    } else {
      setInputValue(newMode === 'SUB' ? (config.category === 'WEIGHT' ? '100' : '50') : '1');
    }

    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  };

  const handleApplyPreset = (val: number, mode: UnitMode) => {
    setUnitMode(mode);
    setInputValue(String(val));
    setError(null);
    inputRef.current?.focus();
  };

  const handleConfirm = () => {
    if (parsedVal <= 0 || baseQuantity <= 0) {
      setError('Ingrese una cantidad válida mayor a 0');
      return;
    }

    if (baseQuantity > product.stock) {
      setError(`Stock insuficiente. Solo quedan ${product.stock} ${config.baseShort} disponibles`);
      return;
    }

    onConfirm(baseQuantity);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-5 text-left relative">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Category Badge */}
        <div className="flex items-center gap-2">
          {category === 'WEIGHT' && <Scale className="w-5 h-5 text-emerald-600" />}
          {category === 'LENGTH' && <Ruler className="w-5 h-5 text-blue-600" />}
          {category === 'VOLUME' && <Droplets className="w-5 h-5 text-amber-600" />}
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            {category === 'WEIGHT' && 'Venta por Peso (Kilogramos / Gramos)'}
            {category === 'LENGTH' && 'Venta por Longitud (Metros / Centímetros)'}
            {category === 'VOLUME' && 'Venta por Volumen (Litros / Mililitros)'}
            {category === 'UNIT' && 'Venta por Unidad'}
          </span>
        </div>

        {/* Product Card Info */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center gap-3">
          <span className="text-4xl select-none filter drop-shadow-xs shrink-0">{emoji}</span>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-extrabold text-slate-900 truncate leading-snug">
              {product.name}
            </h4>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
              <span>Precio/Base: <strong>${currentPrice.toFixed(2)}</strong> / {config.baseShort}</span>
              <span>•</span>
              <span>Stock: <strong>{product.stock}</strong> {config.baseShort}</span>
            </div>
          </div>
        </div>

        {/* Unit Selector Checks (Kilos vs Gramos / Metros vs Centímetros / Litros vs Mililitros) */}
        <div className="space-y-2">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600">
            Seleccionar Unidad de Ingreso:
          </label>

          <div className="grid grid-cols-2 gap-3">
            {/* Check 1: Base Unit (kg, m, L) */}
            <label
              onClick={() => handleUnitModeChange('BASE')}
              className={`p-3 rounded-2xl border-2 flex items-center gap-3 cursor-pointer transition-all select-none ${
                unitMode === 'BASE'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-black shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-600 font-medium hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="unitMode"
                checked={unitMode === 'BASE'}
                onChange={() => handleUnitModeChange('BASE')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs font-bold">{config.baseLabel}</span>
            </label>

            {/* Check 2: Sub Unit (g, cm, ml) */}
            <label
              onClick={() => handleUnitModeChange('SUB')}
              className={`p-3 rounded-2xl border-2 flex items-center gap-3 cursor-pointer transition-all select-none ${
                unitMode === 'SUB'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-black shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-600 font-medium hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="unitMode"
                checked={unitMode === 'SUB'}
                onChange={() => handleUnitModeChange('SUB')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs font-bold">{config.subLabel}</span>
            </label>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {category === 'WEIGHT' && (
            <>
              <button type="button" onClick={() => handleApplyPreset(100, 'SUB')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">100g</button>
              <button type="button" onClick={() => handleApplyPreset(250, 'SUB')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">250g</button>
              <button type="button" onClick={() => handleApplyPreset(500, 'SUB')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">500g</button>
              <button type="button" onClick={() => handleApplyPreset(1, 'BASE')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">1 kg</button>
              <button type="button" onClick={() => handleApplyPreset(2, 'BASE')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">2 kg</button>
            </>
          )}

          {category === 'LENGTH' && (
            <>
              <button type="button" onClick={() => handleApplyPreset(10, 'SUB')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">10cm</button>
              <button type="button" onClick={() => handleApplyPreset(25, 'SUB')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">25cm</button>
              <button type="button" onClick={() => handleApplyPreset(50, 'SUB')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">50cm</button>
              <button type="button" onClick={() => handleApplyPreset(1, 'BASE')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">1 m</button>
              <button type="button" onClick={() => handleApplyPreset(2.5, 'BASE')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">2.5 m</button>
            </>
          )}

          {category === 'VOLUME' && (
            <>
              <button type="button" onClick={() => handleApplyPreset(100, 'SUB')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">100ml</button>
              <button type="button" onClick={() => handleApplyPreset(250, 'SUB')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">250ml</button>
              <button type="button" onClick={() => handleApplyPreset(500, 'SUB')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">500ml</button>
              <button type="button" onClick={() => handleApplyPreset(1, 'BASE')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">1 L</button>
              <button type="button" onClick={() => handleApplyPreset(1.5, 'BASE')} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">1.5 L</button>
            </>
          )}
        </div>

        {/* Input Quantity Field */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600">
            Cantidad a Despachar:
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="number"
              step={unitMode === 'SUB' ? '1' : config.defaultStep.toString()}
              min="0.001"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={unitMode === 'SUB' ? config.subPlaceholder : config.basePlaceholder}
              className="w-full bg-white border-2 border-slate-300 focus:border-blue-600 rounded-2xl px-4 py-3 text-2xl font-black text-slate-900 font-mono focus:outline-none transition-all shadow-xs"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 font-mono uppercase">
              {unitMode === 'SUB' ? config.subShort : config.baseShort}
            </span>
          </div>
        </div>

        {/* Live Mathematical Formula & Conversion Summary */}
        <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 space-y-2.5 text-xs font-mono">
          <div className="flex justify-between items-center text-slate-400 text-[11px]">
            <span>Conversión a Base ({config.baseShort}):</span>
            <span className="text-emerald-400 font-bold">
              {unitMode === 'SUB' ? `${parsedVal} ${config.subShort} = ` : ''}{baseQuantity} {config.baseShort}
            </span>
          </div>

          <div className="border-t border-slate-800 pt-2 flex justify-between items-baseline">
            <span className="text-slate-400 text-[11px]">Subtotal a Cobrar:</span>
            <div className="text-right">
              <span className="text-lg font-black text-white">${lineSubtotal.toFixed(2)} USD</span>
              <span className="block text-[10px] text-slate-400 font-sans">
                Bs. {lineSubtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Nuevo Stock Estimado ($I_{'{nuevo}'}$):</span>
            <span className={`font-bold ${newStock < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {product.stock} - {baseQuantity} = {newStock} {config.baseShort}
            </span>
          </div>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmar en Carrito</span>
          </button>
        </div>

      </div>
    </div>
  );
};
