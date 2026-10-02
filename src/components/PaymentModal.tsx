import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Receipt, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Coins, 
  UserCheck, 
  Shuffle, 
  CreditCard, 
  Smartphone, 
  DollarSign, 
  Banknote,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { PaymentMethodLogo, PaymentMethodId } from './PaymentMethodLogo';
import { SplitPaymentEntry } from '../types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalUsd: number;
  totalBs: number;
  bcvRate: number;
  itemCount: number;
  cashierName: string;
  onConfirmPayment: (paymentData: {
    paymentMethod: PaymentMethodId;
    amountPaid: number;
    reference: string;
  }) => Promise<void>;
  isProcessing: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  totalUsd,
  totalBs,
  bcvRate,
  itemCount,
  cashierName,
  onConfirmPayment,
  isProcessing,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>('DEBIT_CARD');
  
  // Single-method inputs
  const [cashUsdReceived, setCashUsdReceived] = useState<string>('');
  const [cashBsReceived, setCashBsReceived] = useState<string>('');
  const [pagoMovilRef, setPagoMovilRef] = useState<string>('');
  const [cardApprovalRef, setCardApprovalRef] = useState<string>('');
  const [binanceRef, setBinanceRef] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  
  // Split payment (Pago Mixto) state
  const [splitEntries, setSplitEntries] = useState<SplitPaymentEntry[]>([]);
  const [splitSelectedMethod, setSplitSelectedMethod] = useState<PaymentMethodId>('CASH_USD');
  const [splitCurrency, setSplitCurrency] = useState<'USD' | 'BS'>('USD');
  const [splitAmountInput, setSplitAmountInput] = useState<string>('');
  const [splitRefInput, setSplitRefInput] = useState<string>('');
  const [splitClientInput, setSplitClientInput] = useState<string>('');
  const [splitInputError, setSplitInputError] = useState<string | null>(null);

  // Validation error
  const [formError, setFormError] = useState<string | null>(null);

  // Reset or preset values when opening
  useEffect(() => {
    if (isOpen) {
      setFormError(null);
      setSplitInputError(null);
      setCashUsdReceived('');
      setCashBsReceived('');
      setPagoMovilRef('');
      setCardApprovalRef('');
      setBinanceRef('');
      setClientName('');
      setSplitEntries([]);
      setSplitAmountInput(totalUsd.toFixed(2));
      setSplitRefInput('');
      setSplitClientInput('');
      setSplitCurrency('USD');
      setSplitSelectedMethod('CASH_USD');
    }
  }, [isOpen, totalUsd]);

  // Numerical conversions for cash methods
  const usdReceivedNum = parseFloat(cashUsdReceived) || 0;
  const bsReceivedNum = parseFloat(cashBsReceived) || 0;

  // Change calculations for single cash methods
  const changeUsd = Math.max(0, Math.round((usdReceivedNum - totalUsd) * 100) / 100);
  const changeUsdInBs = Math.round(changeUsd * bcvRate * 100) / 100;

  const changeBs = Math.max(0, Math.round((bsReceivedNum - totalBs) * 100) / 100);
  const changeBsInUsd = bcvRate > 0 ? Math.round((changeBs / bcvRate) * 100) / 100 : 0;

  // Split calculations
  const splitTotalPaidUsd = useMemo(() => {
    return Math.round(splitEntries.reduce((sum, e) => sum + e.amountInUsd, 0) * 100) / 100;
  }, [splitEntries]);

  const splitTotalPaidBs = useMemo(() => {
    return Math.round(splitEntries.reduce((sum, e) => sum + e.amountInBs, 0) * 100) / 100;
  }, [splitEntries]);

  const splitDiffUsd = useMemo(() => {
    return Math.max(0, Math.round((totalUsd - splitTotalPaidUsd) * 100) / 100);
  }, [totalUsd, splitTotalPaidUsd]);

  const splitDiffBs = useMemo(() => {
    return Math.max(0, Math.round((totalBs - splitTotalPaidBs) * 100) / 100);
  }, [totalBs, splitTotalPaidBs]);

  const isSplitCovered = useMemo(() => {
    return splitEntries.length > 0 && splitTotalPaidUsd >= (totalUsd - 0.02);
  }, [splitEntries, splitTotalPaidUsd, totalUsd]);

  const splitChangeUsd = useMemo(() => {
    if (!isSplitCovered) return 0;
    return Math.max(0, Math.round((splitTotalPaidUsd - totalUsd) * 100) / 100);
  }, [isSplitCovered, splitTotalPaidUsd, totalUsd]);

  const splitChangeBs = useMemo(() => {
    return Math.round(splitChangeUsd * bcvRate * 100) / 100;
  }, [splitChangeUsd, bcvRate]);

  // Keep split input pre-filled with remaining amount when currency or difference changes
  const handleSplitCurrencyChange = (newCurr: 'USD' | 'BS') => {
    setSplitCurrency(newCurr);
    if (newCurr === 'USD') {
      setSplitAmountInput(splitDiffUsd > 0 ? splitDiffUsd.toFixed(2) : '');
    } else {
      setSplitAmountInput(splitDiffBs > 0 ? splitDiffBs.toFixed(2) : '');
    }
  };

  // Auto set currency when choosing split method
  const handleSplitMethodSelect = (method: PaymentMethodId) => {
    setSplitSelectedMethod(method);
    setSplitInputError(null);
    if (method === 'CASH_USD' || method === 'BINANCE') {
      setSplitCurrency('USD');
      setSplitAmountInput(splitDiffUsd > 0 ? splitDiffUsd.toFixed(2) : '');
    } else if (method === 'CASH_BS' || method === 'DEBIT_CARD' || method === 'PAGO_MOVIL') {
      setSplitCurrency('BS');
      setSplitAmountInput(splitDiffBs > 0 ? splitDiffBs.toFixed(2) : '');
    } else {
      // CREDIT can be USD or BS
      setSplitAmountInput(splitCurrency === 'USD' ? splitDiffUsd.toFixed(2) : splitDiffBs.toFixed(2));
    }
  };

  // Add split payment slice
  const handleAddSplitEntry = () => {
    setSplitInputError(null);
    const amt = parseFloat(splitAmountInput);
    if (isNaN(amt) || amt <= 0) {
      setSplitInputError('Ingrese un monto válido mayor a 0');
      return;
    }

    if (splitSelectedMethod === 'PAGO_MOVIL' && !splitRefInput.trim()) {
      setSplitInputError('La referencia de Pago Móvil es obligatoria');
      return;
    }

    if (splitSelectedMethod === 'BINANCE' && !splitRefInput.trim()) {
      setSplitInputError('El ID / Referencia de Binance es obligatorio');
      return;
    }

    if (splitSelectedMethod === 'CREDIT' && !splitClientInput.trim()) {
      setSplitInputError('El nombre del cliente para el crédito es obligatorio');
      return;
    }

    let amtUsd = 0;
    let amtBs = 0;

    if (splitCurrency === 'USD') {
      amtUsd = Math.round(amt * 100) / 100;
      amtBs = Math.round(amt * bcvRate * 100) / 100;
    } else {
      amtBs = Math.round(amt * 100) / 100;
      amtUsd = bcvRate > 0 ? Math.round((amt / bcvRate) * 100) / 100 : 0;
    }

    const newEntry: SplitPaymentEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : `split-${Date.now()}-${Math.random()}`,
      method: splitSelectedMethod as any,
      currency: splitCurrency,
      amount: amt,
      amountInUsd: amtUsd,
      amountInBs: amtBs,
      reference: splitRefInput.trim() || undefined,
      clientName: splitClientInput.trim() || undefined,
    };

    const updated = [...splitEntries, newEntry];
    setSplitEntries(updated);

    // Calculate new remaining
    const newPaidUsd = updated.reduce((s, e) => s + e.amountInUsd, 0);
    const newRemainingUsd = Math.max(0, Math.round((totalUsd - newPaidUsd) * 100) / 100);
    const newRemainingBs = Math.max(0, Math.round((totalBs - (newPaidUsd * bcvRate)) * 100) / 100);

    // Reset inputs for next payment
    setSplitRefInput('');
    setSplitClientInput('');
    if (splitCurrency === 'USD') {
      setSplitAmountInput(newRemainingUsd > 0 ? newRemainingUsd.toFixed(2) : '');
    } else {
      setSplitAmountInput(newRemainingBs > 0 ? newRemainingBs.toFixed(2) : '');
    }
  };

  const handleRemoveSplitEntry = (id: string) => {
    const updated = splitEntries.filter((e) => e.id !== id);
    setSplitEntries(updated);
    const newPaidUsd = updated.reduce((s, e) => s + e.amountInUsd, 0);
    const newRemainingUsd = Math.max(0, Math.round((totalUsd - newPaidUsd) * 100) / 100);
    const newRemainingBs = Math.max(0, Math.round((totalBs - (newPaidUsd * bcvRate)) * 100) / 100);
    if (splitCurrency === 'USD') {
      setSplitAmountInput(newRemainingUsd > 0 ? newRemainingUsd.toFixed(2) : '');
    } else {
      setSplitAmountInput(newRemainingBs > 0 ? newRemainingBs.toFixed(2) : '');
    }
  };

  // Validate if payment can proceed
  const canConfirm = useMemo(() => {
    if (isProcessing) return false;

    if (selectedMethod === 'PAGO_MOVIL') {
      return pagoMovilRef.trim().length >= 4;
    }

    if (selectedMethod === 'DEBIT_CARD') {
      return true;
    }

    if (selectedMethod === 'CASH_USD') {
      return usdReceivedNum >= (totalUsd - 0.01);
    }

    if (selectedMethod === 'CASH_BS') {
      return bsReceivedNum >= (totalBs - 0.05);
    }

    if (selectedMethod === 'BINANCE') {
      return binanceRef.trim().length >= 3;
    }

    if (selectedMethod === 'CREDIT') {
      return clientName.trim().length >= 2;
    }

    if (selectedMethod === 'SPLIT') {
      return isSplitCovered;
    }

    return true;
  }, [
    selectedMethod, 
    pagoMovilRef, 
    usdReceivedNum, 
    totalUsd, 
    bsReceivedNum, 
    totalBs, 
    binanceRef, 
    clientName, 
    isSplitCovered, 
    isProcessing
  ]);

  // Handle final submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    let finalAmountPaid = totalUsd;
    let finalReference = '';

    if (selectedMethod === 'PAGO_MOVIL') {
      if (!pagoMovilRef.trim()) {
        setFormError('El número de referencia de Pago Móvil es obligatorio para confirmar.');
        return;
      }
      finalAmountPaid = totalUsd;
      finalReference = `Pago Móvil Ref: ${pagoMovilRef.trim()}`;
    } else if (selectedMethod === 'DEBIT_CARD') {
      finalAmountPaid = totalUsd;
      finalReference = cardApprovalRef.trim() 
        ? `Tarjeta Débito Lote/Aprob: ${cardApprovalRef.trim()}` 
        : 'Tarjeta Débito (POS Aprobado)';
    } else if (selectedMethod === 'CASH_USD') {
      if (usdReceivedNum < (totalUsd - 0.01)) {
        setFormError(`El monto recibido ($${usdReceivedNum.toFixed(2)}) debe cubrir el total ($${totalUsd.toFixed(2)})`);
        return;
      }
      finalAmountPaid = usdReceivedNum;
      finalReference = `Efectivo USD (Recibido: $${usdReceivedNum.toFixed(2)}, Cambio: $${changeUsd.toFixed(2)})`;
    } else if (selectedMethod === 'CASH_BS') {
      if (bsReceivedNum < (totalBs - 0.05)) {
        setFormError(`El monto recibido (Bs. ${bsReceivedNum.toFixed(2)}) debe cubrir el total (Bs. ${totalBs.toFixed(2)})`);
        return;
      }
      finalAmountPaid = bcvRate > 0 ? Math.round((bsReceivedNum / bcvRate) * 100) / 100 : totalUsd;
      finalReference = `Efectivo Bs (Recibido: Bs. ${bsReceivedNum.toFixed(2)}, Cambio: Bs. ${changeBs.toFixed(2)})`;
    } else if (selectedMethod === 'BINANCE') {
      if (!binanceRef.trim()) {
        setFormError('El número de referencia o ID de Pago de Binance es obligatorio.');
        return;
      }
      finalAmountPaid = totalUsd;
      finalReference = `Binance Pay Ref: ${binanceRef.trim()}`;
    } else if (selectedMethod === 'CREDIT') {
      if (!clientName.trim()) {
        setFormError('El nombre del cliente es obligatorio para registrar la venta a crédito.');
        return;
      }
      finalAmountPaid = totalUsd;
      finalReference = `Crédito / Cuenta por Cobrar - Cliente: ${clientName.trim()}`;
    } else if (selectedMethod === 'SPLIT') {
      if (!isSplitCovered) {
        setFormError(`El pago mixto no cubre el total requerido. Falta cubrir $${splitDiffUsd.toFixed(2)} (Bs. ${splitDiffBs.toFixed(2)})`);
        return;
      }
      finalAmountPaid = splitTotalPaidUsd;
      const breakdown = splitEntries.map((e) => {
        const refPart = e.reference ? ` (Ref: ${e.reference})` : '';
        const clientPart = e.clientName ? ` (Cliente: ${e.clientName})` : '';
        const currSym = e.currency === 'USD' ? '$' : 'Bs.';
        return `${e.method}: ${currSym} ${e.amount.toFixed(2)}${refPart}${clientPart}`;
      }).join(' + ');

      finalReference = `Pago Mixto [${breakdown}]${splitChangeUsd > 0 ? ` - Vuelto: $${splitChangeUsd.toFixed(2)} / Bs. ${splitChangeBs.toFixed(2)}` : ''}`;
    }

    try {
      await onConfirmPayment({
        paymentMethod: selectedMethod,
        amountPaid: finalAmountPaid,
        reference: finalReference,
      });
    } catch (err: any) {
      setFormError(err.message || 'Error procesando el pago');
    }
  };

  const paymentOptions: Array<{
    id: PaymentMethodId;
    title: string;
    description: string;
    badge?: string;
  }> = [
    {
      id: 'DEBIT_CARD',
      title: 'Tarjeta Débito (POS)',
      description: 'Punto bancario en Bs • Ref. opcional',
    },
    {
      id: 'PAGO_MOVIL',
      title: 'Pago Móvil (Bs)',
      description: 'Interbancario en Bs • Ref. OBLIGATORIA',
      badge: 'Ref Obligatoria',
    },
    {
      id: 'CASH_BS',
      title: 'Efectivo Bolívares (Bs)',
      description: 'Billetes en Bs • Cálculo de cambio exacto',
    },
    {
      id: 'CASH_USD',
      title: 'Efectivo Dólares ($)',
      description: 'Billetes USD • Calculadora y vuelto en vivo',
    },
    {
      id: 'BINANCE',
      title: 'Binance Pay (USDT)',
      description: 'Cripto / Pay ID • Ref. OBLIGATORIA',
      badge: 'Cripto / USDT',
    },
    {
      id: 'CREDIT',
      title: 'Crédito / Cuenta por Cobrar',
      description: 'Fiado comercial • Nombre cliente obligatorio',
      badge: 'Crédito',
    },
    {
      id: 'SPLIT',
      title: 'Pago Mixto (Combinado)',
      description: 'Varios métodos • Calcula diferencia en Bs y $',
      badge: 'Multi-Moneda',
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative my-auto max-h-[92vh] flex flex-col">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Cerrar ventana de cobro"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Ventana de Cobro • Ticket de Venta
            </h2>
            <p className="text-xs text-slate-500">
              {itemCount} producto{itemCount !== 1 ? 's' : ''} • Cajero: {cashierName}
            </p>
          </div>
        </div>

        {/* Total a Pagar Highlights Banner (INVERTED AS REQUESTED: Bs. IN BIG BLUE) */}
        <div className="mt-3 bg-gradient-to-r from-blue-50/90 to-slate-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
              <span>Total a Pagar en Bolívares (Bs)</span>
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            </span>
            <div className="text-3xl sm:text-4xl font-black font-mono text-blue-700 tracking-tight mt-0.5">
              Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-blue-100 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500 block">
              Referencia en Dólares ($):
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-800">
              ${totalUsd.toFixed(2)}{' '}
              <span className="text-xs font-bold text-slate-500 font-sans uppercase">USD</span>
            </div>
            <div className="text-[11px] font-mono text-blue-600 font-semibold mt-0.5">
              Tasa Oficial BCV: Bs. {bcvRate.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
          
          {/* Section: Select Payment Method with Circular Logos */}
          <div>
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
              Seleccione Método de Pago:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {paymentOptions.map((opt) => {
                const isSelected = selectedMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedMethod(opt.id);
                      setFormError(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-600/30 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {/* Circular Logo */}
                    <PaymentMethodLogo method={opt.id} size="sm" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className={`text-xs font-bold truncate ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                          {opt.title}
                        </div>
                        {opt.badge && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {opt.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DYNAMIC DETAIL SECTION ACCORDING TO PAYMENT METHOD */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
            
            {/* METHOD 1: TARJETA DÉBITO (POS) */}
            {selectedMethod === 'DEBIT_CARD' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
                  <PaymentMethodLogo method="DEBIT_CARD" size="sm" />
                  <div>
                    <span className="font-bold text-slate-900">Tarjeta Débito (Punto de Venta POS Bancario)</span>
                    <p className="text-[11px] text-slate-500">
                      Pase la tarjeta por el punto por el monto exacto de <strong className="text-blue-700 font-mono">Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>. No requiere ingresar monto recibido.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="card-ref-input" className="text-xs font-bold text-slate-700">
                      Número de Aprobación / Lote del Voucher:
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium bg-slate-200/80 px-2 py-0.5 rounded-full">
                      Opcional
                    </span>
                  </div>
                  <input
                    id="card-ref-input"
                    type="text"
                    value={cardApprovalRef}
                    onChange={(e) => setCardApprovalRef(e.target.value)}
                    placeholder="Ej: 004821 (Opcional - dejar en blanco si no se requiere)"
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* METHOD 2: PAGO MÓVIL */}
            {selectedMethod === 'PAGO_MOVIL' && (
              <div className="space-y-3">
                <div className="bg-white p-3 rounded-lg border border-blue-100 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-blue-900">
                    <PaymentMethodLogo method="PAGO_MOVIL" size="sm" />
                    <span>Datos para recibir Pago Móvil:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 font-mono">
                    <div>Banco: <strong className="text-slate-900">Banesco (0134)</strong></div>
                    <div>Teléfono: <strong className="text-slate-900">0414-1234567</strong></div>
                    <div>RIF / CI: <strong className="text-slate-900">J-50123456-0</strong></div>
                    <div>Monto exacto: <strong className="text-blue-700">Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="pagomovil-ref-input" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Número de Referencia de Pago Móvil:</span>
                      <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                      Obligatorio
                    </span>
                  </div>
                  <input
                    id="pagomovil-ref-input"
                    type="text"
                    required
                    value={pagoMovilRef}
                    onChange={(e) => {
                      setPagoMovilRef(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Ej: 984512 (Mínimo últimos 4-6 dígitos)"
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ingrese el comprobante o los últimos dígitos de la transacción emitida por el banco del cliente.
                  </p>
                </div>
              </div>
            )}

            {/* METHOD 3: EFECTIVO BOLÍVARES (Bs) */}
            {selectedMethod === 'CASH_BS' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="bs-received-input" className="font-bold text-slate-800">
                    Monto Recibido en Efectivo (Bolívares Bs.):
                  </label>
                  <button
                    type="button"
                    onClick={() => setCashBsReceived(totalBs.toFixed(2))}
                    className="text-blue-600 hover:text-blue-800 font-bold text-xs cursor-pointer"
                  >
                    Monto Exacto (Bs. {totalBs.toFixed(2)})
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                    Bs.
                  </div>
                  <input
                    id="bs-received-input"
                    type="number"
                    step="0.01"
                    min={totalBs}
                    value={cashBsReceived}
                    onChange={(e) => {
                      setCashBsReceived(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder={totalBs.toFixed(2)}
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 rounded-xl pl-10 pr-3.5 py-2 text-base font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all"
                  />
                </div>

                {/* Quick Rounding Buttons for Bs */}
                <div className="flex gap-1.5 pt-0.5">
                  {[
                    Math.ceil(totalBs),
                    Math.ceil(totalBs / 10) * 10,
                    Math.ceil(totalBs / 50) * 50,
                    Math.ceil(totalBs / 100) * 100,
                  ].filter((v, idx, self) => self.indexOf(v) === idx).map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashBsReceived(amt.toString())}
                      className="flex-1 py-1.5 text-xs font-mono font-bold rounded-lg bg-white hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-700 transition-colors cursor-pointer shadow-xs"
                    >
                      Bs. {amt}
                    </button>
                  ))}
                </div>

                {/* Live Change Calculation */}
                {bsReceivedNum >= (totalBs - 0.05) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center animate-fade-in">
                    <div className="text-xs text-emerald-700 font-semibold">Vuelto / Cambio a Entregar al Cliente:</div>
                    <div className="text-2xl font-black font-mono text-emerald-800">
                      Bs. {changeBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs font-mono text-emerald-700 font-semibold mt-0.5">
                      ≈ ${changeBsInUsd.toFixed(2)} USD (Tasa BCV: {bcvRate.toFixed(2)})
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* METHOD 4: EFECTIVO DÓLARES ($) */}
            {selectedMethod === 'CASH_USD' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="usd-received-input" className="font-bold text-slate-800">
                    Monto Recibido ($ Dólares USD):
                  </label>
                  <button
                    type="button"
                    onClick={() => setCashUsdReceived(totalUsd.toFixed(2))}
                    className="text-blue-600 hover:text-blue-800 font-bold text-xs cursor-pointer"
                  >
                    Monto Exacto (${totalUsd.toFixed(2)})
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                    $
                  </div>
                  <input
                    id="usd-received-input"
                    type="number"
                    step="0.01"
                    min={totalUsd}
                    value={cashUsdReceived}
                    onChange={(e) => {
                      setCashUsdReceived(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder={totalUsd.toFixed(2)}
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 rounded-xl pl-8 pr-3.5 py-2 text-base font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all"
                  />
                </div>

                {/* Quick Bill Buttons */}
                <div className="flex gap-1.5 pt-0.5">
                  {[1, 5, 10, 20, 50, 100].map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => setCashUsdReceived(bill.toString())}
                      className="flex-1 py-1.5 text-xs font-mono font-bold rounded-lg bg-white hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-700 transition-colors cursor-pointer shadow-xs"
                    >
                      ${bill}
                    </button>
                  ))}
                </div>

                {/* Live Change Calculation */}
                {usdReceivedNum >= (totalUsd - 0.01) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center animate-fade-in">
                    <div className="text-xs text-emerald-700 font-semibold">Vuelto / Cambio a Entregar al Cliente:</div>
                    <div className="text-2xl font-black font-mono text-emerald-800">
                      ${changeUsd.toFixed(2)} <span className="text-xs font-sans text-emerald-600">USD</span>
                    </div>
                    <div className="text-xs font-mono text-emerald-700 font-semibold mt-0.5">
                      ≈ Bs. {changeUsdInBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa: {bcvRate.toFixed(2)})
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* METHOD 5: BINANCE PAY (USDT) */}
            {selectedMethod === 'BINANCE' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-xs text-slate-700 bg-white p-3 rounded-lg border border-yellow-200/80">
                  <PaymentMethodLogo method="BINANCE" size="sm" />
                  <div>
                    <span className="font-bold text-slate-900">Binance Pay (Transferencia USDT)</span>
                    <p className="text-[11px] text-slate-500">
                      Cobro directo vía Binance Pay por <strong className="text-amber-600 font-mono">${totalUsd.toFixed(2)} USDT</strong>. Ingrese el ID de Orden o referencia de la transacción.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="binance-ref-input" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Número de Referencia / ID de Orden de Binance:</span>
                      <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                      Obligatorio
                    </span>
                  </div>
                  <input
                    id="binance-ref-input"
                    type="text"
                    required
                    value={binanceRef}
                    onChange={(e) => {
                      setBinanceRef(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Ej: 28491823901 o TxID de Binance Pay"
                    className="w-full bg-white border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Comprobante generado por la aplicación Binance en el pago recibido.
                  </p>
                </div>
              </div>
            )}

            {/* METHOD 6: CRÉDITO (CUENTAS POR COBRAR) */}
            {selectedMethod === 'CREDIT' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-xs text-slate-700 bg-white p-3 rounded-lg border border-indigo-200">
                  <PaymentMethodLogo method="CREDIT" size="sm" />
                  <div>
                    <span className="font-bold text-indigo-950">Venta a Crédito / Fiado</span>
                    <p className="text-[11px] text-slate-500">
                      Monto de la deuda: <strong className="text-indigo-700 font-mono">Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong> (${totalUsd.toFixed(2)} USD).
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="client-name-input" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Nombre del Cliente (Deudor):</span>
                      <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                      Obligatorio
                    </span>
                  </div>
                  <input
                    id="client-name-input"
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Ej: Carlos Mendoza / Inversiones El Prado C.A."
                    className="w-full bg-white border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all"
                  />
                  <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-2.5 mt-2 text-[11px] text-indigo-900">
                    ℹ️ <strong>Cuentas por cobrar:</strong> Este ticket quedará asignado con estado de crédito a nombre de este cliente. La gestión de límites y cobranzas se configurará más adelante.
                  </div>
                </div>
              </div>
            )}

            {/* METHOD 7: PAGO MIXTO (COMBINADO CON CÁLCULO DE DIFERENCIA EN BS Y $) */}
            {selectedMethod === 'SPLIT' && (
              <div className="space-y-3">
                
                {/* Real-time remaining difference display (highlighted) */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  isSplitCovered
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50/90 border-amber-300 text-amber-950'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider block">
                        {isSplitCovered ? '¡Total Cubierto con Éxito!' : 'Diferencia Restante a Pagar:'}
                      </span>
                      
                      {/* Prominent display of remaining in Bs and $ as requested */}
                      {!isSplitCovered ? (
                        <div className="flex items-baseline gap-3 mt-1">
                          <div className="text-xl sm:text-2xl font-black font-mono text-blue-700">
                            Bs. {splitDiffBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-sm sm:text-base font-bold font-mono text-slate-700">
                            (${splitDiffUsd.toFixed(2)} USD)
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1 text-emerald-800 font-bold text-sm">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span>Monto total alcanzado ({splitEntries.length} pagos registrados)</span>
                        </div>
                      )}
                    </div>

                    {/* Change if overpaid */}
                    {splitChangeUsd > 0 && (
                      <div className="text-right bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
                        <span className="text-[10px] uppercase font-bold text-emerald-700 block">Vuelto / Cambio:</span>
                        <span className="text-xs font-mono font-black text-emerald-800">
                          Bs. {splitChangeBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 block">(${splitChangeUsd.toFixed(2)})</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-form to add a payment slice */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Agregar Método a la Combinación:</span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Tasa: Bs. {bcvRate.toFixed(2)}
                    </span>
                  </div>

                  {/* Method selector buttons */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[
                      { id: 'CASH_USD', label: 'Efectivo $', curr: 'USD' },
                      { id: 'CASH_BS', label: 'Efectivo Bs', curr: 'BS' },
                      { id: 'DEBIT_CARD', label: 'Tarjeta POS', curr: 'BS' },
                      { id: 'PAGO_MOVIL', label: 'Pago Móvil', curr: 'BS' },
                      { id: 'BINANCE', label: 'Binance', curr: 'USD' },
                      { id: 'CREDIT', label: 'Crédito', curr: 'USD' },
                    ].map((m) => {
                      const isSubSelected = splitSelectedMethod === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSplitMethodSelect(m.id as PaymentMethodId)}
                          className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer text-xs ${
                            isSubSelected
                              ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="truncate text-[11px]">{m.label}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Inputs: Currency toggle + Amount */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                    
                    {/* Currency toggle */}
                    <div className="sm:col-span-4 flex rounded-lg border border-slate-300 p-0.5 bg-slate-100">
                      <button
                        type="button"
                        onClick={() => handleSplitCurrencyChange('USD')}
                        className={`flex-1 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                          splitCurrency === 'USD' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        $ Dólares (USD)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSplitCurrencyChange('BS')}
                        className={`flex-1 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                          splitCurrency === 'BS' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Bs. Bolívares
                      </button>
                    </div>

                    {/* Amount Input */}
                    <div className="sm:col-span-8 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                        {splitCurrency === 'USD' ? '$' : 'Bs.'}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={splitAmountInput}
                        onChange={(e) => setSplitAmountInput(e.target.value)}
                        placeholder={splitCurrency === 'USD' ? splitDiffUsd.toFixed(2) : splitDiffBs.toFixed(2)}
                        className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-lg pl-8 pr-3 py-1.5 text-sm font-mono font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Conditional Reference or Client Name in Split */}
                  {(splitSelectedMethod === 'PAGO_MOVIL' || splitSelectedMethod === 'BINANCE' || splitSelectedMethod === 'DEBIT_CARD') && (
                    <div>
                      <input
                        type="text"
                        value={splitRefInput}
                        onChange={(e) => setSplitRefInput(e.target.value)}
                        placeholder={
                          splitSelectedMethod === 'PAGO_MOVIL' ? 'Referencia Pago Móvil *' :
                          splitSelectedMethod === 'BINANCE' ? 'ID / Referencia Binance *' :
                          'Lote / Aprobación voucher (opcional)'
                        }
                        className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  )}

                  {splitSelectedMethod === 'CREDIT' && (
                    <div>
                      <input
                        type="text"
                        value={splitClientInput}
                        onChange={(e) => setSplitClientInput(e.target.value)}
                        placeholder="Nombre completo del cliente a crédito *"
                        className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  )}

                  {splitInputError && (
                    <div className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{splitInputError}</span>
                    </div>
                  )}

                  {/* Add button */}
                  <button
                    type="button"
                    onClick={handleAddSplitEntry}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar este pago a la lista</span>
                  </button>
                </div>

                {/* List of registered split entries */}
                {splitEntries.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                      Pagos agregados ({splitEntries.length}):
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {splitEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2 text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <PaymentMethodLogo method={entry.method} size="sm" />
                            <div className="truncate">
                              <span className="font-bold text-slate-900">
                                {entry.method === 'CASH_USD' ? 'Efectivo $' :
                                 entry.method === 'CASH_BS' ? 'Efectivo Bs' :
                                 entry.method === 'DEBIT_CARD' ? 'Tarjeta POS' :
                                 entry.method === 'PAGO_MOVIL' ? 'Pago Móvil' :
                                 entry.method === 'BINANCE' ? 'Binance Pay' : 'Crédito'}
                              </span>
                              {entry.reference && (
                                <span className="text-[11px] text-slate-500 font-mono ml-1.5 truncate">
                                  Ref: {entry.reference}
                                </span>
                              )}
                              {entry.clientName && (
                                <span className="text-[11px] text-indigo-700 font-semibold ml-1.5 truncate">
                                  Cliente: {entry.clientName}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right font-mono">
                              <div className="font-black text-blue-700">
                                {entry.currency === 'USD' ? `$${entry.amount.toFixed(2)}` : `Bs. ${entry.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {entry.currency === 'USD' ? `≈ Bs. ${entry.amountInBs.toFixed(2)}` : `≈ $${entry.amountInUsd.toFixed(2)}`}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveSplitEntry(entry.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Quitar este pago"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>

          {/* Validation Error Box */}
          {formError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Modal Action Buttons */}
          <div className="flex items-center gap-3 pt-1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-sm transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              id="btn-confirm-payment-modal"
              type="submit"
              disabled={!canConfirm || isProcessing}
              className={`flex-2 py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                !canConfirm || isProcessing
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-500/25'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Procesando Venta...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Confirmar y Emitir Factura</span>
                </>
              )}
            </button>
          </div>

          <div className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5 pb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Transacción atómica con reducción automática de stock en tiempo real</span>
          </div>

        </form>
      </div>
    </div>
  );
};
