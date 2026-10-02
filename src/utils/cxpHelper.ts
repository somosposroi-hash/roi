import { Supplier, PurchaseReceipt, SupplierCreditNote, SupplierGeneralPayment } from '../types';

const SUPPLIERS_KEY = 'nubly_app_suppliers_v1';
const RECEIPTS_KEY = 'nubly_app_purchase_receipts_v1';
const CREDIT_NOTES_KEY = 'nubly_app_supplier_credit_notes_v1';
const PAYMENTS_KEY = 'nubly_app_supplier_general_payments_v1';

// Sample initial suppliers
const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-1',
    name: 'Distribuidora Polar C.A.',
    rif: 'J-00030633-3',
    phone: '0212-2023111',
    email: 'ventas@polar.com.ve',
    address: 'Los Cortijos de Lourdes, Caracas',
    notes: 'Proveedor principal de cervezas, maltas y harina PAN',
    createdAt: new Date().toISOString()
  },
  {
    id: 'sup-2',
    name: 'Alimentos Heinz de Venezuela',
    rif: 'J-00021940-6',
    phone: '0241-8712200',
    email: 'pedidos@heinz.com.ve',
    address: 'Zona Industrial San Diego, Valencia',
    notes: 'Salsas, colados y envasados',
    createdAt: new Date().toISOString()
  },
  {
    id: 'sup-3',
    name: 'Mondelez Venezuela S.A.',
    rif: 'J-30018884-2',
    phone: '0212-9018111',
    email: 'contacto@mondelez.com',
    address: 'Baruta, Caracas',
    notes: 'Galletas, chocolates y snacks',
    createdAt: new Date().toISOString()
  }
];

