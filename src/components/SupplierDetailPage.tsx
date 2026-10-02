import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Coins, 
  FileText, 
  Receipt, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  Plus, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Check, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Tag, 
  ExternalLink,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { 
  Supplier, 
  PurchaseReceipt, 
  PurchaseReceiptItem, 
  SupplierCreditNote, 
  SupplierCreditNoteItem, 
  SupplierGeneralPayment, 
  Product 
} from '../types';
import { 
  amortizeSupplierBalance, 
  crossCreditNoteWithReceipts, 
  saveNewCreditNote, 
  saveOrUpdateSupplier 
} from '../utils/cxpHelper';
import { safeFetchJson } from '../utils/api';

interface SupplierDetailPageProps {
  supplier: Supplier;
  receipts: PurchaseReceipt[];
  creditNotes: SupplierCreditNote[];
  generalPayments: SupplierGeneralPayment[];
  bcvRate: number;
  products: Product[];
  onBack: () => void;
  onRefreshData: () => void;
  showToast: (msg: string) => void;
}

export function SupplierDetailPage({
  supplier,
  receipts,
  creditNotes,
  generalPayments,
  bcvRate,
  products,
  onBack,
  onRefreshData,
  showToast
}: SupplierDetailPageProps) {
  // Filter receipts for this supplier
  const supplierReceipts = useMemo(() => {
    return receipts
      .filter((r) => r.supplierId === supplier.id || r.supplierRif === supplier.rif)
      .sort((a, b) => new Date(b.receivedAt || b.createdAt).getTime() - new Date(a.receivedAt || a.createdAt).getTime());
  }, [receipts, supplier]);

  // Filter credit notes for this supplier
  const supplierCreditNotes = useMemo(() => {
    return creditNotes
      .filter((n) => n.supplierId === supplier.id || n.supplierRif === supplier.rif)
      .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  }, [creditNotes, supplier]);

  // Filter general payments for this supplier
  const supplierPayments = useMemo(() => {
    return generalPayments
      .filter((p) => p.supplierId === supplier.id || p.supplierRif === supplier.rif)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [generalPayments, supplier]);

  // Financial aggregates
  const metrics = useMemo(() => {
    let totalPurchasedUsd = 0;
    let totalPaidFromReceiptsUsd = 0;
    let totalRemainingDebtUsd = 0;

    for (const r of supplierReceipts) {
      totalPurchasedUsd += r.totalCost;
      totalPaidFromReceiptsUsd += r.paidAmountUsd;
      if (r.status === 'PENDIENTE') {
        totalRemainingDebtUsd += r.remainingBalanceUsd;
      }
    }

    const availableCreditsUsd = supplierCreditNotes
      .filter((n) => n.status === 'DISPONIBLE' || n.status === 'PARCIAL')
      .reduce((acc, n) => acc + n.remainingBalanceUsd, 0);

    return {
      totalPurchasedUsd,
      totalPaidUsd: totalPaidFromReceiptsUsd,
      totalRemainingDebtUsd,
      availableCreditsUsd
    };
  }, [supplierReceipts, supplierCreditNotes]);

  // Expanded items state in receipts list
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [selectedReceiptForModal, setSelectedReceiptForModal] = useState<PurchaseReceipt | null>(null);

  // =========================================================
  // MODAL 1: ABONAR / PAGAR AL SALDO PENDIENTE (GLOBAL AMORTIZATION)
  // =========================================================
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoMethod, setAbonoMethod] = useState('TRANSFERENCIA');
  const [abonoReference, setAbonoReference] = useState('');
  const [abonoNotes, setAbonoNotes] = useState('');

  const openAbonoModal = () => {
    setAbonoAmount(metrics.totalRemainingDebtUsd > 0 ? metrics.totalRemainingDebtUsd.toFixed(2) : '0');
    setAbonoReference('');
    setAbonoNotes('');
    setIsAbonoModalOpen(true);
  };

  const handleExecuteAbono = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(abonoAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Debe ingresar un monto válido mayor a 0.');
      return;
    }

    if (amount > metrics.totalRemainingDebtUsd + 0.05) {
      showToast(`El monto no puede superar el saldo pendiente total ($${metrics.totalRemainingDebtUsd.toFixed(2)} USD).`);
      return;
    }

    try {
      const result = amortizeSupplierBalance(supplier.id, amount, {
        paymentMethod: abonoMethod,
        reference: abonoReference.trim() || undefined,
        notes: abonoNotes.trim() || undefined,
        bcvRate
      });

      showToast(`Abono de $${amount.toFixed(2)} USD registrado con éxito amortizando ${result.payment.amortizedReceipts.length} factura(s).`);
      setIsAbonoModalOpen(false);
      onRefreshData();
    } catch (err: any) {
      showToast('Error procesando el abono: ' + (err.message || 'Intente nuevamente.'));
    }
  };

  // =========================================================
  // MODAL 2: EMITIR DEVOLUCIÓN & NOTA DE CRÉDITO A FAVOR
  // =========================================================
  const [isNcModalOpen, setIsNcModalOpen] = useState(false);
  const [ncReceiptId, setNcReceiptId] = useState('');
  const [ncReason, setNcReason] = useState<'DEFECTUOSO' | 'VENCIDO' | 'ERROR_DESPACHO' | 'OTRO'>('DEFECTUOSO');
  const [ncGeneralNotes, setNcGeneralNotes] = useState('');
  const [ncItems, setNcItems] = useState<SupplierCreditNoteItem[]>([]);
  const [discountPhysicalStock, setDiscountPhysicalStock] = useState(true);

  // New item row inputs for NC
  const [ncItemProductName, setNcItemProductName] = useState('');
  const [ncItemBarcode, setNcItemBarcode] = useState('');
  const [ncItemQuantity, setNcItemQuantity] = useState('1');
  const [ncItemUnitCost, setNcItemUnitCost] = useState('');

  const openCreateNcModal = (preselectedReceipt?: PurchaseReceipt) => {
    if (preselectedReceipt) {
      setNcReceiptId(preselectedReceipt.id);
      // Pre-fill first item if available
      if (preselectedReceipt.items.length > 0) {
        const first = preselectedReceipt.items[0];
        setNcItems([
          {
            id: `nc-it-${Date.now()}`,
            productId: first.productId,
            productBarcode: first.productBarcode,
            productName: first.productName,
            quantity: 1,
            unit: first.unit || 'UND',
            unitCost: first.unitCost,
            subtotal: first.unitCost,
            returnReason: 'DEFECTUOSO'
          }
        ]);
      } else {
        setNcItems([]);
      }
    } else {
      setNcReceiptId('');
      setNcItems([]);
    }
    setNcReason('DEFECTUOSO');
    setNcGeneralNotes('');
    setNcItemProductName('');
    setNcItemBarcode('');
    setNcItemQuantity('1');
    setNcItemUnitCost('');
    setIsNcModalOpen(true);
  };

  const handleAddNcItem = () => {
    if (!ncItemProductName.trim()) {
      showToast('Ingrese el nombre del producto devuelto.');
      return;
    }
    const qty = parseFloat(ncItemQuantity);
    const cost = parseFloat(ncItemUnitCost);
    if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) {
      showToast('Ingrese cantidad y costo válidos.');
      return;
    }

    const newItem: SupplierCreditNoteItem = {
      id: `nc-it-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productName: ncItemProductName.trim(),
      productBarcode: ncItemBarcode.trim() || 'DEV-' + Math.floor(100000 + Math.random() * 900000),
      quantity: qty,
      unit: 'UND',
      unitCost: cost,
      subtotal: qty * cost,
      returnReason: ncReason
    };

    setNcItems((prev) => [...prev, newItem]);
    setNcItemProductName('');
    setNcItemBarcode('');
    setNcItemQuantity('1');
    setNcItemUnitCost('');
  };

  const handleRemoveNcItem = (itemId: string) => {
    setNcItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const totalNcAmount = useMemo(() => {
    return ncItems.reduce((acc, it) => acc + it.subtotal, 0);
  }, [ncItems]);

  const handleSaveCreditNote = async () => {
    if (ncItems.length === 0) {
      showToast('Agregue al menos un producto devuelto a la nota de crédito.');
      return;
    }

    const linkedReceipt = supplierReceipts.find((r) => r.id === ncReceiptId);
    const code = `NC-${supplier.rif.slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newNote: SupplierCreditNote = {
      id: `nc-${Date.now()}`,
      code,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierRif: supplier.rif,
      receiptId: linkedReceipt?.id,
      receiptNumber: linkedReceipt?.receiptNumber,
      date: new Date().toISOString(),
      reason: ncReason,
      notes: ncGeneralNotes.trim() || undefined,
      items: ncItems,
      totalAmountUsd: Number(totalNcAmount.toFixed(2)),
      appliedAmountUsd: 0,
      remainingBalanceUsd: Number(totalNcAmount.toFixed(2)),
      status: 'DISPONIBLE',
      appliedToReceipts: [],
      createdAt: new Date().toISOString()
    };

    // If requested, discount returned products from inventory so stock matches physically
    if (discountPhysicalStock) {
      for (const it of ncItems) {
        if (it.productId) {
          try {
            await safeFetchJson('/api/v1/inventory/movement', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: it.productId,
                type: 'RETURN',
                quantity: -it.quantity,
                reason: `Devolución a proveedor ${supplier.name} (${newNote.code})`
              })
            });
          } catch (e) {
            console.warn('Could not record stock movement for return:', e);
          }
        }
      }
    }

    saveNewCreditNote(newNote);
    showToast(`Nota de Crédito a Favor #${newNote.code} por $${newNote.totalAmountUsd.toFixed(2)} USD emitida exitosamente.`);
    setIsNcModalOpen(false);
    onRefreshData();
  };

  // =========================================================
  // MODAL 3: CRUZAR NOTA DE CRÉDITO CON FACTURAS PENDIENTES
  // =========================================================
  const [isCrossModalOpen, setIsCrossModalOpen] = useState(false);
  const [selectedCreditNoteForCross, setSelectedCreditNoteForCross] = useState<SupplierCreditNote | null>(null);
  const [crossAllocations, setCrossAllocations] = useState<{ [receiptId: string]: string }>({});

  const openCrossModal = (note: SupplierCreditNote) => {
    setSelectedCreditNoteForCross(note);
    // Initialize suggested allocations FIFO
    let remainingCredit = note.remainingBalanceUsd;
    const initialAlloc: { [receiptId: string]: string } = {};

    const pending = supplierReceipts.filter((r) => r.status === 'PENDIENTE' && r.remainingBalanceUsd > 0.001);
    for (const rec of pending) {
      if (remainingCredit <= 0.001) {
        initialAlloc[rec.id] = '0';
        continue;
      }
      const toApply = Math.min(rec.remainingBalanceUsd, remainingCredit);
      initialAlloc[rec.id] = toApply.toFixed(2);
      remainingCredit -= toApply;
    }

    setCrossAllocations(initialAlloc);
    setIsCrossModalOpen(true);
  };

  const handleExecuteCrossCreditNote = () => {
    if (!selectedCreditNoteForCross) return;

    const targets: { receiptId: string; amountToApply: number }[] = [];
    let totalAssigned = 0;

    for (const [receiptId, valStr] of Object.entries(crossAllocations)) {
      const val = parseFloat(valStr) || 0;
      if (val > 0) {
        targets.push({ receiptId, amountToApply: val });
        totalAssigned += val;
      }
    }

    if (targets.length === 0) {
      showToast('Seleccione un monto para cruzar con al menos una factura.');
      return;
    }

    if (totalAssigned > selectedCreditNoteForCross.remainingBalanceUsd + 0.01) {
      showToast(`El monto total asignado ($${totalAssigned.toFixed(2)}) supera el saldo disponible de la nota de crédito ($${selectedCreditNoteForCross.remainingBalanceUsd.toFixed(2)}).`);
      return;
    }

    try {
      const res = crossCreditNoteWithReceipts(selectedCreditNoteForCross.id, targets);
      showToast(`Nota de crédito #${res.updatedCreditNote.code} cruzada exitosamente por $${totalAssigned.toFixed(2)} USD.`);
      setIsCrossModalOpen(false);
      setSelectedCreditNoteForCross(null);
      onRefreshData();
    } catch (err: any) {
      showToast('Error cruzando nota de crédito: ' + (err.message || 'Intente nuevamente.'));
    }
  };

  // Helper to prefill item from inventory in NC modal
  const handleSelectProductForNc = (prod: Product) => {
    setNcItemProductName(prod.name);
    setNcItemBarcode(prod.barcode);
    setNcItemUnitCost(prod.cost.toString());
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* TOP NAVIGATION & BACK BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer w-fit shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-purple-600" />
          <span>Volver al Directorio de Proveedores</span>
        </button>

        <div className="flex items-center gap-2">
          {metrics.availableCreditsUsd > 0 && (
            <span className="text-[11px] font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>${metrics.availableCreditsUsd.toFixed(2)} USD a Favor en Notas de Crédito</span>
            </span>
          )}
        </div>
      </div>

      {/* SUPPLIER IDENTITY PROFILE CARD */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center font-black shadow-lg shadow-purple-500/20 shrink-0">
            <Building2 className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {supplier.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-100 text-purple-900 border border-purple-200">
                {supplier.rif}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
              {supplier.phone && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {supplier.phone}
                </span>
              )}
              {supplier.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {supplier.email}
                </span>
              )}
              {supplier.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {supplier.address}
                </span>
              )}
            </div>

            {supplier.notes && (
              <p className="text-xs text-slate-600 italic pt-1 bg-slate-50 p-2 rounded-xl border border-slate-100 mt-2">
                "{supplier.notes}"
              </p>
            )}
          </div>
        </div>

        {/* PRIMARY ACTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openAbonoModal}
            className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Coins className="w-4 h-4" />
            <span>Pagar o Abonar al Saldo Pendiente</span>
          </button>

          <button
            type="button"
            onClick={() => openCreateNcModal()}
            className="px-4 py-3 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 font-extrabold text-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-purple-700" />
            <span>Emitir Devolución / Nota de Crédito</span>
          </button>
        </div>
      </div>

      {/* TOP FINANCIAL METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. Saldo que le debo (Saldo Pendiente) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-rose-800 uppercase tracking-wider">
              Saldo que le Debo
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-700">
            ${metrics.totalRemainingDebtUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <div className="text-xs font-bold font-mono text-slate-500 mt-1">
            ≈ Bs. {(metrics.totalRemainingDebtUsd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">
            Suma global de facturas pendientes de pago
          </p>
        </div>

        {/* 2. Total Compras / Facturas Acumuladas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
              Total Facturado / Recibido
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            ${metrics.totalPurchasedUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <div className="text-xs font-bold font-mono text-slate-500 mt-1">
            {supplierReceipts.length} {supplierReceipts.length === 1 ? 'recibo procesado' : 'recibos procesados'}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">
            Histórico total de compras con este proveedor
          </p>
        </div>

        {/* 3. Total Pagado hasta ahora */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">
              Total Pagado / Abonado
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-700">
            ${metrics.totalPaidUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <div className="text-xs font-bold font-mono text-slate-500 mt-1">
            ≈ Bs. {(metrics.totalPaidUsd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">
            Abonos amortizados y pagos liquidados
          </p>
        </div>

        {/* 4. Notas de Crédito a Favor */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-purple-900 uppercase tracking-wider">
              Notas de Crédito a Favor
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-purple-900">
            ${metrics.availableCreditsUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <div className="text-xs font-bold text-slate-500 mt-1">
            {supplierCreditNotes.filter((n) => n.status === 'DISPONIBLE' || n.status === 'PARCIAL').length} notas activas por cruzar
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">
            Saldo a favor por devoluciones o diferencias
          </p>
        </div>

      </div>

      {/* ========================================================= */}
      {/* SECCIÓN 1: HISTORIAL DE NOTAS Y RECIBOS DEL PROVEEDOR     */}
      {/* ========================================================= */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt className="w-5 h-5 text-purple-600" />
              <span>Historial de Notas de Entrega y Facturas de Compra</span>
            </h2>
            <p className="text-xs text-slate-500">
              Desglose detallado de todos los recibos emitidos por este proveedor con su saldo pendiente y productos ingresados.
            </p>
          </div>

          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 self-start sm:self-auto">
            {supplierReceipts.length} recibos
          </span>
        </div>

        {supplierReceipts.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
            No se han registrado recibos de compra para este proveedor.
          </div>
        ) : (
          <div className="space-y-3">
            {supplierReceipts.map((rec) => {
              const isExpanded = expandedReceiptId === rec.id;
              const isOverdue = rec.status === 'PENDIENTE' && rec.dueDate && new Date(rec.dueDate + 'T23:59:59').getTime() < Date.now();

              return (
                <div 
                  key={rec.id}
                  className={`border rounded-2xl transition-all ${
                    rec.status === 'PENDIENTE' 
                      ? 'border-slate-200 bg-white hover:border-purple-300' 
                      : 'border-slate-200/70 bg-slate-50/50'
                  }`}
                >
                  {/* Summary Bar */}
                  <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                        rec.status === 'PAGADO' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 text-sm">
                            Recibo #{rec.receiptNumber}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            rec.status === 'PAGADO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {rec.status}
                          </span>
                          {isOverdue && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                              Vencido
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5 flex flex-wrap items-center gap-3">
                          <span>Recepción: {new Date(rec.receivedAt || rec.createdAt).toLocaleDateString('es-VE')}</span>
                          <span>•</span>
                          <span>Condición: <strong>{rec.paymentType}</strong> {rec.dueDate ? `(Vence: ${rec.dueDate})` : ''}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono justify-between md:justify-end">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase">Total Recibo</span>
                        <span className="font-black text-slate-900 text-sm">${rec.totalCost.toFixed(2)} USD</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase">Abonado</span>
                        <span className="font-bold text-emerald-700">${rec.paidAmountUsd.toFixed(2)} USD</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase">Saldo Deuda</span>
                        <span className={`font-black text-sm ${rec.remainingBalanceUsd > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                          ${rec.remainingBalanceUsd.toFixed(2)} USD
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 pl-2">
                        <button
                          type="button"
                          onClick={() => setExpandedReceiptId(isExpanded ? null : rec.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Ocultar' : 'Ítems'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => openCreateNcModal(rec)}
                          className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                          title="Devolver mercancía o reportar falla de este recibo"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Devolver</span>
                        </button>
                      </div>

                    </div>

                  </div>

                  {/* Expanded Items Breakdown */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 pt-2">
                        Ítems Recibidos en este Lote:
                      </div>
                      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                              <th className="py-2.5 px-3">Producto</th>
                              <th className="py-2.5 px-3 text-right">Cant. Recibida</th>
                              <th className="py-2.5 px-3 text-right">Costo Unit. ($)</th>
                              <th className="py-2.5 px-3 text-right">Margen (%)</th>
                              <th className="py-2.5 px-3 text-right">Precio Venta ($)</th>
                              <th className="py-2.5 px-3 text-right">Subtotal Costo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {rec.items.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-sans font-bold text-slate-900">
                                  {item.productName}
                                  <span className="block text-[10px] font-mono text-slate-400">{item.productBarcode}</span>
                                </td>
                                <td className="py-2 px-3 text-right font-black text-purple-800">
                                  +{item.quantityReceived} {item.unit}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700">
                                  ${item.unitCost.toFixed(2)}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500">
                                  {item.profitMarginPercent}%
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                  ${item.calculatedSalePrice.toFixed(2)}
                                </td>
                                <td className="py-2 px-3 text-right font-black text-slate-900">
                                  ${item.subtotalCost.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* SECCIÓN 2: HISTORIAL DE PAGOS Y ABONOS AL PROVEEDOR       */}
      {/* ========================================================= */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-600" />
              <span>Historial de Pagos y Abonos Realizados</span>
            </h2>
            <p className="text-xs text-slate-500">
              Registro contable de todas las amortizaciones globales o abonos efectuados a este proveedor.
            </p>
          </div>

          <button
            type="button"
            onClick={openAbonoModal}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Nuevo Abono</span>
          </button>
        </div>

        {supplierPayments.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
            No se han registrado pagos o abonos globales aún para este proveedor.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Método de Pago</th>
                  <th className="py-3 px-4">Referencia</th>
                  <th className="py-3 px-4">Facturas Amortizadas</th>
                  <th className="py-3 px-4">Notas / Concepto</th>
                  <th className="py-3 px-4 text-right">Monto USD</th>
                  <th className="py-3 px-4 text-right">Monto Bs.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {supplierPayments.map((p, idx) => (
                  <tr key={`sup-payment-${p.id || idx}-${idx}`} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-700">
                      {new Date(p.date).toLocaleString('es-VE')}
                    </td>
                    <td className="py-3 px-4 font-sans font-bold text-slate-800">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px]">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-purple-900 font-bold">
                      {p.reference || 'S/R'}
                    </td>
                    <td className="py-3 px-4 font-sans text-xs">
                      {p.amortizedReceipts && p.amortizedReceipts.length > 0 ? (
                        <div className="space-y-0.5">
                          {p.amortizedReceipts.map((ar, idx) => (
                            <span key={idx} className="block text-[11px] text-slate-600">
                              • #{ar.receiptNumber} (${ar.amortizedAmountUsd.toFixed(2)})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">Amortización general</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-500 text-xs">
                      {p.notes || '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                      ${p.amountUsd.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800">
                      Bs. {p.amountBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* SECCIÓN 3: MANEJO DE DEVOLUCIONES Y NOTAS DE CRÉDITO      */}
      {/* ========================================================= */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-purple-600" />
              <span>Manejo de Devoluciones y Notas de Crédito a Favor</span>
            </h2>
            <p className="text-xs text-slate-500">
              Emisión de notas de crédito por mercancía defectuosa, vencida o ajustes de precio. Estas notas se cruzan automáticamente con facturas pendientes para descontar la deuda.
            </p>
          </div>

          <button
            type="button"
            onClick={() => openCreateNcModal()}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Emitir Nota de Crédito</span>
          </button>
        </div>

        {supplierCreditNotes.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
            No hay notas de crédito ni devoluciones registradas para este proveedor.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {supplierCreditNotes.map((note) => {
              const isAvailable = note.status === 'DISPONIBLE' || note.status === 'PARCIAL';

              return (
                <div 
                  key={note.id}
                  className={`border rounded-2xl p-5 space-y-3 transition-all ${
                    isAvailable 
                      ? 'border-purple-300 bg-purple-50/20 shadow-xs' 
                      : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-purple-900 text-sm">
                        {note.code}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        note.status === 'APLICADA'
                          ? 'bg-slate-200 text-slate-700'
                          : note.status === 'PARCIAL'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {note.status === 'DISPONIBLE' ? 'DISPONIBLE A FAVOR' : note.status}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-slate-500">
                      {new Date(note.date).toLocaleDateString('es-VE')}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p className="font-bold text-slate-800">
                      Motivo: <span className="text-purple-900 uppercase">{note.reason}</span>
                      {note.receiptNumber && ` (Asociada al Recibo #${note.receiptNumber})`}
                    </p>
                    {note.notes && <p className="italic text-slate-500">"{note.notes}"</p>}
                  </div>

                  {/* Items summary */}
                  <div className="bg-white border border-slate-200/80 rounded-xl p-3 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Ítems devueltos:
                    </span>
                    {note.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between font-mono text-[11px]">
                        <span>• {it.productName} ({it.quantity} {it.unit})</span>
                        <span className="font-bold text-slate-700">${it.subtotal.toFixed(2)} USD</span>
                      </div>
                    ))}
                  </div>

                  {/* Financial Breakdown of the Credit Note */}
                  <div className="flex items-center justify-between font-mono text-xs pt-1 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Monto Total Nota:</span>
                      <strong className="text-slate-900">${note.totalAmountUsd.toFixed(2)} USD</strong>
                    </div>

                    <div className="text-right">
                      <span className="text-slate-500 text-[10px] block">Saldo Disponible por Cruzar:</span>
                      <strong className="text-emerald-700 text-sm font-black">
                        ${note.remainingBalanceUsd.toFixed(2)} USD
                      </strong>
                    </div>
                  </div>

                  {/* Action to cross credit note */}
                  {isAvailable && (
                    <button
                      type="button"
                      onClick={() => openCrossModal(note)}
                      className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Cruzar con Facturas Pendientes de este Proveedor</span>
                    </button>
                  )}

                  {/* History of applied receipts if any */}
                  {note.appliedToReceipts && note.appliedToReceipts.length > 0 && (
                    <div className="pt-1 text-[11px] text-slate-500 font-mono">
                      <span className="font-bold text-slate-700">Aplicado en: </span>
                      {note.appliedToReceipts.map((a, i) => (
                        <span key={i} className="inline-block mr-2">
                          #{a.receiptNumber} (${a.appliedAmountUsd.toFixed(2)})
                        </span>
                      ))}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: REGISTRAR PAGO / ABONO AL SALDO PENDIENTE        */}
      {/* ========================================================= */}
      {isAbonoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Abonar al Saldo del Proveedor</h3>
                  <p className="text-xs text-slate-500 font-mono">{supplier.name} • {supplier.rif}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAbonoModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteAbono} className="space-y-4">
              
              {/* Saldo actual info */}
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-rose-800 uppercase block">Saldo Total Pendiente:</span>
                  <span className="text-lg font-black font-mono text-rose-950">${metrics.totalRemainingDebtUsd.toFixed(2)} USD</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Tasa BCV del Día:</span>
                  <span className="text-xs font-mono font-bold text-slate-700">{bcvRate.toFixed(2)} Bs/$</span>
                </div>
              </div>

              {/* Monto a abonar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monto a Abonar o Pagar ($ USD) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-mono font-black text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={metrics.totalRemainingDebtUsd + 0.05}
                    value={abonoAmount}
                    onChange={(e) => setAbonoAmount(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 focus:bg-white rounded-xl pl-8 pr-4 py-2 text-sm font-mono font-black text-slate-900 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                {parseFloat(abonoAmount) > 0 && (
                  <span className="text-[11px] font-mono text-emerald-700 font-bold mt-1 block">
                    ≈ Bs. {(parseFloat(abonoAmount) * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              {/* Método de pago */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Método de Pago *
                  </label>
                  <select
                    value={abonoMethod}
                    onChange={(e) => setAbonoMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                    <option value="EFECTIVO_USD">Efectivo USD ($)</option>
                    <option value="EFECTIVO_BS">Efectivo Bolívares (Bs)</option>
                    <option value="PAGO_MOVIL">Pago Móvil</option>
                    <option value="PUNTO_DE_VENTA">Tarjeta Débito (POS)</option>
                    <option value="BINANCE">Binance USDT</option>
                    <option value="ZELLE">Zelle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Referencia Bancaria
                  </label>
                  <input
                    type="text"
                    value={abonoReference}
                    onChange={(e) => setAbonoReference(e.target.value)}
                    placeholder="Ej: TRF-908123"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notas / Observación (Opcional)
                </label>
                <input
                  type="text"
                  value={abonoNotes}
                  onChange={(e) => setAbonoNotes(e.target.value)}
                  placeholder="Ej: Abono de quincena según acuerdo comercial"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
                />
              </div>

              {/* FIFO explanation note */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-900 space-y-1">
                <span className="font-black flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                  Amortización Automática (FIFO):
                </span>
                <p className="text-[11px] text-purple-800">
                  Este abono se aplicará cancelando o disminuyendo el saldo de las facturas más antiguas de este proveedor hasta agotar el importe registrado.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAbonoModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar y Aplicar Abono</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EMITIR NOTA DE CRÉDITO / DEVOLUCIÓN A FAVOR     */}
      {/* ========================================================= */}
      {isNcModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Emitir Nota de Crédito / Devolución a Favor</h3>
                  <p className="text-xs text-slate-500 font-mono">Proveedor: {supplier.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNcModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Factura asociada */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vincular a Recibo / Factura de Origen
                  </label>
                  <select
                    value={ncReceiptId}
                    onChange={(e) => setNcReceiptId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="">(Sin recibo específico / General)</option>
                    {supplierReceipts.map((r) => (
                      <option key={r.id} value={r.id}>
                        #{r.receiptNumber} (${r.totalCost.toFixed(2)}) - {new Date(r.receivedAt || r.createdAt).toLocaleDateString('es-VE')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Motivo de devolución */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Motivo de Devolución *
                  </label>
                  <select
                    value={ncReason}
                    onChange={(e: any) => setNcReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="DEFECTUOSO">Producto Defectuoso / Roto de Fábrica</option>
                    <option value="VENCIDO">Producto Vencido / Fecha Caducada</option>
                    <option value="DIFERENCIA_PRECIO">Diferencia en Precio Facturado vs Pactado</option>
                    <option value="ERROR_DESPACHO">Error en Cantidad / Despacho Incompleto</option>
                    <option value="OTRO">Otro Motivo</option>
                  </select>
                </div>
              </div>

              {/* Agregar producto devuelto */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Carga de Productos Devueltos al Proveedor:
                </span>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Nombre del Producto *</label>
                    <input
                      type="text"
                      value={ncItemProductName}
                      onChange={(e) => setNcItemProductName(e.target.value)}
                      placeholder="Ej: Malta Polar 250ml"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Cant. Devuelta *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={ncItemQuantity}
                      onChange={(e) => setNcItemQuantity(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Costo Unit. ($) *</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={ncItemUnitCost}
                      onChange={(e) => setNcItemUnitCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-[11px] text-slate-500">
                    O seleccione de los productos de inventario:
                  </span>
                  <button
                    type="button"
                    onClick={handleAddNcItem}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar a la Nota</span>
                  </button>
                </div>

                {/* Quick inventory pick pills */}
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                  {products.slice(0, 8).map((p, idx) => (
                    <button
                      key={`nc-prod-pill-${p.id}-${idx}`}
                      type="button"
                      onClick={() => handleSelectProductForNc(p)}
                      className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 hover:border-purple-300 text-[10px] font-mono text-slate-700 cursor-pointer"
                    >
                      {p.name} (${p.cost.toFixed(2)})
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Table in NC */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                      <th className="py-2.5 px-3">Producto</th>
                      <th className="py-2.5 px-3 text-right">Cant.</th>
                      <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {ncItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 font-sans">
                          No ha agregado productos a la nota de crédito.
                        </td>
                      </tr>
                    ) : (
                      ncItems.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 px-3 font-sans font-bold text-slate-900">{item.productName}</td>
                          <td className="py-2 px-3 text-right font-bold text-purple-900">{item.quantity} {item.unit}</td>
                          <td className="py-2 px-3 text-right">${item.unitCost.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-black">${item.subtotal.toFixed(2)}</td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveNcItem(item.id)}
                              className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total & Options */}
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-purple-900">
                  <input
                    type="checkbox"
                    checked={discountPhysicalStock}
                    onChange={(e) => setDiscountPhysicalStock(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-purple-300"
                  />
                  <span>Descontar automáticamente estas unidades del Stock Físico (Kardex: Salida por Devolución)</span>
                </label>

                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Total Nota de Crédito:</span>
                  <span className="text-lg font-black font-mono text-purple-950">${totalNcAmount.toFixed(2)} USD</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones / Explicación del caso
                </label>
                <textarea
                  rows={2}
                  value={ncGeneralNotes}
                  onChange={(e) => setNcGeneralNotes(e.target.value)}
                  placeholder="Detalles adicionales sobre el defecto, lote o acuerdo de compensación..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNcModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveCreditNote}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Emitir Nota de Crédito a Favor</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: CRUZAR NOTA DE CRÉDITO CON FACTURAS PENDIENTES  */}
      {/* ========================================================= */}
      {isCrossModalOpen && selectedCreditNoteForCross && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Cruzar Nota de Crédito #{selectedCreditNoteForCross.code}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Saldo disponible para cruzar: <strong>${selectedCreditNoteForCross.remainingBalanceUsd.toFixed(2)} USD</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCrossModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Seleccione el importe a descontar de las facturas pendientes de <strong>{supplier.name}</strong>. El monto se restará automáticamente del saldo deudor.
              </p>

              <div className="space-y-2.5 max-h-60 overflow-y-auto border border-slate-200 rounded-2xl p-3">
                {supplierReceipts.filter((r) => r.status === 'PENDIENTE').length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    Este proveedor no tiene facturas pendientes para cruzar.
                  </div>
                ) : (
                  supplierReceipts
                    .filter((r) => r.status === 'PENDIENTE')
                    .map((rec) => {
                      const allocatedVal = crossAllocations[rec.id] || '0';

                      return (
                        <div key={rec.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                          <div>
                            <span className="font-mono font-black text-purple-900 text-xs block">
                              Recibo #{rec.receiptNumber}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Saldo actual: <strong className="text-rose-700">${rec.remainingBalanceUsd.toFixed(2)} USD</strong>
                            </span>
                          </div>

                          <div className="w-32">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase">Aplicar ($):</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={Math.min(rec.remainingBalanceUsd, selectedCreditNoteForCross.remainingBalanceUsd)}
                              value={allocatedVal}
                              onChange={(e) => setCrossAllocations({ ...crossAllocations, [rec.id]: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono font-black text-slate-900 focus:outline-none"
                            />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCrossModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCrossCreditNote}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Cruzar y Descontar Deuda</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
