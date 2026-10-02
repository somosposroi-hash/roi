import React, { useState, useEffect } from 'react';
import { 
  Search, 
  User, 
  Calendar, 
  Receipt, 
  ChevronRight, 
  CheckCircle2, 
  CreditCard, 
  Coins, 
  DollarSign, 
  ArrowRight, 
  Printer, 
  Sparkles, 
  AlertCircle, 
  Info, 
  ShieldCheck, 
  RefreshCw, 
  Landmark, 
  Wallet,
  ArrowLeft,
  ChevronLeft,
  Smartphone,
  Banknote,
  QrCode,
  FileText,
  SlidersHorizontal,
  ChevronDown,
  Briefcase
} from 'lucide-react';
import { Sale, Client, POSConfig } from '../types';
import { getClientsList, saveClientsList, getPOSConfig } from '../utils/configHelper';
import { PaymentMethodLogo, PaymentMethodId } from './PaymentMethodLogo';
import { safeFetchJson } from '../utils/api';

interface CxcViewProps {
  bcvRate: number;
}

export function CxcView({ bcvRate }: CxcViewProps) {
  const [activeTab, setActiveTab] = useState<'deudores' | 'pagos'>('deudores');
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'debt_desc' | 'debt_asc' | 'name_asc' | 'name_desc'>('debt_desc');
  const [debtFilter, setDebtFilter] = useState<'ALL' | 'DEBTORS' | 'SOLVENT' | 'VENCIDOS' | 'PRONTO_A_VENCER' | 'MORADO'>('ALL');

  // Client profile view state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Modal receipt states
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Payment wizard states
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState<1 | 2>(1);
  const [paymentAmountUsd, setPaymentAmountUsd] = useState('');
  const [paymentAmountBs, setPaymentAmountBs] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'BS'>('USD');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>('PAGO_MOVIL'); // Default to PM
  
  // Method-specific details
  const [pmReference, setPmReference] = useState('');
  const [pmBank, setPmBank] = useState('');
  const [pmAccount, setPmAccount] = useState('PERSONAL');
  const [debitReference, setDebitReference] = useState('');
  const [cashBsReceived, setCashBsReceived] = useState('');
  const [cashBsRef, setCashBsRef] = useState('');
  const [cashUsdReceived, setCashUsdReceived] = useState('');
  const [cashUsdRef, setCashUsdRef] = useState('');
  const [binanceRef, setBinanceRef] = useState('');

  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [posConfig, setPosConfig] = useState<POSConfig>(() => getPOSConfig());

  useEffect(() => {
    fetchSalesAndClients();
    // Load config from localStorage
    try {
      const savedConfig = localStorage.getItem('nubly_app_pos_config_v1');
      if (savedConfig) {
        setPosConfig(JSON.parse(savedConfig));
      }
    } catch (e) {
      console.error('Error loading config:', e);
    }
  }, []);

  const fetchSalesAndClients = async () => {
    setIsLoading(true);
    const res = await safeFetchJson<any[]>('/api/v1/sales');
    if (res.ok && Array.isArray(res.data)) {
      setSales(res.data);
    } else {
      console.warn('[CxcView] Non-critical fetch notice:', res.error);
    }
    setClients(getClientsList());
    setIsLoading(false);
  };

  // Helper to parse notes METADATA_JSON
  const parseSaleMeta = (notes?: string) => {
    let clientName = 'Contado / Cliente General';
    let docType = '';
    let docNumber = '';
    let clientPhone = '';
    let clientNotes = '';
    let discount: { amount: number; type: 'USD' | 'BS'; description: string } | null = null;
    let charge: { amount: number; type: 'USD' | 'BS'; description: string } | null = null;
    let pagoMovil: { emisorBank?: string; accountType?: string } | null = null;
    let reference = notes || '';
    let adjustedTotalUsd: number | null = null;
    let adjustedTotalBs: number | null = null;
    let type: string | null = null;
    let paymentDetails: any = null;

    if (notes) {
      if (notes.startsWith('METADATA_JSON:')) {
        try {
          const jsonStr = notes.replace('METADATA_JSON:', '');
          const meta = JSON.parse(jsonStr);
          if (meta.client) {
            clientName = meta.client.name;
            docType = meta.client.docType;
            docNumber = meta.client.docNumber;
            clientPhone = meta.client.phone || '';
            clientNotes = meta.client.notes || '';
          }
          discount = meta.discount || null;
          charge = meta.charge || null;
          pagoMovil = meta.pagoMovil || null;
          reference = meta.paymentReference || '';
          type = meta.type || null;
          paymentDetails = meta.paymentDetails || null;
          if (meta.adjustedTotalUsd !== undefined) {
            adjustedTotalUsd = meta.adjustedTotalUsd;
            adjustedTotalBs = meta.adjustedTotalBs;
          }
        } catch (e) {
          console.error('Error parsing METADATA_JSON:', e);
        }
      } else if (notes.startsWith('CLIENT_DATA_JSON:')) {
        try {
          const parts = notes.split(' | REFERENCE: ');
          const jsonStr = parts[0].replace('CLIENT_DATA_JSON:', '');
          const clientData = JSON.parse(jsonStr);
          clientName = clientData.name;
          docType = clientData.docType;
          docNumber = clientData.docNumber;
          clientPhone = clientData.phone || '';
          clientNotes = clientData.notes || '';
          reference = parts[1] || '';
        } catch (e) {
          console.error('Error parsing client data from notes:', e);
        }
      }
    }

    return {
      clientName,
      docType,
      docNumber,
      clientPhone,
      clientNotes,
      discount,
      charge,
      pagoMovil,
      reference,
      adjustedTotalUsd,
      adjustedTotalBs,
      type,
      paymentDetails
    };
  };

  // Extract credit amount for a specific sale (and specific client if specified)
  const getCreditAmountForSale = (sale: Sale, clientDocNumber?: string) => {
    if (sale.status === 'VOIDED') {
      return 0;
    }
    const meta = parseSaleMeta(sale.notes);
    
    // Validate client matches
    if (clientDocNumber && meta.docNumber !== clientDocNumber) {
      return 0;
    }

    // Abonos do not count as credit additions
    if (sale.invoiceNumber.startsWith('ABO-') || meta.type === 'cxc_payment') {
      return 0;
    }

    if (sale.paymentMethod === 'CREDIT') {
      return meta.adjustedTotalUsd !== null ? meta.adjustedTotalUsd : sale.total;
    }

    if (sale.paymentMethod === 'SPLIT') {
      const ref = meta.reference || '';
      const creditMatch = ref.match(/(?:CREDIT|Cr\u00e9dito|CREDITO):\s*(?:\$|Bs\.)\s*([0-9.]+)/i);
      if (creditMatch) {
        return parseFloat(creditMatch[1]);
      }
    }

    return 0;
  };

  // Extract payment/abono amount for a specific sale / client
  const getPaymentAmountForSale = (sale: Sale, clientDocNumber?: string) => {
    if (sale.status === 'VOIDED') {
      return 0;
    }
    const meta = parseSaleMeta(sale.notes);

    // Filter to only check cxc payments
    if (!sale.invoiceNumber.startsWith('ABO-') && meta.type !== 'cxc_payment') {
      return 0;
    }

    // Validate client matches
    if (clientDocNumber && meta.docNumber !== clientDocNumber) {
      return 0;
    }

    if (meta.paymentDetails) {
      return meta.paymentDetails.amountPaidUsd || 0;
    }

    return sale.total;
  };

  // Helper to compute a client's specific debt and breakdown
  const getClientDebtDetails = (client: Client) => {
    const clientCreditSales = sales.filter(s => {
      if (s.status === 'VOIDED') return false;
      const meta = parseSaleMeta(s.notes);
      return meta.docNumber === client.docNumber && getCreditAmountForSale(s, client.docNumber) > 0;
    });

    const clientPayments = sales.filter(s => {
      if (s.status === 'VOIDED') return false;
      const meta = parseSaleMeta(s.notes);
      return meta.docNumber === client.docNumber && (s.invoiceNumber.startsWith('ABO-') || meta.type === 'cxc_payment');
    });

    const totalCreditUsd = clientCreditSales.reduce((acc, s) => acc + getCreditAmountForSale(s, client.docNumber), 0);
    const totalPaidUsd = clientPayments.reduce((acc, s) => acc + getPaymentAmountForSale(s, client.docNumber), 0);
    const currentDebtUsd = Math.max(0, totalCreditUsd - totalPaidUsd);

    return {
      creditSales: clientCreditSales,
      payments: clientPayments,
      totalCreditUsd,
      totalPaidUsd,
      currentDebtUsd,
      currentDebtBs: currentDebtUsd * bcvRate
    };
  };

  const calculateClientStatus = (client: Client, currentDebtUsd: number) => {
    if (currentDebtUsd <= 0.01) {
      return {
        status: 'SOLVENTE' as const,
        label: 'Solvente',
        colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        daysDiff: 0,
      };
    }

    if (!client.paymentDayOfMonth) {
      return {
        status: 'SIN_TERMINOS' as const,
        label: 'Sin Términos',
        colorClass: 'bg-slate-50 text-slate-500 border-slate-200',
        daysDiff: 0,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();
    const month = today.getMonth();

    // Create due date for the current month
    const dueDate = new Date(year, month, client.paymentDayOfMonth);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      if (diffDays > 7) {
        return {
          status: 'MORADO' as const,
          label: `Cobranza Externa (${diffDays}d vencido)`,
          colorClass: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 font-bold',
          daysDiff: -diffDays,
        };
      } else {
        return {
          status: 'VENCIDO' as const,
          label: `Vencido (${diffDays}d)`,
          colorClass: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
          daysDiff: -diffDays,
        };
      }
    } else {
      const daysRemaining = Math.abs(diffDays);
      if (daysRemaining <= 3) {
        return {
          status: 'PRONTO_A_VENCER' as const,
          label: daysRemaining === 0 ? 'Vence hoy' : `Pronto a vencer (${daysRemaining}d)`,
          colorClass: 'bg-amber-50 text-amber-700 border-amber-200 font-bold',
          daysDiff: daysRemaining,
        };
      } else {
        return {
          status: 'A_TIEMPO' as const,
          label: `Al día (${daysRemaining}d restantes)`,
          colorClass: 'bg-sky-50 text-sky-700 border-sky-200',
          daysDiff: daysRemaining,
        };
      }
    }
  };

  // Process and aggregate all clients with active or past debts
  const deudoresList = clients.map(client => {
    const details = getClientDebtDetails(client);
    const statusDetails = calculateClientStatus(client, details.currentDebtUsd);
    return {
      client,
      ...details,
      statusDetails
    };
  });

  // Filter and sort the client list
  const filteredDeudores = deudoresList.filter(item => {
    // 1. Text query match
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchText = (
        item.client.name.toLowerCase().includes(q) ||
        item.client.docNumber.includes(q) ||
        item.client.phone.includes(q)
      );
      if (!matchText) return false;
    }

    // 2. Status filter
    if (debtFilter === 'DEBTORS') {
      return item.currentDebtUsd > 0.01;
    }
    if (debtFilter === 'SOLVENT') {
      return item.currentDebtUsd <= 0.01;
    }
    if (debtFilter === 'VENCIDOS') {
      return item.statusDetails.status === 'VENCIDO' || item.statusDetails.status === 'MORADO';
    }
    if (debtFilter === 'PRONTO_A_VENCER') {
      return item.statusDetails.status === 'PRONTO_A_VENCER';
    }
    if (debtFilter === 'MORADO') {
      return item.statusDetails.status === 'MORADO';
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === 'debt_desc') return b.currentDebtUsd - a.currentDebtUsd;
    if (sortBy === 'debt_asc') return a.currentDebtUsd - b.currentDebtUsd;
    if (sortBy === 'name_asc') return a.client.name.localeCompare(b.client.name);
    if (sortBy === 'name_desc') return b.client.name.localeCompare(a.client.name);
    return 0;
  });

  // Retrieve list of all abonos / payments overall
  const paymentsHistoryList = sales.filter(s => {
    const meta = parseSaleMeta(s.notes);
    return s.invoiceNumber.startsWith('ABO-') || meta.type === 'cxc_payment';
  }).map(s => {
    const meta = parseSaleMeta(s.notes);
    return {
      sale: s,
      meta
    };
  }).sort((a, b) => new Date(b.sale.createdAt).getTime() - new Date(a.sale.createdAt).getTime());

  // Generate lightweight random background colors and icons for client profiles
  const getAvatarGradient = (name: string) => {
    const colors = [
      'from-blue-500 to-indigo-600 text-white',
      'from-emerald-500 to-teal-600 text-white',
      'from-purple-500 to-pink-600 text-white',
      'from-amber-500 to-orange-600 text-white',
      'from-rose-500 to-red-600 text-white',
      'from-cyan-500 to-blue-600 text-white',
      'from-violet-500 to-purple-600 text-white',
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  const renderAvatarIcon = (name: string) => {
    const icons = [User, Landmark, Briefcase, Coins, ShieldCheck];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    const IconComponent = icons[sum % icons.length];
    return <IconComponent className="w-5 h-5 opacity-90" />;
  };

  // Convert amounts live during manual payment entry
  const handlePaymentAmountChange = (val: string, currency: 'USD' | 'BS') => {
    if (currency === 'USD') {
      setPaymentAmountUsd(val);
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && bcvRate > 0) {
        setPaymentAmountBs((parsed * bcvRate).toFixed(2));
      } else {
        setPaymentAmountBs('');
      }
    } else {
      setPaymentAmountBs(val);
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && bcvRate > 0) {
        setPaymentAmountUsd((parsed / bcvRate).toFixed(2));
      } else {
        setPaymentAmountUsd('');
      }
    }
  };

  const handleOpenPayment = () => {
    if (!selectedClient) return;
    const debtDetails = getClientDebtDetails(selectedClient);
    
    // Initialize payment entry
    setPaymentAmountUsd(debtDetails.currentDebtUsd.toFixed(2));
    setPaymentAmountBs((debtDetails.currentDebtUsd * bcvRate).toFixed(2));
    setPaymentCurrency('USD');
    setPaymentMethod('PAGO_MOVIL');
    setPmReference('');
    setPmBank('');
    setPmAccount('PERSONAL');
    setDebitReference('');
    setCashBsReceived('');
    setCashBsRef('');
    setCashUsdReceived('');
    setCashUsdRef('');
    setBinanceRef('');
    setPaymentError(null);
    setPaymentStep(1);
    setIsPaymentOpen(true);
  };

  // Validate Step 1 of payment (amount validation)
  const handleNextStepPayment = () => {
    setPaymentError(null);
    const amountUsd = parseFloat(paymentAmountUsd);
    
    if (isNaN(amountUsd) || amountUsd <= 0) {
      setPaymentError('Por favor ingrese un monto válido a abonar.');
      return;
    }

    if (!selectedClient) return;
    const debtDetails = getClientDebtDetails(selectedClient);
    
    if (amountUsd > (debtDetails.currentDebtUsd + 0.01)) {
      setPaymentError(`El abono ($${amountUsd.toFixed(2)}) no puede exceder la deuda actual ($${debtDetails.currentDebtUsd.toFixed(2)}).`);
      return;
    }

    setPaymentStep(2);
  };

  // Confirm and submit payment
  const handleConfirmPayment = async () => {
    setPaymentError(null);
    if (!selectedClient) return;

    const amountUsd = parseFloat(paymentAmountUsd);
    const amountBs = parseFloat(paymentAmountBs);
    const debtDetails = getClientDebtDetails(selectedClient);

    // Validate reference based on POS configuration
    let finalReference = '';
    if (paymentMethod === 'PAGO_MOVIL') {
      if (posConfig.pagoMovilRefRequired && !pmReference.trim()) {
        setPaymentError('El número de referencia de Pago Móvil es obligatorio.');
        return;
      }
      let refText = pmReference.trim() ? `Pago Móvil Ref: ${pmReference.trim()}` : 'Pago Móvil';
      if (pmBank) {
        refText += ` | Banco Emisor: ${pmBank}`;
      }
      refText += ` | Cuenta: ${pmAccount === 'PERSONAL' ? 'Personal' : 'Jurídica'}`;
      finalReference = refText;
    } else if (paymentMethod === 'DEBIT_CARD') {
      if (posConfig.debitCardRefRequired && !debitReference.trim()) {
        setPaymentError('El número de lote/aprobación de la tarjeta es obligatorio.');
        return;
      }
      finalReference = debitReference.trim() 
        ? `Tarjeta Débito Lote/Aprob: ${debitReference.trim()}` 
        : 'Tarjeta Débito (POS)';
    } else if (paymentMethod === 'CASH_BS') {
      const received = parseFloat(cashBsReceived) || amountBs;
      if (received < (amountBs - 0.05)) {
        setPaymentError(`El monto en bolívares recibido (Bs. ${received.toFixed(2)}) debe cubrir el abono (Bs. ${amountBs.toFixed(2)}).`);
        return;
      }
      const changeBs = Math.max(0, received - amountBs);
      finalReference = `Efectivo Bs (Recibido: Bs. ${received.toFixed(2)}, Cambio: Bs. ${changeBs.toFixed(2)})`;
      if (cashBsRef.trim()) {
        finalReference += ` Ref: ${cashBsRef.trim()}`;
      }
    } else if (paymentMethod === 'CASH_USD') {
      const received = parseFloat(cashUsdReceived) || amountUsd;
      if (received < (amountUsd - 0.01)) {
        setPaymentError(`El monto en dólares recibido ($${received.toFixed(2)}) debe cubrir el abono ($${amountUsd.toFixed(2)}).`);
        return;
      }
      const changeUsd = Math.max(0, received - amountUsd);
      finalReference = `Efectivo USD (Recibido: $${received.toFixed(2)}, Cambio: $${changeUsd.toFixed(2)})`;
      if (cashUsdRef.trim()) {
        finalReference += ` Ref: ${cashUsdRef.trim()}`;
      }
    } else if (paymentMethod === 'BINANCE') {
      if (posConfig.binanceRefRequired && !binanceRef.trim()) {
        setPaymentError('La referencia o ID de Binance es obligatoria.');
        return;
      }
      finalReference = binanceRef.trim() ? `Binance Pay Ref: ${binanceRef.trim()}` : 'Binance Pay';
    }

    setIsSavingPayment(true);
    
    // Construct transaction metadata payload
    const previousBalanceUsd = debtDetails.currentDebtUsd;
    const currentBalanceUsd = Math.max(0, previousBalanceUsd - amountUsd);

    const metaPayload = {
      type: 'cxc_payment',
      client: {
        name: selectedClient.name,
        docType: selectedClient.docType,
        docNumber: selectedClient.docNumber,
        phone: selectedClient.phone,
        notes: selectedClient.notes
      },
      paymentReference: finalReference,
      adjustedTotalUsd: amountUsd,
      adjustedTotalBs: amountBs,
      paymentDetails: {
        paymentMethod,
        amountPaidUsd: amountUsd,
        amountPaidBs: amountBs,
        bcvRate,
        reference: finalReference,
        previousBalanceUsd,
        currentBalanceUsd
      }
    };

    try {
      const res = await fetch('/api/v1/sales/cxc-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cashierName: 'Caja CXC',
          paymentMethod,
          amountPaid: amountUsd,
          notes: `METADATA_JSON:${JSON.stringify(metaPayload)}`
        })
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Error procesando abono');
      }

      // Success
      setIsPaymentOpen(false);
      fetchSalesAndClients();
    } catch (err: any) {
      setPaymentError(err.message || 'Error procesando el abono en el servidor.');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const selectedClientDebt = selectedClient ? getClientDebtDetails(selectedClient) : null;

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Coins className="w-7 h-7 text-blue-600" />
            <span>Gestión de Cuentas por Cobrar (Fiados)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Realice seguimiento de deudores, abonos, pagos parciales y consulte el historial de movimientos de crédito comercial.
          </p>
        </div>
        
        {/* Statistics highlights */}
        <div className="flex gap-2 sm:gap-3 bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs shrink-0 self-stretch sm:self-auto justify-around flex-wrap sm:flex-nowrap">
          <div className="px-3 border-r border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Deudores Activos</span>
            <strong className="text-slate-800 text-sm font-black font-mono">
              {deudoresList.filter(d => d.currentDebtUsd > 0.01).length}
            </strong>
          </div>
          <div className="px-3 border-r border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Ventas a Crédito</span>
            <strong className="text-indigo-700 text-sm font-black font-mono">
              ${deudoresList.reduce((acc, d) => acc + d.totalCreditUsd, 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>
          <div className="px-3 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Lo que queda por cobrar</span>
            <strong className="text-blue-700 text-sm font-black font-mono">
              ${deudoresList.reduce((acc, d) => acc + d.currentDebtUsd, 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Tabs Selection (Only shown when not inside client profile detail) */}
      {!selectedClient && (
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('deudores')}
            className={`px-5 py-3 text-xs font-black tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
              activeTab === 'deudores'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Directorio de Deudores
          </button>
          <button
            onClick={() => setActiveTab('pagos')}
            className={`px-5 py-3 text-xs font-black tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
              activeTab === 'pagos'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Historial de Abonos / Pagos
          </button>
        </div>
      )}

      {/* CLIENT PROFILE DETAIL VIEW */}
      {selectedClient && selectedClientDebt && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Back button */}
          <button
            onClick={() => setSelectedClient(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Volver al Directorio</span>
          </button>

          {/* Profile Card & Balance Detail */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* Avatar & Basic Info (8 cols) */}
            <div className="md:col-span-8 flex items-start gap-4">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(selectedClient.name)} flex items-center justify-center text-xl shrink-0 font-black shadow-md`}>
                {selectedClient.name.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-black text-slate-900">{selectedClient.name}</h2>
                  <span className="text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded">
                    {selectedClient.docType}-{selectedClient.docNumber}
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-mono flex flex-wrap gap-x-4 gap-y-1">
                  {selectedClient.phone && <span>Teléfono: <strong>{selectedClient.phone}</strong></span>}
                  <span>Miembro desde: <strong>{new Date(selectedClient.createdAt).toLocaleDateString('es-VE')}</strong></span>
                </div>
                {selectedClient.notes && (
                  <p className="text-[11px] text-slate-500 italic">Dirección/Notas: {selectedClient.notes}</p>
                )}
              </div>
            </div>

            {/* Debt highlights and payment action (4 cols) */}
            <div className="md:col-span-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-3 shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Saldo Pendiente</span>
                <div className="text-3xl font-black font-mono text-red-600 leading-tight mt-0.5">
                  ${selectedClientDebt.currentDebtUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] font-mono font-semibold text-slate-500">
                  ≈ Bs. {selectedClientDebt.currentDebtBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {selectedClientDebt.currentDebtUsd > 0.01 ? (
                <button
                  onClick={handleOpenPayment}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs cursor-pointer shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Coins className="w-4 h-4" />
                  <span>Abonar o Pagar Deuda</span>
                </button>
              ) : (
                <div className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl py-2 px-3 text-xs font-bold inline-flex items-center gap-1.5 mx-auto">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>¡Cuenta Solvente!</span>
                </div>
              )}
            </div>
          </div>

          {/* Sales List and payments records */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Credit sales table (8 cols) */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4.5 h-4.5 text-slate-500" />
                <span>Ventas a Crédito</span>
              </h3>

              {selectedClientDebt.creditSales.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No se registran compras a crédito.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">Folio / Nota</th>
                        <th className="px-3 py-2.5">Fecha</th>
                        <th className="px-3 py-2.5">Cajero</th>
                        <th className="px-3 py-2.5 text-right">Tasa</th>
                        <th className="px-3 py-2.5 text-right font-black text-slate-900">Total Venta</th>
                        <th className="px-3 py-2.5 text-right font-black text-red-600">Monto Crédito</th>
                        <th className="px-3 py-2.5 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedClientDebt.creditSales.map((s) => {
                        const meta = parseSaleMeta(s.notes);
                        const creditAmount = getCreditAmountForSale(s, selectedClient.docNumber);
                        return (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="px-3 py-3 font-mono font-bold text-blue-700">
                              {s.invoiceNumber}
                            </td>
                            <td className="px-3 py-3 font-mono">
                              {new Date(s.createdAt).toLocaleDateString('es-VE')}
                            </td>
                            <td className="px-3 py-3 font-medium">
                              {s.cashierName}
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-slate-500">
                              Bs. {bcvRate.toFixed(2)}
                            </td>
                            <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                              ${s.total.toFixed(2)}
                            </td>
                            <td className="px-3 py-3 text-right font-mono font-black text-red-600">
                              ${creditAmount.toFixed(2)}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button
                                onClick={() => setSelectedSale(s)}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-0.5"
                              >
                                <span>Ver Nota</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payments/Abonos logs (4 cols) */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                <span>Historial de Abonos</span>
              </h3>

              {selectedClientDebt.payments.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No se registran abonos en esta cuenta.
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {selectedClientDebt.payments.map((p) => {
                    const meta = parseSaleMeta(p.notes);
                    const pDetails = meta.paymentDetails;
                    return (
                      <div key={p.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-[11px] font-mono border-b border-slate-200/60 pb-1.5">
                          <span className="font-bold text-blue-700">{p.invoiceNumber}</span>
                          <span className="text-slate-500">{new Date(p.createdAt).toLocaleDateString('es-VE')}</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold block">Abonado</span>
                            <div className="text-sm font-black font-mono text-emerald-700">
                              ${p.total.toFixed(2)} USD
                            </div>
                            <div className="text-[9px] font-mono text-slate-500">
                              Bs. {(p.total * (pDetails?.bcvRate || bcvRate)).toFixed(2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 font-bold block">Método</span>
                            <div className="inline-flex items-center gap-1 mt-0.5 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-700">
                              <PaymentMethodLogo method={p.paymentMethod as any} size="sm" />
                              <span>
                                {p.paymentMethod === 'PAGO_MOVIL' ? 'Pago Móvil' :
                                 p.paymentMethod === 'DEBIT_CARD' ? 'Tarjeta Débito' :
                                 p.paymentMethod === 'CASH_USD' ? 'Efectivo $' :
                                 p.paymentMethod === 'CASH_BS' ? 'Efectivo Bs' : p.paymentMethod}
                              </span>
                            </div>
                          </div>
                        </div>
                        {pDetails && (
                          <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-200/60 text-[9px] text-slate-500 font-mono">
                            <div>Ant.: <span className="font-bold">${pDetails.previousBalanceUsd.toFixed(2)}</span></div>
                            <div className="text-right">Act.: <span className="font-bold text-slate-800">${pDetails.currentBalanceUsd.toFixed(2)}</span></div>
                          </div>
                        )}
                        {meta.reference && (
                          <div className="text-[9px] text-slate-500 font-mono bg-white p-1.5 rounded border border-slate-200 break-all leading-tight">
                            {meta.reference}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* DEBTORS DIRECTORY TAB */}
      {activeTab === 'deudores' && !selectedClient && (
        <div className="space-y-4 animate-fade-in">
          
          {/* Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            
            {/* Search */}
            <div className="md:col-span-6 relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar deudor por nombre o cédula/RIF..."
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="md:col-span-4 relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <SlidersHorizontal className="w-4 h-4" />
              </span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl pl-9 pr-8 py-2.5 text-xs text-slate-800 font-medium focus:outline-none appearance-none cursor-pointer"
              >
                <option value="debt_desc">Ordenar por deuda (Mayor a Menor)</option>
                <option value="debt_asc">Ordenar por deuda (Menor a Mayor)</option>
                <option value="name_asc">Nombre (A - Z)</option>
                <option value="name_desc">Nombre (Z - A)</option>
              </select>
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 pointer-events-none">
                <ChevronDown className="w-4 h-4" />
              </span>
            </div>

            {/* Refresh Button */}
            <div className="md:col-span-2">
              <button
                onClick={fetchSalesAndClients}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sincronizar</span>
              </button>
            </div>
          </div>

          {/* Status Filter Chips */}
          <div className="flex flex-wrap gap-2 pt-2 pb-1">
            <button
              onClick={() => setDebtFilter('ALL')}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border transition-all flex items-center gap-1.5 ${
                debtFilter === 'ALL'
                  ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>Todos</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${debtFilter === 'ALL' ? 'bg-slate-700 text-slate-100' : 'bg-slate-100 text-slate-600'}`}>
                {deudoresList.length}
              </span>
            </button>

            <button
              onClick={() => setDebtFilter('DEBTORS')}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border transition-all flex items-center gap-1.5 ${
                debtFilter === 'DEBTORS'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>Con Deudas</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${debtFilter === 'DEBTORS' ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-600'}`}>
                {deudoresList.filter(d => d.currentDebtUsd > 0.01).length}
              </span>
            </button>

            <button
              onClick={() => setDebtFilter('SOLVENT')}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border transition-all flex items-center gap-1.5 ${
                debtFilter === 'SOLVENT'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>Solventes</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${debtFilter === 'SOLVENT' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-600'}`}>
                {deudoresList.filter(d => d.currentDebtUsd <= 0.01).length}
              </span>
            </button>

            <button
              onClick={() => setDebtFilter('VENCIDOS')}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border transition-all flex items-center gap-1.5 ${
                debtFilter === 'VENCIDOS'
                  ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-200 animate-pulse"></span>
                <span>Vencidos</span>
              </span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${debtFilter === 'VENCIDOS' ? 'bg-rose-800 text-rose-100' : 'bg-slate-100 text-slate-600'}`}>
                {deudoresList.filter(d => d.statusDetails.status === 'VENCIDO' || d.statusDetails.status === 'MORADO').length}
              </span>
            </button>

            <button
              onClick={() => setDebtFilter('PRONTO_A_VENCER')}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border transition-all flex items-center gap-1.5 ${
                debtFilter === 'PRONTO_A_VENCER'
                  ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>Pronto a Vencer</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${debtFilter === 'PRONTO_A_VENCER' ? 'bg-amber-700 text-amber-100' : 'bg-slate-100 text-slate-600'}`}>
                {deudoresList.filter(d => d.statusDetails.status === 'PRONTO_A_VENCER').length}
              </span>
            </button>

            <button
              onClick={() => setDebtFilter('MORADO')}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border transition-all flex items-center gap-1.5 ${
                debtFilter === 'MORADO'
                  ? 'bg-fuchsia-600 border-fuchsia-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>Cobranza Externa</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${debtFilter === 'MORADO' ? 'bg-fuchsia-800 text-fuchsia-100' : 'bg-slate-100 text-slate-600'}`}>
                {deudoresList.filter(d => d.statusDetails.status === 'MORADO').length}
              </span>
            </button>
          </div>

          {/* Debtors list */}
          {isLoading ? (
            <div className="py-24 text-center text-xs text-slate-500 font-medium">
              Cargando directorio de deudores...
            </div>
          ) : filteredDeudores.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <User className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No se encontraron clientes con deudas registradas</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Los clientes que compren con el método de pago a crédito aparecerán listados aquí para gestionar sus cobros.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDeudores.map((item) => {
                const hasDebt = item.currentDebtUsd > 0.01;
                return (
                  <div
                    key={item.client.id}
                    onClick={() => setSelectedClient(item.client)}
                    className="group bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md rounded-2xl p-5 transition-all cursor-pointer flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Avatar with random icon based on name hash */}
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${getAvatarGradient(item.client.name)} flex items-center justify-center text-xs font-black shadow-sm shrink-0 group-hover:scale-105 transition-transform`}>
                          {renderAvatarIcon(item.client.name)}
                        </div>
                        <div className="space-y-0.5 overflow-hidden">
                          <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm truncate" title={item.client.name}>
                            {item.client.name}
                          </h3>
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded inline-block">
                            {item.client.docType}-{item.client.docNumber}
                          </span>
                          {item.client.phone && (
                            <div className="text-[10px] text-slate-500 font-mono truncate">{item.client.phone}</div>
                          )}
                        </div>
                      </div>

                      {/* Status badge in top right */}
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-bold border shrink-0 text-center ${item.statusDetails.colorClass}`}>
                        {item.statusDetails.label}
                      </span>
                    </div>

                    {/* Credit Limit & Terms info if configured */}
                    {(item.client.creditLimit || item.client.paymentDayOfMonth) && (
                      <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-2.5 text-[10px] space-y-1">
                        {item.client.creditLimit ? (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Límite de Crédito:</span>
                            <span className="font-bold text-slate-700">${item.client.creditLimit.toFixed(2)}</span>
                          </div>
                        ) : null}
                        {item.client.paymentDayOfMonth ? (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Día de Pago:</span>
                            <span className="font-bold text-blue-700">Día {item.client.paymentDayOfMonth} de cada mes</span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Deuda Pendiente</span>
                        <div className={`font-mono font-black text-sm ${hasDebt ? 'text-red-600' : 'text-emerald-700'}`}>
                          {hasDebt ? `$${item.currentDebtUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Solvente'}
                        </div>
                        {hasDebt && (
                          <div className="text-[9px] font-mono text-slate-400">
                            Bs. {item.currentDebtBs.toLocaleString('es-VE', { maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                      
                      <div className="p-1.5 rounded-lg bg-slate-50 group-hover:bg-blue-50 text-slate-400 group-hover:text-blue-600 transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ALL PAYMENTS HISTORY TAB */}
      {activeTab === 'pagos' && !selectedClient && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs animate-fade-in">
          
          <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
              <span>Libro Mayor de Pagos y Abonos Recibidos</span>
            </h3>
            <button
              onClick={fetchSalesAndClients}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
            >
              Actualizar
            </button>
          </div>

          {isLoading ? (
            <div className="py-24 text-center text-xs text-slate-500 font-medium">
              Cargando pagos...
            </div>
          ) : paymentsHistoryList.length === 0 ? (
            <div className="py-24 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No se registran abonos en el sistema todavía</p>
              <p className="text-xs text-slate-400">Cuando procese cobros de clientes deudores aparecerán listados en esta sección.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Referencia / ABO</th>
                    <th className="px-4 py-3">Fecha y Hora</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Método de Pago</th>
                    <th className="px-4 py-3 text-right font-black text-emerald-700">Monto USD</th>
                    <th className="px-4 py-3 text-right font-black text-emerald-700">Monto VES</th>
                    <th className="px-4 py-3 text-right">Tasa BCV</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500">Saldo Anterior</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-800">Saldo Nuevo</th>
                    <th className="px-4 py-3">Información de Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentsHistoryList.map(({ sale, meta }) => {
                    const pDetails = meta.paymentDetails || {};
                    const displayUsd = meta.adjustedTotalUsd !== null ? meta.adjustedTotalUsd : sale.total;
                    const displayBs = meta.adjustedTotalBs !== null ? meta.adjustedTotalBs : (sale.total * (pDetails.bcvRate || bcvRate));
                    return (
                      <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-bold text-blue-700">
                          {sale.invoiceNumber}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-500">
                          {new Date(sale.createdAt).toLocaleString('es-VE')}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900">{meta.clientName}</div>
                          {meta.docNumber && <div className="text-[9px] text-slate-400 font-mono">{meta.docType}-{meta.docNumber}</div>}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <PaymentMethodLogo method={sale.paymentMethod as any} size="sm" />
                            <span className="font-medium text-slate-700">
                              {sale.paymentMethod === 'PAGO_MOVIL' ? 'Pago Móvil' :
                               sale.paymentMethod === 'DEBIT_CARD' ? 'Tarjeta Débito' :
                               sale.paymentMethod === 'CASH_USD' ? 'Efectivo $' :
                               sale.paymentMethod === 'CASH_BS' ? 'Efectivo Bs' : sale.paymentMethod}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-black text-emerald-700">
                          ${displayUsd.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-black text-emerald-700">
                          Bs. {displayBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-400">
                          Bs. {(pDetails.bcvRate || bcvRate).toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-500">
                          {pDetails.previousBalanceUsd !== undefined ? `$${pDetails.previousBalanceUsd.toFixed(2)}` : 'N/A'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800">
                          {pDetails.currentBalanceUsd !== undefined ? `$${pDetails.currentBalanceUsd.toFixed(2)}` : 'N/A'}
                        </td>
                        <td className="px-4 py-3.5 max-w-[200px] truncate font-mono text-[10px] text-slate-500" title={meta.reference}>
                          {meta.reference || 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* QUICK RECEIPT MODAL */}
      {selectedSale && (() => {
        const meta = parseSaleMeta(selectedSale.notes);
        const displayTotalUsd = meta.adjustedTotalUsd !== null ? meta.adjustedTotalUsd : selectedSale.total;
        const displayTotalBs = meta.adjustedTotalBs !== null ? meta.adjustedTotalBs : (selectedSale.total * bcvRate);

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="text-center pb-3 border-b border-slate-100">
                <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-600">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Resumen de Nota de Entrega</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {selectedSale.invoiceNumber}
                </p>
              </div>

              {/* Receipt Ticket Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-800 space-y-2 select-all">
                <div className="text-center pb-2 border-b border-dashed border-slate-300 space-y-0.5">
                  <div className="font-bold text-sm text-slate-900 tracking-wider">NUBLY APP POS</div>
                  <div>Cajero: {selectedSale.cashierName || 'Caja 1 - Principal'}</div>
                  <div>Fecha: {new Date(selectedSale.createdAt).toLocaleString('es-VE')}</div>
                  {meta.docNumber ? (
                    <>
                      <div className="font-bold text-slate-950 mt-1">Cliente: {meta.clientName}</div>
                      <div>RIF/Cédula: {meta.docType}-{meta.docNumber}</div>
                      {meta.clientPhone && <div>Teléfono: {meta.clientPhone}</div>}
                    </>
                  ) : (
                    <div>Cliente: Contado / Cliente General</div>
                  )}
                </div>

                {/* Items */}
                <div className="py-1 border-b border-dashed border-slate-300 space-y-2 max-h-40 overflow-y-auto">
                  {(selectedSale.items || []).length === 0 ? (
                    <div className="py-2 text-center text-[10px] text-slate-500 italic">
                      Venta global a crédito o ajuste financiero.
                    </div>
                  ) : (
                    (selectedSale.items || []).map((item) => {
                      const itemBs = item.subtotal * bcvRate;
                      return (
                        <div key={item.id} className="space-y-0.5">
                          <div className="flex justify-between font-semibold">
                            <span>{item.quantity}x {item.productName}</span>
                            <span>${item.subtotal.toFixed(2)}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 pl-3">
                            SKU: {item.productBarcode || 'N/A'} | Bs. {itemBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Subtotal & BCV Rate */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between">
                    <span>Subtotal Original:</span>
                    <span>${selectedSale.total.toFixed(2)} USD</span>
                  </div>
                  {meta.discount && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Descuento ({meta.discount.description}):</span>
                      <span>-{meta.discount.type === 'USD' ? `$${meta.discount.amount.toFixed(2)}` : `Bs. ${meta.discount.amount.toFixed(2)}`}</span>
                    </div>
                  )}
                  {meta.charge && (
                    <div className="flex justify-between text-amber-600 font-bold">
                      <span>Cargo Extra ({meta.charge.description}):</span>
                      <span>+{meta.charge.type === 'USD' ? `$${meta.charge.amount.toFixed(2)}` : `Bs. ${meta.charge.amount.toFixed(2)}`}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Tasa BCV Aplicada:</span>
                    <span>Bs. {bcvRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/USD</span>
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t border-dashed border-slate-300 pt-2 space-y-1.5 font-bold">
                  <div className="flex justify-between text-slate-900">
                    <span>TOTAL EN DÓLARES:</span>
                    <span>${displayTotalUsd.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between text-blue-700">
                    <span>TOTAL EN BOLÍVARES:</span>
                    <span>Bs. {displayTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 font-mono">
                  <div className="font-bold text-slate-900">MÉTODOS DE PAGO:</div>
                  <div className="pl-2 space-y-1">
                    <div className="flex justify-between font-medium">
                      <span>• {selectedSale.paymentMethod === 'DEBIT_CARD' ? 'Tarjeta Débito (Punto)' :
                               selectedSale.paymentMethod === 'PAGO_MOVIL' ? 'Pago Móvil (Bs)' :
                               selectedSale.paymentMethod === 'CASH_USD' ? 'Efectivo USD ($)' :
                               selectedSale.paymentMethod === 'CASH_BS' ? 'Efectivo Bolívares (Bs)' :
                               selectedSale.paymentMethod === 'BINANCE' ? 'Binance Pay' :
                               selectedSale.paymentMethod === 'CREDIT' ? 'Crédito' :
                               selectedSale.paymentMethod === 'SPLIT' ? 'Pago Mixto' :
                               selectedSale.paymentMethod}:</span>
                      <span>${displayTotalUsd.toFixed(2)} USD</span>
                    </div>
                    {meta.reference && (
                      <div className="text-[10px] text-slate-500 font-bold pl-3 break-all leading-normal">
                        ({meta.reference})
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir (F2)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSale(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors cursor-pointer shadow-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* REGISTRAR ABONO / COBRO WIZARD MODAL */}
      {isPaymentOpen && selectedClient && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 p-5 shrink-0 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-5 h-5 text-blue-600 animate-pulse" />
                  <span>Registrar Abono - {selectedClient.name}</span>
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Ingrese el monto y el método de pago para amortizar el saldo deudor.
                </p>
              </div>
              <button
                onClick={() => setIsPaymentOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error banner inside wizard */}
            {paymentError && (
              <div className="bg-rose-50 border-y border-rose-200 px-5 py-3 text-xs text-rose-800 flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">{paymentError}</span>
              </div>
            )}

            {/* Modal Body / Scrollable */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              
              {/* Balances Highlight */}
              <div className="bg-indigo-50 border border-indigo-150 p-4 rounded-xl flex items-center justify-between text-xs text-indigo-950 font-mono">
                <div>
                  <span className="font-semibold text-[10px] text-indigo-700 uppercase block">Total Adeudado</span>
                  <strong className="text-xl font-black text-indigo-900">${getClientDebtDetails(selectedClient).currentDebtUsd.toFixed(2)}</strong>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-[10px] text-indigo-700 uppercase block">Deuda en Bs. (Tasa {bcvRate.toFixed(2)})</span>
                  <strong className="text-lg font-black text-indigo-950">Bs. {(getClientDebtDetails(selectedClient).currentDebtUsd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>

              {/* STEP 1: AMOUNT SELECTION */}
              {paymentStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-800 block">
                      Seleccione la Moneda del Abono:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentCurrency('USD')}
                        className={`py-3.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
                          paymentCurrency === 'USD'
                            ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>Abonar en Dólares ($)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentCurrency('BS')}
                        className={`py-3.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
                          paymentCurrency === 'BS'
                            ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Banknote className="w-4 h-4" />
                        <span>Abonar en Bolívares (Bs.)</span>
                      </button>
                    </div>
                  </div>

                  {/* Amount Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Monto en Dólares ($ USD):
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold font-mono">$</span>
                        <input
                          type="number"
                          step="0.01"
                          disabled={paymentCurrency !== 'USD'}
                          value={paymentAmountUsd}
                          onChange={(e) => handlePaymentAmountChange(e.target.value, 'USD')}
                          className="w-full bg-slate-50 border border-slate-300 disabled:opacity-75 focus:border-blue-600 rounded-xl pl-9 pr-4 py-2.5 font-mono font-bold text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Monto en Bolívares (Bs. VES):
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold font-mono">Bs.</span>
                        <input
                          type="number"
                          step="0.01"
                          disabled={paymentCurrency !== 'BS'}
                          value={paymentAmountBs}
                          onChange={(e) => handlePaymentAmountChange(e.target.value, 'BS')}
                          className="w-full bg-slate-50 border border-slate-300 disabled:opacity-75 focus:border-blue-600 rounded-xl pl-12 pr-4 py-2.5 font-mono font-bold text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preset amounts shortcuts */}
                  <div className="space-y-1.5 pt-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Montos Rápidos (USD):</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {[5, 10, 20, 50, 100].map((amt) => {
                        const currentDebt = getClientDebtDetails(selectedClient).currentDebtUsd;
                        if (amt > currentDebt) return null;
                        return (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => handlePaymentAmountChange(amt.toString(), 'USD')}
                            className="py-1.5 px-3.5 text-xs font-mono font-bold rounded-lg bg-slate-150 hover:bg-blue-50 border border-slate-200 text-slate-700 cursor-pointer"
                          >
                            ${amt}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          const currentDebt = getClientDebtDetails(selectedClient).currentDebtUsd;
                          handlePaymentAmountChange(currentDebt.toString(), 'USD');
                        }}
                        className="py-1.5 px-3.5 text-xs font-bold rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 cursor-pointer ml-auto"
                      >
                        Pagar Deuda Total
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: METHOD SELECTION AND EXTRA DETAILS */}
              {paymentStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-800 block">
                      Seleccione el Método de Pago / Recibo:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('PAGO_MOVIL')}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          paymentMethod === 'PAGO_MOVIL'
                            ? 'bg-blue-50 border-blue-600 text-blue-700'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Smartphone className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Pago Móvil (Bs)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('DEBIT_CARD')}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          paymentMethod === 'DEBIT_CARD'
                            ? 'bg-blue-50 border-blue-600 text-blue-700'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <CreditCard className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Tarjeta Débito (POS)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('CASH_USD')}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          paymentMethod === 'CASH_USD'
                            ? 'bg-blue-50 border-blue-600 text-blue-700'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <DollarSign className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Efectivo USD ($)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('CASH_BS')}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          paymentMethod === 'CASH_BS'
                            ? 'bg-blue-50 border-blue-600 text-blue-700'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Banknote className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Efectivo Bs (Bolívares)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('BINANCE')}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          paymentMethod === 'BINANCE'
                            ? 'bg-blue-50 border-blue-600 text-blue-700'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <QrCode className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Binance Pay</span>
                      </button>
                    </div>
                  </div>

                  {/* Payment method specific form fields */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    
                    {/* Method details: PAGO_MOVIL */}
                    {paymentMethod === 'PAGO_MOVIL' && (
                      <div className="space-y-3">
                        {posConfig.pagoMovilBankName && (
                          <div className="text-[10px] font-mono text-blue-800 bg-blue-50 p-2.5 rounded-lg border border-blue-150 mb-1 space-y-0.5">
                            <span className="font-bold block">Destinatario / Pago Móvil Comercio:</span>
                            <div>Banco: <strong>{posConfig.pagoMovilBankName}</strong> | Tel: <strong>{posConfig.pagoMovilPhone}</strong> | RIF: <strong>{posConfig.pagoMovilRif}</strong></div>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              Banco Emisor {posConfig.pagoMovilShowBank && '(Recomendado)'}:
                            </label>
                            <select
                              value={pmBank}
                              onChange={(e) => setPmBank(e.target.value)}
                              className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 text-xs focus:outline-none"
                            >
                              <option value="">-- Seleccionar Banco --</option>
                              <option value="Banesco">Banesco (0134)</option>
                              <option value="Banco de Venezuela">Banco de Venezuela (0102)</option>
                              <option value="Mercantil">Mercantil (0105)</option>
                              <option value="Provincial">BBVA Provincial (0108)</option>
                              <option value="BOD">BOD (0116)</option>
                              <option value="BNC">BNC (0191)</option>
                              <option value="Bancaribe">Bancaribe (0114)</option>
                              <option value="Banplus">Banplus (0174)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              Tipo de Cuenta:
                            </label>
                            <div className="grid grid-cols-2 gap-2 bg-white border border-slate-300 p-0.5 rounded-xl">
                              <button
                                type="button"
                                onClick={() => setPmAccount('PERSONAL')}
                                className={`py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  pmAccount === 'PERSONAL' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                Personal
                              </button>
                              <button
                                type="button"
                                onClick={() => setPmAccount('JURIDICA')}
                                className={`py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  pmAccount === 'JURIDICA' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                Jurídica
                              </button>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            Número de Referencia de Pago Móvil {posConfig.pagoMovilRefRequired ? <span className="text-rose-500">* (Obligatorio)</span> : '(Opcional)'}:
                          </label>
                          <input
                            type="text"
                            required={posConfig.pagoMovilRefRequired}
                            value={pmReference}
                            onChange={(e) => setPmReference(e.target.value)}
                            placeholder="Últimos 4 o 6 dígitos del comprobante"
                            className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Method details: DEBIT_CARD */}
                    {paymentMethod === 'DEBIT_CARD' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          Código de Aprobación o Lote POS {posConfig.debitCardRefRequired ? <span className="text-rose-500">* (Obligatorio)</span> : '(Opcional)'}:
                        </label>
                        <input
                          type="text"
                          required={posConfig.debitCardRefRequired}
                          value={debitReference}
                          onChange={(e) => setDebitReference(e.target.value)}
                          placeholder="Ej: 084920"
                          className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Method details: CASH_USD */}
                    {paymentMethod === 'CASH_USD' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              Monto de Billete Recibido ($):
                            </label>
                            <input
                              type="number"
                              step="1"
                              value={cashUsdReceived}
                              onChange={(e) => setCashUsdReceived(e.target.value)}
                              placeholder={paymentAmountUsd}
                              className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              Cambio / Vuelto ($ USD):
                            </label>
                            <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-800 text-center h-[34px] flex items-center justify-center">
                              {(() => {
                                const amountUsd = parseFloat(paymentAmountUsd) || 0;
                                const rec = parseFloat(cashUsdReceived) || amountUsd;
                                const change = Math.max(0, rec - amountUsd);
                                return `$ ${change.toFixed(2)} USD`;
                              })()}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            Referencia / Observaciones de Billetes (Opcional):
                          </label>
                          <input
                            type="text"
                            value={cashUsdRef}
                            onChange={(e) => setCashUsdRef(e.target.value)}
                            placeholder="Comentario o seriales de control"
                            className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Method details: CASH_BS */}
                    {paymentMethod === 'CASH_BS' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              Efectivo Recibido (Bs.):
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={cashBsReceived}
                              onChange={(e) => setCashBsReceived(e.target.value)}
                              placeholder={paymentAmountBs}
                              className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              Cambio / Vuelto (Bs.):
                            </label>
                            <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-800 text-center h-[34px] flex items-center justify-center">
                              {(() => {
                                const amountBs = parseFloat(paymentAmountBs) || 0;
                                const rec = parseFloat(cashBsReceived) || amountBs;
                                const change = Math.max(0, rec - amountBs);
                                return `Bs. ${change.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
                              })()}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-1">
                            Referencia o Control de Caja (Opcional):
                          </label>
                          <input
                            type="text"
                            value={cashBsRef}
                            onChange={(e) => setCashBsRef(e.target.value)}
                            placeholder="Comentario o número de bolsa"
                            className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Method details: BINANCE */}
                    {paymentMethod === 'BINANCE' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          ID de Transacción Binance Pay {posConfig.binanceRefRequired ? <span className="text-rose-500">* (Obligatorio)</span> : '(Opcional)'}:
                        </label>
                        <input
                          type="text"
                          required={posConfig.binanceRefRequired}
                          value={binanceRef}
                          onChange={(e) => setBinanceRef(e.target.value)}
                          placeholder="Ej: 948210392"
                          className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 focus:outline-none"
                        />
                      </div>
                    )}

                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-5 shrink-0 flex justify-between">
              {paymentStep === 2 ? (
                <button
                  type="button"
                  onClick={() => setPaymentStep(1)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
                >
                  Regresar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
              )}

              {paymentStep === 1 ? (
                <button
                  type="button"
                  onClick={handleNextStepPayment}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs cursor-pointer shadow-md shadow-blue-500/20 flex items-center gap-1 transition-colors"
                >
                  <span>Siguiente paso</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSavingPayment}
                  onClick={handleConfirmPayment}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 active:bg-emerald-800 text-white font-black text-xs cursor-pointer shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-colors"
                >
                  {isSavingPayment ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Abono</span>
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