// Helper to generate dynamic past ISO dates
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function daysFuture(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Default realistic sample receipts spanning all aging categories
const DEFAULT_RECEIPTS: PurchaseReceipt[] = [
  {
    id: 'rec-sample-1',
    receiptNumber: 'FACT-POL-9812',
    supplierId: 'sup-1',
    supplierName: 'Distribuidora Polar C.A.',
    supplierRif: 'J-00030633-3',
    supplierPhone: '0212-2023111',
    receivedAt: daysAgo(5),
    paymentType: 'CREDITO',
    dueDate: daysFuture(10), // Por Vencer (in 10 days)
    hasIva: true,
    ivaRatePercent: 16,
    subtotalCost: 1500,
    taxAmount: 240,
    totalCost: 1740,
    paidAmountUsd: 0,
    remainingBalanceUsd: 1740,
    status: 'PENDIENTE',
    items: [
      {
        id: 'item-p1',
        productName: 'Harina PAN Blanca 1kg (Fardo 20 un)',
        productBarcode: '7591016200010',
        category: 'Alimentos',
        unit: 'PAQ',
        minStock: 10,
        unitCost: 19.5,
        quantityReceived: 40,
        subtotalCost: 780,
        profitMarginPercent: 25,
        calculatedSalePrice: 26.0
      },
      {
        id: 'item-p2',
        productName: 'Malta Polar 250ml (Caja 24 un)',
        productBarcode: '7591016200027',
        category: 'Bebidas',
        unit: 'PAQ',
        minStock: 8,
        unitCost: 18.0,
        quantityReceived: 40,
        subtotalCost: 720,
        profitMarginPercent: 30,
        calculatedSalePrice: 25.7
      }
    ],
    createdAt: daysAgo(5)
  },
  {
    id: 'rec-sample-2',
    receiptNumber: 'FACT-POL-8419',
    supplierId: 'sup-1',
    supplierName: 'Distribuidora Polar C.A.',
    supplierRif: 'J-00030633-3',
    supplierPhone: '0212-2023111',
    receivedAt: daysAgo(35),
    paymentType: 'CREDITO',
    dueDate: daysAgo(14).slice(0, 10), // 1 a 30 Días Vencido (14 days overdue)
    hasIva: true,
    ivaRatePercent: 16,
    subtotalCost: 1000,
    taxAmount: 160,
    totalCost: 1160,
    paidAmountUsd: 360,
    remainingBalanceUsd: 800,
    status: 'PENDIENTE',
    paymentsHistory: [
      {
        id: 'pay-sample-1',
        date: daysAgo(20),
        amountUsd: 360,
        paymentMethod: 'TRANSFERENCIA',
        reference: 'TRF-09881',
        notes: 'Abono inicial 30%'
      }
    ],
    items: [
      {
        id: 'item-p3',
        productName: 'Cerveza Polar Pilsen Botella 330ml (Caja 36 un)',
        productBarcode: '7591016200034',
        category: 'Licores',
        unit: 'PAQ',
        minStock: 5,
        unitCost: 20.0,
        quantityReceived: 50,
        subtotalCost: 1000,
        profitMarginPercent: 30,
        calculatedSalePrice: 28.5
      }
    ],
    createdAt: daysAgo(35)
  },
  {
    id: 'rec-sample-3',
    receiptNumber: 'FACT-HNZ-5501',
    supplierId: 'sup-2',
    supplierName: 'Alimentos Heinz de Venezuela',
    supplierRif: 'J-00021940-6',
    supplierPhone: '0241-8712200',
    receivedAt: daysAgo(75),
    paymentType: 'CREDITO',
    dueDate: daysAgo(45).slice(0, 10), // 31 a 60 Días Vencido (45 days overdue)
    hasIva: true,
    ivaRatePercent: 16,
    subtotalCost: 750,
    taxAmount: 120,
    totalCost: 870,
    paidAmountUsd: 0,
    remainingBalanceUsd: 870,
    status: 'PENDIENTE',
    items: [
      {
        id: 'item-h1',
        productName: 'Ketchup Heinz 397g (Caja 24 un)',
        productBarcode: '7591024300015',
        category: 'Alimentos',
        unit: 'PAQ',
        minStock: 6,
        unitCost: 25.0,
        quantityReceived: 30,
        subtotalCost: 750,
        profitMarginPercent: 30,
        calculatedSalePrice: 35.7
      }
    ],
    createdAt: daysAgo(75)
  },
  {
    id: 'rec-sample-4',
    receiptNumber: 'FACT-MDZ-3091',
    supplierId: 'sup-3',
    supplierName: 'Mondelez Venezuela S.A.',
    supplierRif: 'J-30018884-2',
    supplierPhone: '0212-9018111',
    receivedAt: daysAgo(110),
    paymentType: 'CREDITO',
    dueDate: daysAgo(80).slice(0, 10), // Más de 60 Días Vencido (>60 days overdue - Crítica)
    hasIva: true,
    ivaRatePercent: 16,
    subtotalCost: 500,
    taxAmount: 80,
    totalCost: 580,
    paidAmountUsd: 100,
    remainingBalanceUsd: 480,
    status: 'PENDIENTE',
    paymentsHistory: [
      {
        id: 'pay-sample-2',
        date: daysAgo(90),
        amountUsd: 100,
        paymentMethod: 'PAGO_MOVIL',
        reference: 'PM-9941',
        notes: 'Abono de buena fe'
      }
    ],
    items: [
      {
        id: 'item-m1',
        productName: 'Galletas Oreo Tipo Americano (Caja 36 un)',
        productBarcode: '7591038200012',
        category: 'Snacks',
        unit: 'PAQ',
        minStock: 8,
        unitCost: 13.88,
        quantityReceived: 36,
        subtotalCost: 500,
        profitMarginPercent: 35,
        calculatedSalePrice: 21.35
      }
    ],
    createdAt: daysAgo(110)
  },
  {
    id: 'rec-sample-5',
    receiptNumber: 'FACT-POL-7710',
    supplierId: 'sup-1',
    supplierName: 'Distribuidora Polar C.A.',
    supplierRif: 'J-00030633-3',
    supplierPhone: '0212-2023111',
    receivedAt: daysAgo(20),
    paymentType: 'CONTADO',
    hasIva: true,
    ivaRatePercent: 16,
    subtotalCost: 600,
    taxAmount: 96,
    totalCost: 696,
    paidAmountUsd: 696,
    remainingBalanceUsd: 0,
    status: 'PAGADO',
    paymentsHistory: [
      {
        id: 'pay-sample-3',
        date: daysAgo(20),
        amountUsd: 696,
        paymentMethod: 'TRANSFERENCIA',
        reference: 'TRF-11029',
        notes: 'Pago de contado al recibir mercancía'
      }
    ],
    items: [
      {
        id: 'item-p4',
        productName: 'Margarina Mavesa 500g (Caja 24 un)',
        productBarcode: '7591016200058',
        category: 'Alimentos',
        unit: 'PAQ',
        minStock: 5,
        unitCost: 25.0,
        quantityReceived: 24,
        subtotalCost: 600,
        profitMarginPercent: 28,
        calculatedSalePrice: 34.7
      }
    ],
    createdAt: daysAgo(20)
  }
];

// Sample default credit note (A favor del bodegón por mercancía defectuosa)
const DEFAULT_CREDIT_NOTES: SupplierCreditNote[] = [
  {
    id: 'nc-sample-1',
    code: 'NC-POL-0014',
    supplierId: 'sup-1',
    supplierName: 'Distribuidora Polar C.A.',
    supplierRif: 'J-00030633-3',
    receiptId: 'rec-sample-2',
    receiptNumber: 'FACT-POL-8419',
    date: daysAgo(10),
    reason: 'DEFECTUOSO',
    notes: 'Devolución de 4 cajas de Malta Polar con filtración en empaque de fábrica',
    items: [
      {
        id: 'nc-item-1',
        productName: 'Malta Polar 250ml (Caja 24 un)',
        productBarcode: '7591016200027',
        quantity: 4,
        unit: 'PAQ',
        unitCost: 18.0,
        subtotal: 72.0,
        returnReason: 'DEFECTUOSO'
      }
    ],
    totalAmountUsd: 72.0,
    appliedAmountUsd: 0,
    remainingBalanceUsd: 72.0,
    status: 'DISPONIBLE',
    appliedToReceipts: [],
    createdAt: daysAgo(10)
  }
];

export function getSuppliersList(): Supplier[] {
  if (typeof window === 'undefined') return DEFAULT_SUPPLIERS;
  try {
    const saved = localStorage.getItem(SUPPLIERS_KEY);
    if (!saved) {
      localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(DEFAULT_SUPPLIERS));
      return DEFAULT_SUPPLIERS;
    }
    return JSON.parse(saved);
  } catch (e) {
    return DEFAULT_SUPPLIERS;
  }
}

