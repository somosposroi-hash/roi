import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
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
  Sparkles,
  Lock,
  ChevronRight,
  User,
  Users,
  Check
} from 'lucide-react';
import { PaymentMethodLogo, PaymentMethodId } from './PaymentMethodLogo';
import { SplitPaymentEntry, Client } from '../types';
import { getPOSConfig, getClientsList, saveClientsList } from '../utils/configHelper';
import { safeFetchJson } from '../utils/api';

const VENEZUELAN_BANKS = [
  'Banco de Venezuela (0102)',
  'Banesco (0134)',
  'Banco Provincial (0108)',
  'Mercantil (0105)',
  'Banco Exterior (0115)',
  'Bancaribe (0114)',
  'Banplus (0174)',
  'Banco Bicentenario (0175)',
  'Banco del Tesoro (0163)',
  'Banco Plaza (0138)',
  'Banco Nacional de Crédito BNC (0191)',
  '100% Banco (0156)',
  'Banco Fondo Común BFC (0151)',
  'Mi Banco (0169)',
  'Bancrecer (0168)',
  'Banco Activo (0171)',
  'Banco Caroní (0128)',
];

interface PaymentPageProps {
  totalUsd: number;
  totalBs: number;
  bcvRate: number;
  itemCount: number;
  cashierName: string;
  currentUser?: any;
  onBack: () => void;
  onConfirmPayment: (paymentData: {
    paymentMethod: PaymentMethodId;
    amountPaid: number;
    reference: string;
  }) => Promise<void>;
  isProcessing: boolean;
}