export function saveSuppliersList(suppliers: Supplier[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(suppliers));
  } catch (e) {
    console.error('Error saving suppliers list:', e);
  }
}

export function saveOrUpdateSupplier(supplierData: Partial<Supplier> & { name: string; rif: string }): Supplier {
  const current = getSuppliersList();
  const existing = current.find(
    s => s.rif.trim().toLowerCase() === supplierData.rif.trim().toLowerCase() ||
         s.name.trim().toLowerCase() === supplierData.name.trim().toLowerCase()
  );

  if (existing) {
    const updated: Supplier = {
      ...existing,
      ...supplierData,
      phone: supplierData.phone || existing.phone,
      email: supplierData.email || existing.email,
      address: supplierData.address || existing.address,
      notes: supplierData.notes || existing.notes
    };
    const newList = current.map(s => s.id === existing.id ? updated : s);
    saveSuppliersList(newList);
    return updated;
  } else {
    const newSupplier: Supplier = {
      id: `sup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: supplierData.name.trim(),
      rif: supplierData.rif.trim(),
      phone: supplierData.phone?.trim() || '',
      email: supplierData.email?.trim() || '',
      address: supplierData.address?.trim() || '',
      notes: supplierData.notes?.trim() || '',
      createdAt: new Date().toISOString()
    };
    saveSuppliersList([newSupplier, ...current]);
    return newSupplier;
  }
}

export function getPurchaseReceipts(): PurchaseReceipt[] {
  if (typeof window === 'undefined') return DEFAULT_RECEIPTS;
  try {
    const saved = localStorage.getItem(RECEIPTS_KEY);
    if (!saved) {
      localStorage.setItem(RECEIPTS_KEY, JSON.stringify(DEFAULT_RECEIPTS));
      return DEFAULT_RECEIPTS;
    }
    return JSON.parse(saved);
  } catch (e) {
    return DEFAULT_RECEIPTS;
  }
}

export function savePurchaseReceipts(receipts: PurchaseReceipt[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
  } catch (e) {
    console.error('Error saving purchase receipts:', e);
  }
}

export function saveNewPurchaseReceipt(receipt: PurchaseReceipt): void {
  const current = getPurchaseReceipts();
  savePurchaseReceipts([receipt, ...current]);
}

export function updatePurchaseReceipt(updatedReceipt: PurchaseReceipt): void {
  const current = getPurchaseReceipts();
  const newList = current.map(r => r.id === updatedReceipt.id ? updatedReceipt : r);
  savePurchaseReceipts(newList);
}

// ==========================================
// CREDIT NOTES (NOTAS DE CRÉDITO A FAVOR)
// ==========================================

export function getCreditNotes(): SupplierCreditNote[] {
  if (typeof window === 'undefined') return DEFAULT_CREDIT_NOTES;
  try {
    const saved = localStorage.getItem(CREDIT_NOTES_KEY);
    if (!saved) {
      localStorage.setItem(CREDIT_NOTES_KEY, JSON.stringify(DEFAULT_CREDIT_NOTES));
      return DEFAULT_CREDIT_NOTES;
    }
    return JSON.parse(saved);
  } catch (e) {
    return DEFAULT_CREDIT_NOTES;
  }
}

export function saveCreditNotes(notes: SupplierCreditNote[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CREDIT_NOTES_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Error saving credit notes:', e);
  }
}

export function saveNewCreditNote(note: SupplierCreditNote): void {
  const current = getCreditNotes();
  saveCreditNotes([note, ...current]);
}

export function updateCreditNote(updated: SupplierCreditNote): void {
  const current = getCreditNotes();
  const newList = current.map(n => n.id === updated.id ? updated : n);
  saveCreditNotes(newList);
}

// ==========================================
// SUPPLIER GENERAL PAYMENTS (ABONOS AL SALDO)
// ==========================================

export function getSupplierGeneralPayments(): SupplierGeneralPayment[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(PAYMENTS_KEY);
    if (!saved) return [];
    return JSON.parse(saved);
  } catch (e) {
    return [];
  }
}

export function saveSupplierGeneralPayments(payments: SupplierGeneralPayment[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
  } catch (e) {
    console.error('Error saving supplier general payments:', e);
  }
}

export function saveNewSupplierGeneralPayment(payment: SupplierGeneralPayment): void {
  const current = getSupplierGeneralPayments();
  saveSupplierGeneralPayments([payment, ...current]);
}

/**
 * Amortize an amount against the supplier's balance.
 * Implements FIFO: oldest pending receipts are paid/amortized first.
 */
export function amortizeSupplierBalance(
  supplierId: string,
  amountUsd: number,
  paymentDetails: {
    paymentMethod: string;
    reference?: string;
    notes?: string;
    bcvRate: number;
  }
): { payment: SupplierGeneralPayment; updatedReceipts: PurchaseReceipt[] } {
  const currentReceipts = getPurchaseReceipts();
  const currentSuppliers = getSuppliersList();
  const supplier = currentSuppliers.find(s => s.id === supplierId);

  // Find all pending receipts for this supplier
  const pendingReceipts = currentReceipts
    .filter(
      r => (r.supplierId === supplierId || (supplier && r.supplierRif === supplier.rif)) &&
           r.status === 'PENDIENTE' &&
           r.remainingBalanceUsd > 0.001
    )
    .sort((a, b) => {
      // FIFO: sort oldest by dueDate or receivedAt
      const dateA = new Date(a.dueDate || a.receivedAt || a.createdAt).getTime();
      const dateB = new Date(b.dueDate || b.receivedAt || b.createdAt).getTime();
      return dateA - dateB;
    });

  let remainingPayment = amountUsd;
  const amortizedReceiptsRecord: { receiptId: string; receiptNumber: string; amortizedAmountUsd: number }[] = [];
  const updatedReceiptsMap = new Map<string, PurchaseReceipt>();

  for (const receipt of pendingReceipts) {
    if (remainingPayment <= 0.001) break;

    const toPay = Math.min(receipt.remainingBalanceUsd, remainingPayment);
    const newPaid = receipt.paidAmountUsd + toPay;
    const newRemaining = Math.max(0, receipt.remainingBalanceUsd - toPay);
    const newStatus = newRemaining <= 0.01 ? 'PAGADO' : 'PENDIENTE';

    const newPaymentEntry = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      date: new Date().toISOString(),
      amountUsd: Number(toPay.toFixed(2)),
      paymentMethod: paymentDetails.paymentMethod,
      reference: paymentDetails.reference,
      notes: paymentDetails.notes
        ? `Abono a Saldo Global: ${paymentDetails.notes}`
        : 'Abono general amortizado a saldo'
    };

    const updatedReceipt: PurchaseReceipt = {
      ...receipt,
      paidAmountUsd: Number(newPaid.toFixed(2)),
      remainingBalanceUsd: Number(newRemaining.toFixed(2)),
      status: newStatus,
      paymentsHistory: [...(receipt.paymentsHistory || []), newPaymentEntry]
    };

    amortizedReceiptsRecord.push({
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      amortizedAmountUsd: Number(toPay.toFixed(2))
    });

    updatedReceiptsMap.set(receipt.id, updatedReceipt);
    remainingPayment -= toPay;
  }

  // Update stored receipts
  const newReceiptsList = currentReceipts.map(r => updatedReceiptsMap.get(r.id) || r);
  savePurchaseReceipts(newReceiptsList);

  // Record general payment
  const generalPayment: SupplierGeneralPayment = {
    id: `sgp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    supplierId,
    supplierName: supplier?.name || 'Proveedor',
    supplierRif: supplier?.rif || '',
    date: new Date().toISOString(),
    amountUsd,
    bcvRateAtPayment: paymentDetails.bcvRate,
    amountBs: amountUsd * paymentDetails.bcvRate,
    paymentMethod: paymentDetails.paymentMethod,
    reference: paymentDetails.reference,
    notes: paymentDetails.notes,
    amortizedReceipts: amortizedReceiptsRecord,
    createdAt: new Date().toISOString()
  };

  saveNewSupplierGeneralPayment(generalPayment);

  return {
    payment: generalPayment,
    updatedReceipts: Array.from(updatedReceiptsMap.values())
  };
}

/**
 * Cross an available Credit Note with pending receipts of that supplier.
 * Discounts debt directly and records the cross-credit.
 */
export function crossCreditNoteWithReceipts(
  creditNoteId: string,
  targetReceipts: { receiptId: string; amountToApply: number }[]
): { updatedCreditNote: SupplierCreditNote; updatedReceipts: PurchaseReceipt[] } {
  const currentCreditNotes = getCreditNotes();
  const note = currentCreditNotes.find(n => n.id === creditNoteId);
  if (!note) throw new Error('Nota de crédito no encontrada');

  const currentReceipts = getPurchaseReceipts();
  const updatedReceiptsMap = new Map<string, PurchaseReceipt>();
  let totalAppliedNow = 0;
  const newlyAppliedList = [...(note.appliedToReceipts || [])];

  for (const target of targetReceipts) {
    if (target.amountToApply <= 0.001) continue;
    const receipt = currentReceipts.find(r => r.id === target.receiptId);
    if (!receipt) continue;

    const availableInNote = note.remainingBalanceUsd - totalAppliedNow;
    const actualApply = Math.min(target.amountToApply, receipt.remainingBalanceUsd, availableInNote);
    if (actualApply <= 0.001) continue;

    const newPaid = receipt.paidAmountUsd + actualApply;
    const newRemaining = Math.max(0, receipt.remainingBalanceUsd - actualApply);
    const newStatus = newRemaining <= 0.01 ? 'PAGADO' : 'PENDIENTE';

    const creditPaymentEntry = {
      id: `nc-pay-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      date: new Date().toISOString(),
      amountUsd: Number(actualApply.toFixed(2)),
      paymentMethod: 'NOTA_DE_CREDITO',
      reference: note.code,
      notes: `Cruce con Nota de Crédito ${note.code} (${note.reason || 'Devolución'})`
    };

    const updatedReceipt: PurchaseReceipt = {
      ...receipt,
      paidAmountUsd: Number(newPaid.toFixed(2)),
      remainingBalanceUsd: Number(newRemaining.toFixed(2)),
      status: newStatus,
      paymentsHistory: [...(receipt.paymentsHistory || []), creditPaymentEntry]
    };

    updatedReceiptsMap.set(receipt.id, updatedReceipt);
    totalAppliedNow += actualApply;

    newlyAppliedList.push({
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      appliedAmountUsd: Number(actualApply.toFixed(2)),
      date: new Date().toISOString(),
      notes: `Aplicado a Factura #${receipt.receiptNumber}`
    });
  }

  // Update credit note
  const newAppliedTotal = note.appliedAmountUsd + totalAppliedNow;
  const newRemainingCredit = Math.max(0, note.totalAmountUsd - newAppliedTotal);
  const newNoteStatus: 'DISPONIBLE' | 'PARCIAL' | 'APLICADA' =
    newRemainingCredit <= 0.01 ? 'APLICADA' : (newAppliedTotal > 0 ? 'PARCIAL' : 'DISPONIBLE');

  const updatedNote: SupplierCreditNote = {
    ...note,
    appliedAmountUsd: Number(newAppliedTotal.toFixed(2)),
    remainingBalanceUsd: Number(newRemainingCredit.toFixed(2)),
    status: newNoteStatus,
    appliedToReceipts: newlyAppliedList
  };

  updateCreditNote(updatedNote);

  // Update receipts
  const newReceiptsList = currentReceipts.map(r => updatedReceiptsMap.get(r.id) || r);
  savePurchaseReceipts(newReceiptsList);

  return {
    updatedCreditNote: updatedNote,
    updatedReceipts: Array.from(updatedReceiptsMap.values())
  };
}