export const PaymentPage: React.FC<PaymentPageProps> = ({
  totalUsd,
  totalBs,
  bcvRate,
  itemCount,
  cashierName,
  currentUser,
  onBack,
  onConfirmPayment,
  isProcessing,
}) => {
  const [posConfig] = useState(() => getPOSConfig());
  
  // User Granular Permissions
  const userCanApplyDiscountOrSurcharge = currentUser ? (currentUser.canApplyDiscountOrSurcharge ?? true) : true;
  const userCanSellOnCredit = currentUser ? (currentUser.canSellOnCredit ?? true) : true;
  
  // Checkout flow step:
  // step 1: Datos de Cliente (if enabled in posConfig)
  // step 2: Métodos de Pago
  const [step, setStep] = useState<number>(() => (getPOSConfig().useClientData ? 1 : 2));

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>('DEBIT_CARD');

  // Reset selectedMethod if credit is disallowed for this user
  useEffect(() => {
    if (!userCanSellOnCredit && selectedMethod === 'CREDIT') {
      setSelectedMethod('DEBIT_CARD');
    }
  }, [userCanSellOnCredit, selectedMethod]);
  
  // Discounts and Charges State
  const [discountType, setDiscountType] = useState<'USD' | 'BS'>('USD');
  const [discountAmountInput, setDiscountAmountInput] = useState<string>('');
  const [discountDescription, setDiscountDescription] = useState<string>('');

  const [chargeType, setChargeType] = useState<'USD' | 'BS'>('USD');
  const [chargeAmountInput, setChargeAmountInput] = useState<string>('');
  const [chargeDescription, setChargeDescription] = useState<string>('');

  // Emisor Bank and Account Type for Pago Móvil
  const [pagoMovilEmisorBank, setPagoMovilEmisorBank] = useState<string>('');
  const [pagoMovilAccountType, setPagoMovilAccountType] = useState<'PERSONAL' | 'JURIDICO'>('PERSONAL');

  // Client Form state
  const [clientDocType, setClientDocType] = useState<Client['docType']>('V');
  const [clientDocNumber, setClientDocNumber] = useState<string>('');
  const [clientNameInput, setClientNameInput] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [clientNotes, setClientNotes] = useState<string>('');
  const [saveClientToDb, setSaveClientToDb] = useState<boolean>(true);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<Client[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const docRef = useRef<HTMLDivElement>(null);

  // Sales state for credit limit calculations
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    safeFetchJson<any[]>('/api/v1/sales?limit=10000')
      .then(res => {
        if (res.ok && Array.isArray(res.data)) {
          setSales(res.data);
        }
      })
      .catch(err => console.error('Error fetching sales for credit limit checks:', err));
  }, []);

  // Single-method inputs
  const [cashUsdReceived, setCashUsdReceived] = useState<string>('');
  const [cashBsReceived, setCashBsReceived] = useState<string>('');
  const [pagoMovilRef, setPagoMovilRef] = useState<string>('');
  const [cardApprovalRef, setCardApprovalRef] = useState<string>('');
  const [binanceRef, setBinanceRef] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');

  // Additional dynamic references
  const [cashBsRef, setCashBsRef] = useState<string>('');
  const [cashUsdRef, setCashUsdRef] = useState<string>('');
  const [creditRef, setCreditRef] = useState<string>('');
  
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

  // Initialize values
  useEffect(() => {
    setFormError(null);
    setSplitInputError(null);
    setCashUsdReceived('');
    setCashBsReceived('');
    setPagoMovilRef('');
    setCardApprovalRef('');
    setBinanceRef('');
    setClientName('');
    setCashBsRef('');
    setCashUsdRef('');
    setCreditRef('');
    setSplitEntries([]);
    
    // Reset discounts, charges, and Pago Móvil emisor inputs
    setDiscountAmountInput('');
    setDiscountDescription('');
    setChargeAmountInput('');
    setChargeDescription('');
    setPagoMovilEmisorBank('');
    setPagoMovilAccountType('PERSONAL');

    // Calculate initial adjusted total directly
    setSplitAmountInput(totalUsd.toFixed(2));
    setSplitRefInput('');
    setSplitClientInput('');
    setSplitCurrency('USD');
    setSplitSelectedMethod('CASH_USD');
  }, [totalUsd]);

  // Click outside suggestions close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (docRef.current && !docRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle autocomplete matching
  const handleDocNumberChange = (val: string) => {
    setClientDocNumber(val);
    const query = val.trim().toLowerCase();
    if (!query) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const allClients = getClientsList();
    const matches = allClients.filter(c => 
      c.docNumber.toLowerCase().includes(query) ||
      `${c.docType}-${c.docNumber}`.toLowerCase().includes(query)
    );
    setSuggestions(matches);
    setShowSuggestions(true);
  };

  const handleNameChange = (val: string) => {
    setClientNameInput(val);
    const query = val.trim().toLowerCase();
    if (!query) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const allClients = getClientsList();
    const matches = allClients.filter(c => 
      c.name.toLowerCase().includes(query)
    );
    setSuggestions(matches);
    setShowSuggestions(true);
  };

  const handleSelectSuggestion = (client: Client) => {
    setClientDocType(client.docType);
    setClientDocNumber(client.docNumber);
    setClientNameInput(client.name);
    setClientPhone(client.phone);
    setClientNotes(client.notes);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Numerical conversions for cash methods
  const usdReceivedNum = parseFloat(cashUsdReceived) || 0;
  const bsReceivedNum = parseFloat(cashBsReceived) || 0;

  // Live adjustments for discounts and charges
  const discountVal = parseFloat(discountAmountInput) || 0;
  const chargeVal = parseFloat(chargeAmountInput) || 0;

  const discountInUsd = discountType === 'USD' ? discountVal : bcvRate > 0 ? discountVal / bcvRate : 0;
  const chargeInUsd = chargeType === 'USD' ? chargeVal : bcvRate > 0 ? chargeVal / bcvRate : 0;

  const adjustedTotalUsd = Math.max(0, totalUsd - discountInUsd + chargeInUsd);
  const adjustedTotalBs = Math.max(0, totalBs - (discountType === 'BS' ? discountVal : discountInUsd * bcvRate) + (chargeType === 'BS' ? chargeVal : chargeInUsd * bcvRate));

  // Change calculations for single cash methods using adjusted values
  const changeUsd = Math.max(0, Math.round((usdReceivedNum - adjustedTotalUsd) * 100) / 100);
  const changeUsdInBs = Math.round(changeUsd * bcvRate * 100) / 100;

  const changeBs = Math.max(0, Math.round((bsReceivedNum - adjustedTotalBs) * 100) / 100);
  const changeBsInUsd = bcvRate > 0 ? Math.round((changeBs / bcvRate) * 100) / 100 : 0;

  // Split calculations
  const splitTotalPaidUsd = useMemo(() => {
    return Math.round(splitEntries.reduce((sum, e) => sum + e.amountInUsd, 0) * 100) / 100;
  }, [splitEntries]);

  const splitTotalPaidBs = useMemo(() => {
    return Math.round(splitEntries.reduce((sum, e) => sum + e.amountInBs, 0) * 100) / 100;
  }, [splitEntries]);

  const splitDiffUsd = useMemo(() => {
    return Math.max(0, Math.round((adjustedTotalUsd - splitTotalPaidUsd) * 100) / 100);
  }, [adjustedTotalUsd, splitTotalPaidUsd]);

  const splitDiffBs = useMemo(() => {
    return Math.max(0, Math.round((adjustedTotalBs - splitTotalPaidBs) * 100) / 100);
  }, [adjustedTotalBs, splitTotalPaidBs]);

  const isSplitCovered = useMemo(() => {
    return splitEntries.length > 0 && splitTotalPaidUsd >= (adjustedTotalUsd - 0.02);
  }, [splitEntries, splitTotalPaidUsd, adjustedTotalUsd]);

  const splitChangeUsd = useMemo(() => {
    if (!isSplitCovered) return 0;
    return Math.max(0, Math.round((splitTotalPaidUsd - adjustedTotalUsd) * 100) / 100);
  }, [isSplitCovered, splitTotalPaidUsd, adjustedTotalUsd]);

  const splitChangeBs = useMemo(() => {
    return Math.round(splitChangeUsd * bcvRate * 100) / 100;
  }, [splitChangeUsd, bcvRate]);

  const handleSplitCurrencyChange = (newCurr: 'USD' | 'BS') => {
    setSplitCurrency(newCurr);
    if (newCurr === 'USD') {
      setSplitAmountInput(splitDiffUsd > 0 ? splitDiffUsd.toFixed(2) : '');
    } else {
      setSplitAmountInput(splitDiffBs > 0 ? splitDiffBs.toFixed(2) : '');
    }
  };

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
      setSplitAmountInput(splitCurrency === 'USD' ? splitDiffUsd.toFixed(2) : splitDiffBs.toFixed(2));
    }
  };

  const handleAddSplitEntry = () => {
    setSplitInputError(null);
    const amt = parseFloat(splitAmountInput);
    if (isNaN(amt) || amt <= 0) {
      setSplitInputError('Ingrese un monto válido mayor a 0');
      return;
    }

    // Dynamic split entry reference requirements check
    if (splitSelectedMethod === 'PAGO_MOVIL' && posConfig.pagoMovilRefRequired && !splitRefInput.trim()) {
      setSplitInputError('La referencia de Pago Móvil es obligatoria');
      return;
    }

    if (splitSelectedMethod === 'BINANCE' && posConfig.binanceRefRequired && !splitRefInput.trim()) {
      setSplitInputError('El ID / Referencia de Binance es obligatorio');
      return;
    }

    if (splitSelectedMethod === 'DEBIT_CARD' && posConfig.debitCardRefRequired && !splitRefInput.trim()) {
      setSplitInputError('Lote/Aprobación de tarjeta es obligatorio');
      return;
    }

    if (splitSelectedMethod === 'CASH_BS' && posConfig.cashBsRefRequired && !splitRefInput.trim()) {
      setSplitInputError('La referencia de Efectivo Bs es obligatoria');
      return;
    }

    if (splitSelectedMethod === 'CASH_USD' && posConfig.cashUsdRefRequired && !splitRefInput.trim()) {
      setSplitInputError('La referencia de Efectivo $ es obligatoria');
      return;
    }

    if (splitSelectedMethod === 'CREDIT' && posConfig.creditRefRequired && !splitRefInput.trim()) {
      setSplitInputError('La referencia de Crédito es obligatoria');
      return;
    }

    if (splitSelectedMethod === 'CREDIT' && !splitClientInput.trim() && !clientNameInput.trim()) {
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

    const finalClientName = splitClientInput.trim() || clientNameInput.trim() || 'Cliente General';

    const newEntry: SplitPaymentEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : `split-${Date.now()}-${Math.random()}`,
      method: splitSelectedMethod as any,
      currency: splitCurrency,
      amount: amt,
      amountInUsd: amtUsd,
      amountInBs: amtBs,
      reference: splitRefInput.trim() || undefined,
      clientName: finalClientName,
    };

    const updated = [...splitEntries, newEntry];
    setSplitEntries(updated);

    const newPaidUsd = updated.reduce((s, e) => s + e.amountInUsd, 0);
    const newRemainingUsd = Math.max(0, Math.round((adjustedTotalUsd - newPaidUsd) * 100) / 100);
    const newRemainingBs = Math.max(0, Math.round((adjustedTotalBs - (newPaidUsd * bcvRate)) * 100) / 100);

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
    const newRemainingUsd = Math.max(0, Math.round((adjustedTotalUsd - newPaidUsd) * 100) / 100);
    const newRemainingBs = Math.max(0, Math.round((adjustedTotalBs - (newPaidUsd * bcvRate)) * 100) / 100);
    if (splitCurrency === 'USD') {
      setSplitAmountInput(newRemainingUsd > 0 ? newRemainingUsd.toFixed(2) : '');
    } else {
      setSplitAmountInput(newRemainingBs > 0 ? newRemainingBs.toFixed(2) : '');
    }
  };

  // Step 1 validation
  const validateStep1 = (): boolean => {
    if (!posConfig.useClientData) return true;
    
    const missing: string[] = [];
    if (posConfig.showClientName && posConfig.clientNameRequired && !clientNameInput.trim()) {
      missing.push('Nombre o Razón Social');
    }
    if (posConfig.showClientRif && posConfig.clientRifRequired && !clientDocNumber.trim()) {
      missing.push('Documento o RIF');
    }
    if (posConfig.showClientPhone && posConfig.clientPhoneRequired && !clientPhone.trim()) {
      missing.push('Número de Teléfono');
    }
    if (posConfig.showClientNotes && posConfig.clientNotesRequired && !clientNotes.trim()) {
      missing.push('Datos Adicionales / Dirección');
    }

    if (missing.length > 0) {
      setFormError(`Campos requeridos faltantes: ${missing.join(', ')}`);
      return false;
    }

    setFormError(null);
    return true;
  };

  // Dynamic canConfirm validation based on configuration
  const canConfirm = useMemo(() => {
    if (isProcessing) return false;
    
    // Debit Card check
    if (selectedMethod === 'DEBIT_CARD') {
      if (posConfig.debitCardRefRequired) {
        return cardApprovalRef.trim().length >= 3;
      }
      return true;
    }
    
    // Pago Móvil check
    if (selectedMethod === 'PAGO_MOVIL') {
      const refOk = !posConfig.pagoMovilRefRequired || pagoMovilRef.trim().length >= 4;
      const bankOk = !posConfig.pagoMovilShowBank || !!pagoMovilEmisorBank;
      return refOk && bankOk;
    }
    
    // Cash Bs check
    if (selectedMethod === 'CASH_BS') {
      const covers = bsReceivedNum >= (adjustedTotalBs - 0.05);
      if (posConfig.cashBsRefRequired) {
        return covers && cashBsRef.trim().length >= 3;
      }
      return covers;
    }
    
    // Cash USD check
    if (selectedMethod === 'CASH_USD') {
      const covers = usdReceivedNum >= (adjustedTotalUsd - 0.01);
      if (posConfig.cashUsdRefRequired) {
        return covers && cashUsdRef.trim().length >= 3;
      }
      return covers;
    }
    
    // Binance check
    if (selectedMethod === 'BINANCE') {
      if (posConfig.binanceRefRequired) {
        return binanceRef.trim().length >= 3;
      }
      return true;
    }
    
    // Credit check
    if (selectedMethod === 'CREDIT') {
      const nameOk = posConfig.useClientData 
        ? clientNameInput.trim().length >= 2 
        : clientName.trim().length >= 2;
      
      if (posConfig.creditRefRequired) {
        return nameOk && creditRef.trim().length >= 3;
      }
      return nameOk;
    }
    
    // Split payment check
    if (selectedMethod === 'SPLIT') {
      if (!isSplitCovered) return false;
      if (posConfig.splitRefRequired) {
        for (const entry of splitEntries) {
          if (entry.method === 'DEBIT_CARD' && posConfig.debitCardRefRequired && !entry.reference) return false;
          if (entry.method === 'PAGO_MOVIL' && posConfig.pagoMovilRefRequired && !entry.reference) return false;
          if (entry.method === 'BINANCE' && posConfig.binanceRefRequired && !entry.reference) return false;
          if (entry.method === 'CREDIT' && posConfig.creditRefRequired && !entry.reference) return false;
          if (entry.method === 'CASH_BS' && posConfig.cashBsRefRequired && !entry.reference) return false;
          if (entry.method === 'CASH_USD' && posConfig.cashUsdRefRequired && !entry.reference) return false;
        }
      }
      return true;
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
    isProcessing,
    posConfig,
    cardApprovalRef,
    cashBsRef,
    cashUsdRef,
    creditRef,
    clientNameInput,
    splitEntries
  ]);

  // Payment Page Keyboard Shortcuts
  useEffect(() => {
    const handlePaymentKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);

      if (e.key === 'Escape') {
        e.preventDefault();
        if (!isProcessing) {
          if (step === 2 && posConfig.useClientData) {
            setStep(1);
          } else {
            onBack();
          }
        }
      } else if (e.key === 'Enter') {
        if (!isInputFocused) {
          if (step === 1) {
            e.preventDefault();
            if (validateStep1()) {
              setStep(2);
            }
          } else {
            // Focus dynamic form input
            e.preventDefault();
            const inputs = document.querySelectorAll('.dynamic-payment-form input, .dynamic-payment-form select');
            if (inputs && inputs.length > 0) {
              const firstInput = inputs[0] as HTMLInputElement;
              firstInput.focus();
              firstInput.select?.();
            }
          }
        }
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (step === 2 && canConfirm && !isProcessing) {
          handleSubmit({ preventDefault: () => {} } as React.FormEvent);
        } else if (step === 1) {
          if (validateStep1()) {
            setStep(2);
          }
        }
      } else if (!isInputFocused && step === 2) {
        if (e.key === '1') { e.preventDefault(); setSelectedMethod('DEBIT_CARD'); }
        else if (e.key === '2') { e.preventDefault(); setSelectedMethod('PAGO_MOVIL'); }
        else if (e.key === '3') { e.preventDefault(); setSelectedMethod('CASH_BS'); }
        else if (e.key === '4') { e.preventDefault(); setSelectedMethod('CASH_USD'); }
        else if (e.key === '5') { e.preventDefault(); setSelectedMethod('BINANCE'); }
        else if (e.key === '6') { 
          if (userCanSellOnCredit) {
            e.preventDefault(); 
            setSelectedMethod('CREDIT'); 
          }
        }
        else if (e.key === '7') { e.preventDefault(); setSelectedMethod('SPLIT'); }
      }
    };

    window.addEventListener('keydown', handlePaymentKeyDown);
    return () => window.removeEventListener('keydown', handlePaymentKeyDown);
  }, [step, canConfirm, isProcessing, selectedMethod, cashUsdReceived, cashBsReceived, pagoMovilRef, cardApprovalRef, binanceRef, clientName, splitEntries, clientNameInput, clientDocNumber, clientPhone, clientNotes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Permission enforcement
    if (!userCanSellOnCredit && (selectedMethod === 'CREDIT' || splitEntries.some(item => item.method === 'CREDIT'))) {
      setFormError('Tu usuario no tiene autorización para vender bajo el método de pago a Crédito.');
      return;
    }

    if (!userCanApplyDiscountOrSurcharge && (discountVal > 0 || chargeVal > 0)) {
      setFormError('Tu usuario no tiene autorización para aplicar descuentos ni recargos.');
      return;
    }

    // Auto-save or update client for credit sales and POS client data
    const isCreditPayment = selectedMethod === 'CREDIT' || splitEntries.some(item => item.method === 'CREDIT');
    const effectiveClientName = clientNameInput.trim() || clientName.trim() || (isCreditPayment ? 'Cliente Crédito' : '');
    const docClean = clientDocNumber.trim() ? clientDocNumber.trim().replace(/[^0-9-]/g, '') : `V-${Date.now().toString().slice(-7)}`;

    if ((posConfig.useClientData || isCreditPayment) && effectiveClientName) {
      const allClients = getClientsList();
      const exists = allClients.some(c => c.docType === clientDocType && c.docNumber === docClean);
      if (!exists) {
        const newC: Client = {
          id: crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random()}`,
          name: effectiveClientName,
          docType: clientDocType,
          docNumber: docClean,
          phone: clientPhone.trim(),
          notes: clientNotes.trim() || (isCreditPayment ? 'Cliente registrado automáticamente desde Venta a Crédito' : ''),
          createdAt: new Date().toISOString()
        };
        saveClientsList([newC, ...allClients]);
        safeFetchJson('/api/v1/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newC)
        }).catch(() => {});
      }
    }

    let finalAmountPaid = adjustedTotalUsd;
    let finalReference = '';

    if (selectedMethod === 'PAGO_MOVIL') {
      if (posConfig.pagoMovilRefRequired && !pagoMovilRef.trim()) {
        setFormError('El número de referencia de Pago Móvil es obligatorio.');
        return;
      }
      finalAmountPaid = adjustedTotalUsd;
      let pmRef = pagoMovilRef.trim() ? `Pago Móvil Ref: ${pagoMovilRef.trim()}` : 'Pago Móvil';
      if (posConfig.pagoMovilShowBank && pagoMovilEmisorBank) {
        pmRef += ` | Banco Emisor: ${pagoMovilEmisorBank}`;
      }
      if (posConfig.pagoMovilShowAccountType) {
        pmRef += ` | Cuenta: ${pagoMovilAccountType === 'PERSONAL' ? 'Personal' : 'Jurídica'}`;
      }
      finalReference = pmRef;
    } else if (selectedMethod === 'DEBIT_CARD') {
      if (posConfig.debitCardRefRequired && !cardApprovalRef.trim()) {
        setFormError('El número de aprobación/lote de la tarjeta es obligatorio.');
        return;
      }
      finalAmountPaid = adjustedTotalUsd;
      finalReference = cardApprovalRef.trim() 
        ? `Tarjeta Débito Lote/Aprob: ${cardApprovalRef.trim()}` 
        : 'Tarjeta Débito (POS)';
    } else if (selectedMethod === 'CASH_USD') {
      if (usdReceivedNum < (adjustedTotalUsd - 0.01)) {
        setFormError(`El monto recibido ($${usdReceivedNum.toFixed(2)}) debe cubrir el total ($${adjustedTotalUsd.toFixed(2)})`);
        return;
      }
      finalAmountPaid = usdReceivedNum;
      const refPart = cashUsdRef.trim() ? ` (Ref: ${cashUsdRef.trim()})` : '';
      finalReference = `Efectivo USD (Recibido: $${usdReceivedNum.toFixed(2)}, Cambio: $${changeUsd.toFixed(2)})${refPart}`;
    } else if (selectedMethod === 'CASH_BS') {
      if (bsReceivedNum < (adjustedTotalBs - 0.05)) {
        setFormError(`El monto recibido (Bs. ${bsReceivedNum.toFixed(2)}) debe cubrir el total (Bs. ${adjustedTotalBs.toFixed(2)})`);
        return;
      }
      finalAmountPaid = bcvRate > 0 ? Math.round((bsReceivedNum / bcvRate) * 100) / 100 : adjustedTotalUsd;
      const refPart = cashBsRef.trim() ? ` (Ref: ${cashBsRef.trim()})` : '';
      finalReference = `Efectivo Bs (Recibido: Bs. ${bsReceivedNum.toFixed(2)}, Cambio: Bs. ${changeBs.toFixed(2)})${refPart}`;
    } else if (selectedMethod === 'BINANCE') {
      if (posConfig.binanceRefRequired && !binanceRef.trim()) {
        setFormError('El ID o número de referencia de Binance es obligatorio.');
        return;
      }
      finalAmountPaid = adjustedTotalUsd;
      finalReference = binanceRef.trim() ? `Binance Pay Ref: ${binanceRef.trim()}` : 'Binance Pay';
    } else if (selectedMethod === 'CREDIT') {
      const cName = posConfig.useClientData ? clientNameInput.trim() : (clientNameInput.trim() || clientName.trim());
      if (!cName) {
        setFormError('El nombre del cliente es obligatorio para registrar la venta a crédito.');
        return;
      }
      if (!posConfig.useClientData && !clientDocNumber.trim()) {
        setFormError('El número de documento o RIF del cliente es obligatorio para registrar la cuenta por cobrar.');
        return;
      }
      if (posConfig.creditRefRequired && !creditRef.trim()) {
        setFormError('La referencia o autorización de crédito es obligatoria.');
        return;
      }

      // -- CREDIT LIMIT CHECK --
      const allClients = getClientsList();
      const docClean = clientDocNumber.trim().replace(/[^0-9-]/g, '');
      const clientObj = allClients.find(c => c.docType === clientDocType && c.docNumber === docClean);

      if (clientObj && clientObj.creditLimit !== undefined && clientObj.creditLimit > 0) {
        const parseMeta = (n?: string) => {
          let dNum = '';
          let adjUsd: number | null = null;
          let isAbo = false;
          if (n) {
            if (n.startsWith('METADATA_JSON:')) {
              try {
                const meta = JSON.parse(n.replace('METADATA_JSON:', ''));
                if (meta.client) dNum = meta.client.docNumber;
                if (meta.adjustedTotalUsd !== undefined) adjUsd = meta.adjustedTotalUsd;
                if (meta.type === 'cxc_payment') isAbo = true;
              } catch {}
            } else if (n.startsWith('CLIENT_DATA_JSON:')) {
              try {
                const parts = n.split(' | REFERENCE: ');
                const clientData = JSON.parse(parts[0].replace('CLIENT_DATA_JSON:', ''));
                dNum = clientData.docNumber;
              } catch {}
            }
          }
          return { docNumber: dNum, adjustedTotalUsd: adjUsd, isAbo };
        };

        const getCreditAmt = (sale: any) => {
          const m = parseMeta(sale.notes);
          if (sale.invoiceNumber.startsWith('ABO-') || m.isAbo) return 0;
          if (sale.paymentMethod === 'CREDIT') return m.adjustedTotalUsd !== null ? m.adjustedTotalUsd : sale.total;
          if (sale.paymentMethod === 'SPLIT') {
            const ref = sale.notes || '';
            const creditMatch = ref.match(/(?:CREDIT|Cr\u00e9dito|CREDITO):\s*(?:\$|Bs\.)\s*([0-9.]+)/i);
            if (creditMatch) return parseFloat(creditMatch[1]);
          }
          return 0;
        };

        const clientCreditSales = sales.filter(s => {
          const m = parseMeta(s.notes);
          return m.docNumber === docClean && getCreditAmt(s) > 0;
        });

        const clientPayments = sales.filter(s => {
          const m = parseMeta(s.notes);
          return m.docNumber === docClean && (s.invoiceNumber.startsWith('ABO-') || m.isAbo);
        });

        const totalCreditUsd = clientCreditSales.reduce((acc, s) => acc + getCreditAmt(s), 0);
        const totalPaidUsd = clientPayments.reduce((acc, s) => {
          let amt = s.total;
          if (s.notes && s.notes.startsWith('METADATA_JSON:')) {
            try {
              const meta = JSON.parse(s.notes.replace('METADATA_JSON:', ''));
              if (meta.paymentDetails) {
                amt = meta.paymentDetails.amountPaidUsd || 0;
              }
            } catch {}
          }
          return acc + amt;
        }, 0);

        const currentDebtUsd = Math.max(0, totalCreditUsd - totalPaidUsd);
        const creditLimitVal = clientObj.creditLimit;

        if (currentDebtUsd + adjustedTotalUsd > creditLimitVal) {
          const available = Math.max(0, creditLimitVal - currentDebtUsd);
          setFormError(`Limite de credito superado disponible SOLO ${available.toFixed(2)}$ (Deuda actual: $${currentDebtUsd.toFixed(2)}, Límite: $${creditLimitVal.toFixed(2)})`);
          return;
        }
      }

      finalAmountPaid = adjustedTotalUsd;
      const refPart = creditRef.trim() ? ` (Ref: ${creditRef.trim()})` : '';
      finalReference = `Crédito - Cliente: ${cName}${refPart}`;
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

    // Build overall serialized notes structure including client invoice, discounts, charges and Pago Móvil emisor
    const hasClientInfo = clientDocNumber.trim() || clientNameInput.trim() || clientName.trim();

    const invoiceClientData = (posConfig.useClientData || isCreditPayment || effectiveClientName) ? {
      name: effectiveClientName || 'Contado / Cliente General',
      docType: clientDocType || 'V',
      docNumber: docClean,
      phone: clientPhone.trim(),
      notes: clientNotes.trim()
    } : null;

    const discountMeta = discountVal > 0 ? {
      amount: discountVal,
      type: discountType,
      description: discountDescription.trim() || 'Descuento General'
    } : null;

    const chargeMeta = chargeVal > 0 ? {
      amount: chargeVal,
      type: chargeType,
      description: chargeDescription.trim() || 'Cargo Adicional'
    } : null;

    const pmMeta = selectedMethod === 'PAGO_MOVIL' && (posConfig.pagoMovilShowBank || posConfig.pagoMovilShowAccountType) ? {
      emisorBank: pagoMovilEmisorBank || undefined,
      accountType: pagoMovilAccountType || undefined
    } : null;

    const metaPayload = {
      client: invoiceClientData,
      discount: discountMeta,
      charge: chargeMeta,
      pagoMovil: pmMeta,
      paymentReference: finalReference,
      adjustedTotalUsd: adjustedTotalUsd,
      adjustedTotalBs: adjustedTotalBs
    };

    const serializedNotes = `METADATA_JSON:${JSON.stringify(metaPayload)}`;

    try {
      await onConfirmPayment({
        paymentMethod: selectedMethod,
        amountPaid: finalAmountPaid,
        reference: serializedNotes,
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
      description: `Punto bancario en Bs • Ref: ${posConfig.debitCardRefRequired ? 'OBLIGATORIA' : 'Opcional'}`,
      badge: posConfig.debitCardRefRequired ? 'Lote Oblig.' : undefined
    },
    { 
      id: 'PAGO_MOVIL', 
      title: 'Pago Móvil (Bs)', 
      description: `Interbancario en Bs • Ref: ${posConfig.pagoMovilRefRequired ? 'OBLIGATORIA' : 'Opcional'}`, 
      badge: posConfig.pagoMovilRefRequired ? 'Ref Oblig.' : undefined 
    },
    { 
      id: 'CASH_BS', 
      title: 'Efectivo Bolívares (Bs)', 
      description: `Billetes en Bs • Ref: ${posConfig.cashBsRefRequired ? 'OBLIGATORIA' : 'Opcional'}` 
    },
    { 
      id: 'CASH_USD', 
      title: 'Efectivo Dólares ($)', 
      description: `Billetes USD • Ref: ${posConfig.cashUsdRefRequired ? 'OBLIGATORIA' : 'Opcional'}` 
    },
    { 
      id: 'BINANCE', 
      title: 'Binance Pay (USDT)', 
      description: `Cripto Pay ID • Ref: ${posConfig.binanceRefRequired ? 'OBLIGATORIA' : 'Opcional'}`, 
      badge: 'Binance' 
    },
    ...(userCanSellOnCredit ? [{ 
      id: 'CREDIT' as PaymentMethodId, 
      title: 'Crédito / Cuenta por Cobrar', 
      description: `Fiado • Ref: ${posConfig.creditRefRequired ? 'OBLIGATORIA' : 'Opcional'}`, 
      badge: 'Crédito' 
    }] : []),
    { 
      id: 'SPLIT', 
      title: 'Pago Mixto (Combinado)', 
      description: 'Combinar varios métodos de pago en Bs y $', 
      badge: 'Pago Mixto' 
    },
  ];

  const docTypeLabels: Record<Client['docType'], string> = {
    V: 'V (Natural Venezolano)',
    E: 'E (Natural Extranjero)',
    J: 'J (Jurídico / Empresa)',
    G: 'G (Gubernamental)',
    P: 'P (Pasaporte)',
    C: 'C (Comunidad sin personalidad jurídica)',
    S: 'S (Sucesión)',
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col p-4 sm:p-6 animate-fade-in">
      <div className="max-w-6xl w-full mx-auto space-y-6 flex-1 flex flex-col">
        
        {/* Top Header Bar with Stepper */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={isProcessing}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a la Caja</span>
            </button>
            <div className="hidden md:block h-6 w-px bg-slate-200" />
            <div className="hidden md:block">
              <h1 className="text-base font-bold text-slate-900">
                Página de Cobro Optimizada • Nota de Entrega
              </h1>
              <p className="text-xs text-slate-500">
                {itemCount} item{itemCount !== 1 ? 's' : ''} • Cajero: {cashierName}
              </p>
            </div>
          </div>

          {/* Stepper (Only if useClientData is enabled) */}
          {posConfig.useClientData && (
            <div className="flex items-center gap-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-1.5 self-start sm:self-center">
              <button
                type="button"
                onClick={() => { if (!isProcessing) setStep(1); }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  step === 1 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>1. Cliente</span>
              </button>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <button
                type="button"
                onClick={() => { if (!isProcessing && validateStep1()) setStep(2); }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  step === 2 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>2. Métodos de Pago</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Garantía Transaccional WAL</span>
            </span>
          </div>
        </div>

        {/* Global Error Banner */}
        {formError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-800 flex items-center gap-2.5 animate-fade-in shrink-0">
            <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
            <span className="font-semibold">{formError}</span>
          </div>
        )}

        {/* Main Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1">
          
          {/* Left Side (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Total Highlight Panel */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-2xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-200 block">
                  Total a Cobrar en Bolívares {(discountVal > 0 || chargeVal > 0) && "(Ajustado)"}
                </span>
                <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight mt-0.5">
                  Bs. {adjustedTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {(discountVal > 0 || chargeVal > 0) && (
                  <span className="text-[10px] text-blue-200 line-through block mt-0.5 font-mono">
                    Original: Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <div className="text-right border-l border-blue-600/60 pl-5">
                <span className="text-xs font-semibold text-blue-200 block">Referencia USD {(discountVal > 0 || chargeVal > 0) && "(Ajustado)"}:</span>
                <div className="text-xl sm:text-2xl font-black font-mono">
                  ${adjustedTotalUsd.toFixed(2)}
                </div>
                {(discountVal > 0 || chargeVal > 0) && (
                  <span className="text-[10px] text-blue-200 line-through block mt-0.5 font-mono">
                    Original: ${totalUsd.toFixed(2)}
                  </span>
                )}
                <div className="text-[11px] font-mono text-blue-200 mt-0.5">
                  Tasa BCV: Bs. {bcvRate.toFixed(2)}
                </div>
              </div>
            </div>

            {/* DISCOUNTS AND EXTRA CHARGES CARD */}
            {posConfig.enableDiscountsAndCharges && (!posConfig.useClientData || step === 2) && (
              userCanApplyDiscountOrSurcharge ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 animate-fade-in">
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span>Descuentos y Cargos Adicionales</span>
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Modifique el total de la transacción en tiempo real.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Descuento */}
                    <div className="space-y-2 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-950">Descuento (Resta)</span>
                        <div className="flex bg-emerald-100/80 p-0.5 rounded-lg border border-emerald-200">
                          <button
                            type="button"
                            onClick={() => {
                              setDiscountType('USD');
                              setDiscountAmountInput('');
                            }}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider transition-all cursor-pointer ${
                              discountType === 'USD' ? 'bg-white text-emerald-800 shadow-xs' : 'text-emerald-600'
                            }`}
                          >
                            $
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDiscountType('BS');
                              setDiscountAmountInput('');
                            }}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider transition-all cursor-pointer ${
                              discountType === 'BS' ? 'bg-white text-emerald-800 shadow-xs' : 'text-emerald-600'
                            }`}
                          >
                            Bs.
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-1.5">
                        <div className="col-span-5 relative">
                          <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-[10px] font-bold text-slate-400 pointer-events-none">
                            {discountType === 'USD' ? '$' : 'Bs.'}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={discountAmountInput}
                            onChange={(e) => setDiscountAmountInput(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-lg pl-6 pr-1 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                          />
                        </div>
                        <div className="col-span-7">
                          <input
                            type="text"
                            value={discountDescription}
                            onChange={(e) => setDiscountDescription(e.target.value)}
                            placeholder="Motivo..."
                            className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cargo Extra */}
                    <div className="space-y-2 p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-950">Cargo Extra (Suma)</span>
                        <div className="flex bg-amber-100/80 p-0.5 rounded-lg border border-amber-200">
                          <button
                            type="button"
                            onClick={() => {
                              setChargeType('USD');
                              setChargeAmountInput('');
                            }}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider transition-all cursor-pointer ${
                              chargeType === 'USD' ? 'bg-white text-amber-800 shadow-xs' : 'text-amber-600'
                            }`}
                          >
                            $
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setChargeType('BS');
                              setChargeAmountInput('');
                            }}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider transition-all cursor-pointer ${
                              chargeType === 'BS' ? 'bg-white text-amber-800 shadow-xs' : 'text-amber-600'
                            }`}
                          >
                            Bs.
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-1.5">
                        <div className="col-span-5 relative">
                          <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-[10px] font-bold text-slate-400 pointer-events-none">
                            {chargeType === 'USD' ? '$' : 'Bs.'}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={chargeAmountInput}
                            onChange={(e) => setChargeAmountInput(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white border border-slate-300 focus:border-amber-600 rounded-lg pl-6 pr-1 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                          />
                        </div>
                        <div className="col-span-7">
                          <input
                            type="text"
                            value={chargeDescription}
                            onChange={(e) => setChargeDescription(e.target.value)}
                            placeholder="Motivo..."
                            className="w-full bg-white border border-slate-300 focus:border-amber-600 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2.5 animate-fade-in">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Tu usuario no tiene autorización para otorgar descuentos ni recargos adicionales en caja.</span>
                </div>
              )
            )}

            {/* STEP 1: CLIENT DATA ENTRY FORM */}
            {posConfig.useClientData && step === 1 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 animate-fade-in">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4.5 h-4.5 text-blue-600" />
                    <span>Paso 1: Datos del Cliente (Nota de Entrega)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rellene la Cédula/RIF o el Nombre del cliente. El sistema sugerirá perfiles existentes automáticamente.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  
                  {/* ID / RIF Doc Number Selector & Auto-suggest */}
                  {posConfig.showClientRif && (
                    <div className="md:col-span-12 relative" ref={docRef}>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-4">
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Tipo RIF / Prefijo {posConfig.clientRifRequired && <span className="text-rose-500">*</span>}
                          </label>
                          <select
                            value={clientDocType}
                            onChange={(e) => setClientDocType(e.target.value as Client['docType'])}
                            className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none"
                          >
                            {Object.entries(docTypeLabels).map(([key, label]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="md:col-span-8">
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Número de Documento / Cédula / RIF {posConfig.clientRifRequired && <span className="text-rose-500">*</span>}
                          </label>
                          <input
                            type="text"
                            value={clientDocNumber}
                            onChange={(e) => handleDocNumberChange(e.target.value)}
                            placeholder="Ej: 29910481 o J-50123456-0"
                            className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Suggestions Overlay */}
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl mt-1 shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                          {suggestions.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleSelectSuggestion(c)}
                              className="w-full text-left p-3 hover:bg-blue-50/50 flex items-center justify-between text-xs cursor-pointer transition-colors"
                            >
                              <div>
                                <span className="font-bold text-slate-900 block">{c.name}</span>
                                <span className="text-slate-500 text-[10px] font-mono mt-0.5 block">{c.docType}-{c.docNumber} • Tel: {c.phone || 'N/A'}</span>
                              </div>
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                Sugerido
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Name Input */}
                  {posConfig.showClientName && (
                    <div className="md:col-span-8">
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Nombre / Razón Social {posConfig.clientNameRequired && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="text"
                        value={clientNameInput}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Ej: Carlos Mendoza o Bodega Alfa C.A."
                        className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Phone Input */}
                  {posConfig.showClientPhone && (
                    <div className="md:col-span-4">
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Teléfono {posConfig.clientPhoneRequired && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="text"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="Ej: 0412-1234567"
                        className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Notes / Address */}
                  {posConfig.showClientNotes && (
                    <div className="md:col-span-12">
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Dirección o Datos Adicionales {posConfig.clientNotesRequired && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="text"
                        value={clientNotes}
                        onChange={(e) => setClientNotes(e.target.value)}
                        placeholder="Ej: Av. Principal Chacao, Edificio Residencial, Local 1"
                        className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Save to Directory toggle */}
                  <div className="md:col-span-12 pt-1">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={saveClientToDb}
                        onChange={(e) => setSaveClientToDb(e.target.checked)}
                        className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Guardar perfil en el directorio para futuras ventas rápidas</span>
                    </label>
                  </div>

                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (validateStep1()) {
                        setStep(2);
                      }
                    }}
                    className="flex items-center gap-1.5 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs cursor-pointer shadow-md shadow-blue-500/20"
                  >
                    <span>Continuar al Pago</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PAYMENT METHOD & TRANSACTION DETAILS */}
            {(!posConfig.useClientData || step === 2) && (
              <div className="space-y-5 animate-fade-in">
                
                {/* Method Selector */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                    Seleccione Método de Pago:
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                          className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer select-none ${
                            isSelected
                              ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-600/30 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <PaymentMethodLogo method={opt.id} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <div className={`text-xs font-bold truncate ${isSelected ? 'text-blue-950 font-black' : 'text-slate-900'}`}>
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

                {/* Dynamic Input Sub-form (Class for keyboard helper target: dynamic-payment-form) */}
                <div className="dynamic-payment-form bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                  
                  {/* METHOD 1: DEBIT_CARD */}
                  {selectedMethod === 'DEBIT_CARD' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <PaymentMethodLogo method="DEBIT_CARD" size="sm" />
                        <div>
                          <span className="font-bold text-slate-900 block text-sm">Tarjeta Débito (POS Local)</span>
                          <p className="text-slate-500 text-[11px] mt-0.5">
                            Monto exacto: <strong className="text-blue-700 font-mono">Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Número de Lote / Aprobación {posConfig.debitCardRefRequired ? <span className="text-rose-500">* (Obligatorio)</span> : '(Opcional)'}:
                        </label>
                        <input
                          type="text"
                          required={posConfig.debitCardRefRequired}
                          value={cardApprovalRef}
                          onChange={(e) => setCardApprovalRef(e.target.value)}
                          placeholder="Ej: 004821"
                          className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* METHOD 2: PAGO_MOVIL */}
                  {selectedMethod === 'PAGO_MOVIL' && (
                    <div className="space-y-4">
                      <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200 text-xs space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-blue-950">
                          <PaymentMethodLogo method="PAGO_MOVIL" size="sm" />
                          <span>Datos para Pago Móvil Recibido (Receptor):</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 font-mono pt-1">
                          <div>Banco: <strong className="text-slate-900">{posConfig.pagoMovilBankName || 'Banesco (0134)'}</strong></div>
                          <div>Teléfono: <strong className="text-slate-900">{posConfig.pagoMovilPhone || '0414-1234567'}</strong></div>
                          <div>RIF: <strong className="text-slate-900">{posConfig.pagoMovilRif || 'J-50123456-0'}</strong></div>
                          <div>Monto Bs.: <strong className="text-blue-700 font-bold">Bs. {adjustedTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                        </div>
                      </div>

                      {/* Optional Banco Emisor Select */}
                      {posConfig.pagoMovilShowBank && (
                        <div className="space-y-1 animate-fade-in">
                          <label className="text-xs font-bold text-slate-700 block">
                            Banco Emisor (De dónde transfirió el cliente) <span className="text-rose-500">*</span>:
                          </label>
                          <select
                            value={pagoMovilEmisorBank}
                            onChange={(e) => setPagoMovilEmisorBank(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-950 focus:outline-none"
                            required
                          >
                            <option value="">-- Seleccione el Banco Emisor --</option>
                            {VENEZUELAN_BANKS.map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Optional Account Type Selector */}
                      {posConfig.pagoMovilShowAccountType && (
                        <div className="space-y-1 animate-fade-in">
                          <label className="text-xs font-bold text-slate-700 block">
                            Tipo de Cuenta Emisora:
                          </label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                              <input
                                type="radio"
                                name="pmAccountType"
                                checked={pagoMovilAccountType === 'PERSONAL'}
                                onChange={() => setPagoMovilAccountType('PERSONAL')}
                                className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <span>Personal (Cédula)</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                              <input
                                type="radio"
                                name="pmAccountType"
                                checked={pagoMovilAccountType === 'JURIDICO'}
                                onChange={() => setPagoMovilAccountType('JURIDICO')}
                                className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <span>Jurídico / Empresa (RIF)</span>
                            </label>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-bold text-slate-800 block mb-1">
                          Número de Referencia de Pago Móvil {posConfig.pagoMovilRefRequired ? <span className="text-rose-500">* (Obligatorio)</span> : '(Opcional)'}:
                        </label>
                        <input
                          type="text"
                          required={posConfig.pagoMovilRefRequired}
                          value={pagoMovilRef}
                          onChange={(e) => {
                            setPagoMovilRef(e.target.value);
                            if (formError) setFormError(null);
                          }}
                          placeholder="Ej: 984512 (Comprobante bancario)"
                          className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* METHOD 3: CASH_BS */}
                  {selectedMethod === 'CASH_BS' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-bold text-slate-800">Monto Recibido en Bolívares (Bs.):</label>
                        <button
                          type="button"
                          onClick={() => setCashBsReceived(totalBs.toFixed(2))}
                          className="text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          Monto Exacto (Bs. {totalBs.toFixed(2)})
                        </button>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                          Bs.
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min={totalBs}
                          value={cashBsReceived}
                          onChange={(e) => setCashBsReceived(e.target.value)}
                          placeholder={totalBs.toFixed(2)}
                          className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl pl-12 pr-4 py-3 text-lg font-mono font-bold text-slate-900 focus:outline-none"
                        />
                      </div>

                      {/* Cash Bs reference input if required */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1 mt-2">
                          Referencia de Pago/Arqueo de Caja {posConfig.cashBsRefRequired ? <span className="text-rose-500">* (Obligatorio)</span> : '(Opcional)'}:
                        </label>
                        <input
                          type="text"
                          required={posConfig.cashBsRefRequired}
                          value={cashBsRef}
                          onChange={(e) => setCashBsRef(e.target.value)}
                          placeholder="Serial, comprobante o número de control"
                          className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 focus:outline-none"
                        />
                      </div>

                      {bsReceivedNum >= (totalBs - 0.05) && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                          <div className="text-xs text-emerald-700 font-semibold">Vuelto / Cambio a Entregar:</div>
                          <div className="text-2xl font-black font-mono text-emerald-800">
                            Bs. {changeBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs font-mono text-emerald-700 mt-0.5">
                            ≈ ${changeBsInUsd.toFixed(2)} USD
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* METHOD 4: CASH_USD */}
                  {selectedMethod === 'CASH_USD' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-bold text-slate-800">Monto Recibido en Dólares ($):</label>
                        <button
                          type="button"
                          onClick={() => setCashUsdReceived(totalUsd.toFixed(2))}
                          className="text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          Monto Exacto (${totalUsd.toFixed(2)})
                        </button>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                          $
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min={totalUsd}
                          value={cashUsdReceived}
                          onChange={(e) => setCashUsdReceived(e.target.value)}
                          placeholder={totalUsd.toFixed(2)}
                          className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl pl-9 pr-4 py-3 text-lg font-mono font-bold text-slate-900 focus:outline-none"
                        />
                      </div>

                      <div className="flex gap-1.5">
                        {[1, 5, 10, 20, 50, 100].map((bill) => (
                          <button
                            key={bill}
                            type="button"
                            onClick={() => setCashUsdReceived(bill.toString())}
                            className="flex-1 py-1.5 text-xs font-mono font-bold rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-700 cursor-pointer"
                          >
                            ${bill}
                          </button>
                        ))}
                      </div>

                      {/* Cash USD reference input if required */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1 mt-2">
                          Referencia / Serial de Billetes {posConfig.cashUsdRefRequired ? <span className="text-rose-500">* (Obligatorio)</span> : '(Opcional)'}:
                        </label>
                        <input
                          type="text"
                          required={posConfig.cashUsdRefRequired}
                          value={cashUsdRef}
                          onChange={(e) => setCashUsdRef(e.target.value)}
                          placeholder="Seriales de billetes o notas de control"
                          className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 focus:outline-none"
                        />
                      </div>

                      {usdReceivedNum >= (totalUsd - 0.01) && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                          <div className="text-xs text-emerald-700 font-semibold">Vuelto / Cambio a Entregar:</div>
                          <div className="text-2xl font-black font-mono text-emerald-800">
                            ${changeUsd.toFixed(2)} USD
                          </div>
                          <div className="text-xs font-mono text-emerald-700 mt-0.5">
                            ≈ Bs. {changeUsdInBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* METHOD 5: BINANCE */}
                  {selectedMethod === 'BINANCE' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-xs text-slate-700 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
                        <PaymentMethodLogo method="BINANCE" size="sm" />
                        <div>
                          <span className="font-bold text-slate-900 block text-sm">Binance Pay (USDT)</span>
                          <p className="text-slate-500 text-[11px] mt-0.5">Monto: <strong className="text-amber-700 font-mono">${totalUsd.toFixed(2)} USDT</strong></p>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-800 block mb-1">
                          Número de Referencia / ID de Orden Binance {posConfig.binanceRefRequired ? <span className="text-rose-500">* (Obligatorio)</span> : '(Opcional)'}:
                        </label>
                        <input
                          type="text"
                          required={posConfig.binanceRefRequired}
                          value={binanceRef}
                          onChange={(e) => setBinanceRef(e.target.value)}
                          placeholder="Ej: 28491823901"
                          className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* METHOD 6: CREDIT */}
                  {selectedMethod === 'CREDIT' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-xs text-slate-700 bg-indigo-50 p-3.5 rounded-xl border border-indigo-200">
                        <PaymentMethodLogo method="CREDIT" size="sm" />
                        <div>
                          <span className="font-bold text-indigo-950 block text-sm">Venta a Crédito / Fiado Comercial</span>
                          <p className="text-slate-500 text-[11px] mt-0.5">Monto: <strong className="text-indigo-700 font-mono">Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong></p>
                        </div>
                      </div>

                      {/* Display Client name automatically if step 1 is enabled */}
                      {posConfig.useClientData ? (
                        <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 text-xs text-indigo-900">
                          <span className="font-bold block">Cliente deudor asignado:</span>
                          <p className="font-mono mt-1 font-bold text-[13px]">{clientNameInput || 'Sin nombre asignado'}</p>
                        </div>
                      ) : (
                        <div className="space-y-3.5 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                          <div className="border-b border-slate-100 pb-1.5">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Datos del Cliente Deudor</span>
                            <span className="text-[10px] text-slate-400 block">Es obligatorio registrar la identificación para la cuenta por cobrar.</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 relative" ref={docRef}>
                            <div className="sm:col-span-4">
                              <label className="text-[10px] font-bold text-slate-700 block mb-1">Tipo Doc:</label>
                              <select
                                value={clientDocType}
                                onChange={(e) => setClientDocType(e.target.value as any)}
                                className="w-full bg-white border border-slate-300 focus:border-indigo-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none"
                              >
                                <option value="V">Venezolano (V)</option>
                                <option value="E">Extranjero (E)</option>
                                <option value="J">Jurídico (J)</option>
                                <option value="G">Gubernamental (G)</option>
                                <option value="P">Pasaporte (P)</option>
                                <option value="C">Cédula (C)</option>
                                <option value="S">Sucesiones (S)</option>
                              </select>
                            </div>

                            <div className="sm:col-span-8">
                              <label className="text-[10px] font-bold text-slate-700 block mb-1">Cédula / RIF *:</label>
                              <input
                                type="text"
                                value={clientDocNumber}
                                onChange={(e) => handleDocNumberChange(e.target.value)}
                                placeholder="Ej: 29910481"
                                className="w-full bg-white border border-slate-300 focus:border-indigo-600 rounded-xl px-4 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                              />

                              {/* Suggestions Overlay */}
                              {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl mt-1 shadow-xl max-h-40 overflow-y-auto divide-y divide-slate-100">
                                  {suggestions.map((c) => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => handleSelectSuggestion(c)}
                                      className="w-full text-left p-2.5 hover:bg-blue-50/50 flex items-center justify-between text-[11px] cursor-pointer transition-colors"
                                    >
                                      <div>
                                        <span className="font-bold text-slate-900 block">{c.name}</span>
                                        <span className="text-slate-500 text-[9px] font-mono block">{c.docType}-{c.docNumber}</span>
                                      </div>
                                      <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Sugerido</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-slate-700 block mb-1">Nombre / Razón Social *:</label>
                              <input
                                type="text"
                                value={clientNameInput}
                                onChange={(e) => setClientNameInput(e.target.value)}
                                placeholder="Ej: Carlos Mendoza"
                                className="w-full bg-white border border-slate-300 focus:border-indigo-600 rounded-xl px-4 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-700 block mb-1">Teléfono:</label>
                              <input
                                type="text"
                                value={clientPhone}
                                onChange={(e) => setClientPhone(e.target.value)}
                                placeholder="Ej: 0412-1234567"
                                className="w-full bg-white border border-slate-300 focus:border-indigo-600 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">Dirección / Notas Adicionales (Opcional):</label>
                            <input
                              type="text"
                              value={clientNotes}
                              onChange={(e) => setClientNotes(e.target.value)}
                              placeholder="Ej: Local Chacao"
                              className="w-full bg-white border border-slate-300 focus:border-indigo-600 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none"
                            />
                          </div>

                          <div className="pt-1">
                            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={saveClientToDb}
                                onChange={(e) => setSaveClientToDb(e.target.checked)}
                                className="h-4 w-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <span>Guardar perfil en el directorio de deudores</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Credit reference input */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Autorización / ID de Crédito {posConfig.creditRefRequired ? <span className="text-rose-500">* (Obligatorio)</span> : '(Opcional)'}:
                        </label>
                        <input
                          type="text"
                          required={posConfig.creditRefRequired}
                          value={creditRef}
                          onChange={(e) => setCreditRef(e.target.value)}
                          placeholder="Código de pagaré o firma autorizada"
                          className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-600 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* METHOD 7: PAGO MIXTO (SPLIT) */}
                  {selectedMethod === 'SPLIT' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className={`p-4 rounded-xl border ${
                        isSplitCovered ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-amber-50 border-amber-300 text-amber-950'
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider block">
                              {isSplitCovered ? '¡Total Cubierto con Éxito!' : 'Diferencia Restante a Pagar:'}
                            </span>
                            {!isSplitCovered ? (
                              <div className="flex items-baseline gap-3 mt-1">
                                <div className="text-2xl sm:text-3xl font-black font-mono text-blue-700">
                                  Bs. {splitDiffBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="text-base font-bold font-mono text-slate-700">
                                  (${splitDiffUsd.toFixed(2)})
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 mt-1 text-emerald-800 font-bold text-sm">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                <span>Monto completado con {splitEntries.length} pagos registrados</span>
                              </div>
                            )}
                          </div>

                          {splitChangeUsd > 0 && (
                            <div className="text-right bg-white px-3 py-2 rounded-xl border border-emerald-200">
                              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Vuelto / Cambio:</span>
                              <span className="text-xs font-mono font-black text-emerald-800">
                                Bs. {splitChangeBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Add slice sub-form */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="text-xs font-bold text-slate-800">Agregar Método al Pago Mixto:</div>
                        
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                          {[
                            { id: 'CASH_USD', label: 'Efectivo $' },
                            { id: 'CASH_BS', label: 'Efectivo Bs' },
                            { id: 'DEBIT_CARD', label: 'POS' },
                            { id: 'PAGO_MOVIL', label: 'Pago Móvil' },
                            { id: 'BINANCE', label: 'Binance' },
                            ...(userCanSellOnCredit ? [{ id: 'CREDIT', label: 'Crédito' }] : []),
                          ].map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleSplitMethodSelect(m.id as PaymentMethodId)}
                              className={`p-2 rounded-lg border text-center transition-all cursor-pointer text-xs ${
                                splitSelectedMethod === m.id
                                  ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-4 flex rounded-xl border border-slate-300 p-1 bg-white">
                            <button
                              type="button"
                              onClick={() => handleSplitCurrencyChange('USD')}
                              className={`flex-1 py-1 text-xs font-bold rounded-lg ${splitCurrency === 'USD' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'}`}
                            >
                              USD ($)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSplitCurrencyChange('BS')}
                              className={`flex-1 py-1 text-xs font-bold rounded-lg ${splitCurrency === 'BS' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'}`}
                            >
                              Bs.
                            </button>
                          </div>

                          <div className="sm:col-span-8 relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                              {splitCurrency === 'USD' ? '$' : 'Bs.'}
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={splitAmountInput}
                              onChange={(e) => setSplitAmountInput(e.target.value)}
                              className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Split references based on config */}
                        {((splitSelectedMethod === 'PAGO_MOVIL' && posConfig.pagoMovilRefRequired) ||
                          (splitSelectedMethod === 'BINANCE' && posConfig.binanceRefRequired) ||
                          (splitSelectedMethod === 'DEBIT_CARD' && posConfig.debitCardRefRequired) ||
                          (splitSelectedMethod === 'CASH_BS' && posConfig.cashBsRefRequired) ||
                          (splitSelectedMethod === 'CASH_USD' && posConfig.cashUsdRefRequired) ||
                          (splitSelectedMethod === 'CREDIT' && posConfig.creditRefRequired)) && (
                          <input
                            type="text"
                            value={splitRefInput}
                            onChange={(e) => setSplitRefInput(e.target.value)}
                            placeholder="Código o número de referencia obligatorio *"
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none"
                          />
                        )}

                        {splitSelectedMethod === 'CREDIT' && !posConfig.useClientData && (
                          <input
                            type="text"
                            value={splitClientInput}
                            onChange={(e) => setSplitClientInput(e.target.value)}
                            placeholder="Nombre del cliente a crédito *"
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                          />
                        )}

                        {splitInputError && (
                          <div className="text-xs text-rose-600 font-medium">{splitInputError}</div>
                        )}

                        <button
                          type="button"
                          onClick={handleAddSplitEntry}
                          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Agregar a la Combinación de Pago</span>
                        </button>
                      </div>

                      {/* List of split payments */}
                      {splitEntries.length > 0 && (
                        <div className="space-y-2 animate-fade-in">
                          <div className="text-xs font-bold text-slate-700">Pagos Registrados en la Combinación:</div>
                          <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-xl overflow-hidden">
                            {splitEntries.map((e) => (
                              <div key={e.id} className="p-3 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <PaymentMethodLogo method={e.method} size="sm" />
                                  <div>
                                    <span className="font-bold text-slate-900">{e.method}</span>
                                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                      {e.currency === 'USD' ? `$${e.amount.toFixed(2)}` : `Bs. ${e.amount.toFixed(2)}`}
                                      {e.reference && ` • Ref: ${e.reference}`}
                                      {e.clientName && ` • Cliente: ${e.clientName}`}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSplitEntry(e.id)}
                                  className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Back button for Stepper */}
                {posConfig.useClientData && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={isProcessing}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer select-none"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Volver al Paso 1: Datos del Cliente</span>
                  </button>
                )}
              </div>
            )}

          </div>

          {/* Right Side: Order Summary & Confirmation (5 cols) */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-5">
              
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-blue-600" />
                  <span>Resumen de Transacción</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Cajero: {cashierName}</p>
              </div>

              {posConfig.useClientData && (clientDocNumber || clientNameInput) && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1.5">
                  <span className="font-bold text-slate-800 block uppercase tracking-wider text-[10px]">Cliente / Receptor:</span>
                  <div>
                    <span className="font-bold text-slate-950 block">{clientNameInput || 'Contado / Cliente General'}</span>
                    <span className="text-blue-700 font-mono text-[10px] mt-0.5 block">{clientDocType}-{clientDocNumber || 'Contado'}</span>
                    {clientPhone && <span className="text-slate-500 font-mono text-[10px] block mt-0.5">Telf: {clientPhone}</span>}
                    {clientNotes && <span className="text-slate-500 text-[10px] block mt-0.5 max-w-full truncate" title={clientNotes}>Dir: {clientNotes}</span>}
                  </div>
                </div>
              )}

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Total Productos:</span>
                  <span className="font-bold text-slate-900">{itemCount} items</span>
                </div>
                <div className="flex justify-between">
                  <span>Método Seleccionado:</span>
                  <span className="font-bold text-blue-700">{selectedMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tasa BCV Oficial:</span>
                  <span className="font-mono font-bold text-slate-900">Bs. {bcvRate.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                {(discountVal > 0 || chargeVal > 0) && (
                  <div className="space-y-2 pb-2.5 border-b border-dashed border-slate-200 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal Original:</span>
                      <span className="font-mono font-semibold">
                        Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalUsd.toFixed(2)})
                      </span>
                    </div>

                    {discountVal > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-emerald-800 space-y-1">
                        <div className="flex justify-between items-center font-bold">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Descuento Aplicado:
                          </span>
                          <span className="font-mono text-emerald-700 font-black">
                            -{discountType === 'USD' 
                              ? `$${discountVal.toFixed(2)} USD` 
                              : `Bs. ${discountVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-emerald-900/80 bg-white/70 px-2 py-0.5 rounded border border-emerald-100 flex items-center justify-between">
                          <span>Motivo: <strong>{discountDescription.trim() || 'Descuento General'}</strong></span>
                          {discountType === 'USD' && (
                            <span className="font-mono text-[10px] text-emerald-700">
                              (Eq. -Bs. {(discountVal * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {chargeVal > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-amber-800 space-y-1">
                        <div className="flex justify-between items-center font-bold">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            Cargo Adicional:
                          </span>
                          <span className="font-mono text-amber-700 font-black">
                            +{chargeType === 'USD' 
                              ? `$${chargeVal.toFixed(2)} USD` 
                              : `Bs. ${chargeVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-amber-900/80 bg-white/70 px-2 py-0.5 rounded border border-amber-100 flex items-center justify-between">
                          <span>Motivo: <strong>{chargeDescription.trim() || 'Cargo Extra'}</strong></span>
                          {chargeType === 'USD' && (
                            <span className="font-mono text-[10px] text-amber-700">
                              (Eq. +Bs. {(chargeVal * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Total a Pagar (Bs):</span>
                  <span className="text-2xl font-black font-mono text-blue-700">
                    Bs. {adjustedTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total en Dólares ($):</span>
                  <span className="text-base font-black font-mono text-slate-800">
                    ${adjustedTotalUsd.toFixed(2)} USD
                  </span>
                </div>
              </div>

              {step === 2 ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canConfirm || isProcessing}
                  className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md active:scale-98 ${
                    !canConfirm || isProcessing
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-500/25 shadow-md hover:shadow-lg'
                  }`}
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Procesando Venta Atómica...</span>
                    </div>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>CONFIRMAR Y COBRAR TICKET</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep1()) {
                      setStep(2);
                    }
                  }}
                  className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-98 cursor-pointer transition-all"
                >
                  <span>Siguiente: Detalle de Pago</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              <div className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
                <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Bloqueo WAL y garantía transaccional ACID</span>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