// ==========================================
// AGING REPORT EVALUATION HELPERS
// ==========================================

export type AgingBracket = 'POR_VENCER' | '1_A_30' | '31_A_60' | 'MAS_60';

export interface AgingReceiptInfo {
  receipt: PurchaseReceipt;
  dueDate: Date;
  daysDiff: number; // positive = days overdue, negative or zero = days remaining until due
  bracket: AgingBracket;
  bracketLabel: string;
  badgeClass: string;
}

export function evaluateReceiptAging(receipt: PurchaseReceipt): AgingReceiptInfo {
  const now = new Date();
  let dueDate: Date;
  if (receipt.dueDate) {
    dueDate = new Date(receipt.dueDate + 'T23:59:59');
  } else if (receipt.receivedAt) {
    dueDate = new Date(receipt.receivedAt);
    dueDate.setDate(dueDate.getDate() + 15);
  } else {
    dueDate = new Date();
  }

  // Calculate difference in days (positive = overdue)
  const diffMs = now.getTime() - dueDate.getTime();
  const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let bracket: AgingBracket;
  let bracketLabel: string;
  let badgeClass: string;

  if (daysDiff <= 0) {
    bracket = 'POR_VENCER';
    const remainingDays = Math.abs(daysDiff);
    bracketLabel = remainingDays === 0 ? 'Vence hoy' : `Vence en ${remainingDays} d`;
    badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  } else if (daysDiff <= 30) {
    bracket = '1_A_30';
    bracketLabel = `${daysDiff} d vencido (1-30)`;
    badgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
  } else if (daysDiff <= 60) {
    bracket = '31_A_60';
    bracketLabel = `${daysDiff} d vencido (31-60)`;
    badgeClass = 'bg-rose-100 text-rose-800 border-rose-300';
  } else {
    bracket = 'MAS_60';
    bracketLabel = `+${daysDiff} d crítico (>60)`;
    badgeClass = 'bg-purple-900 text-purple-100 border-purple-800 font-black animate-pulse';
  }

  return {
    receipt,
    dueDate,
    daysDiff,
    bracket,
    bracketLabel,
    badgeClass
  };
}

export function deletePurchaseReceipt(id: string): void {
  try {
    const receipts = getPurchaseReceipts();
    const updated = receipts.filter(r => r.id !== id);
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('purchase-receipt-deleted', { detail: { id } }));
    }
  } catch (err) {
    console.warn('Error deleting purchase receipt:', err);
  }
}
