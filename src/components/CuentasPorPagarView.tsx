import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Truck, 
  DollarSign, 
  Calendar, 
  Package, 
  AlertCircle, 
  Clock, 
  CreditCard, 
  Building2, 
  User, 
  Phone, 
  ChevronRight, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Receipt, 
  ShieldCheck, 
  RefreshCw, 
  Check, 
  X, 
  ChevronDown, 
  Coins, 
  Percent, 
  Barcode, 
  Layers, 
  Eye, 
  Printer, 
  Wallet,
  Tag,
  RotateCcw,
  TrendingDown
} from 'lucide-react';
import { 
  Product, 
  Supplier, 
  PurchaseReceipt, 
  PurchaseReceiptItem, 
  PurchaseReceiptPayment, 
  SupplierCreditNote, 
  SupplierGeneralPayment 
} from '../types';
import { 
  getSuppliersList, 
  saveOrUpdateSupplier, 
  getPurchaseReceipts, 
  saveNewPurchaseReceipt, 
  updatePurchaseReceipt,
  deletePurchaseReceipt,
  getCreditNotes,
  getSupplierGeneralPayments
} from '../utils/cxpHelper';
import { safeFetchJson } from '../utils/api';
import { PaymentMethodLogo } from './PaymentMethodLogo';
import { SupplierDetailPage } from './SupplierDetailPage';
import { AgingReportView } from './AgingReportView';

interface CuentasPorPagarViewProps {
  products: Product[];
  onRefreshProducts: () => void;
  bcvRate: number;
  initialTab?: 'proveedores' | 'aging' | 'recepcion' | 'historial';
}

export function CuentasPorPagarView({ products, onRefreshProducts, bcvRate, initialTab }: CuentasPorPagarViewProps) {
  // Default to initialTab or 'proveedores' as requested by the user
  const [activeTab, setActiveTab] = useState<'proveedores' | 'aging' | 'recepcion' | 'historial'>(initialTab || 'proveedores');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([]);
  const [creditNotes, setCreditNotes] = useState<SupplierCreditNote[]>([]);
  const [generalPayments, setGeneralPayments] = useState<SupplierGeneralPayment[]>([]);
  const [viewingSupplierId, setViewingSupplierId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters for history & suppliers
  const [receiptSearch, setReceiptSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDIENTE' | 'PAGADO'>('ALL');

  // Selected detail states
  const [selectedReceiptDetail, setSelectedReceiptDetail] = useState<PurchaseReceipt | null>(null);
  const [receiptToDelete, setReceiptToDelete] = useState<PurchaseReceipt | null>(null);

  // Modal payment state for Accounts Payable (Abonos a Proveedor)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentTargetReceipt, setPaymentTargetReceipt] = useState<PurchaseReceipt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('TRANSFERENCIA');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // ==========================================
  // WIZARD FORM STATE (PASO A PASO EN 3 PASOS)
  // ==========================================
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // STEP 1: Datos del Recibo
  const [receiptNumber, setReceiptNumber] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierRif, setNewSupplierRif] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [isAddingNewSupplierInline, setIsAddingNewSupplierInline] = useState(false);

  const [receivedAtDate, setReceivedAtDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  });
  const [paymentType, setPaymentType] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [paymentMethodStep1, setPaymentMethodStep1] = useState('EFECTIVO_USD');
  const [dueDateStep1, setDueDateStep1] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15); // Default 15 days credit
    return d.toISOString().slice(0, 10);
  });
  const [hasIva, setHasIva] = useState(true);
  const [ivaRatePercent, setIvaRatePercent] = useState(16);

  // STEP 2: Carga de Productos
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [receiptItems, setReceiptItems] = useState<PurchaseReceiptItem[]>([]);

  // Item form state (for existing or new item being added to receipt)
  const [selectedProductForEntry, setSelectedProductForEntry] = useState<Product | null>(null);
  const [isNewProductMode, setIsNewProductMode] = useState(false);

  const [itemBarcode, setItemBarcode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Alimentos');
  const [itemUnit, setItemUnit] = useState('UND');
  const [itemMinStock, setItemMinStock] = useState('5');
  const [itemUnitCost, setItemUnitCost] = useState('');
  const [itemQuantityReceived, setItemQuantityReceived] = useState('');
  const [itemProfitMargin, setItemProfitMargin] = useState('30');
  const [itemSalePrice, setItemSalePrice] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');

  // Initial load
  useEffect(() => {
    loadData();
    // Auto-generate a receipt number suggestion
    setReceiptNumber(`REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  }, []);

  const loadData = () => {
    setSuppliers(getSuppliersList());
    setReceipts(getPurchaseReceipts());
    setCreditNotes(getCreditNotes());
    setGeneralPayments(getSupplierGeneralPayments());
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Step 1 Validation & Proceed
  const handleProceedToStep2 = () => {
    if (!receiptNumber.trim()) {
      showToast('Por favor ingrese el número de recibo o nota de compra.');
      return;
    }

    if (isAddingNewSupplierInline) {
      if (!newSupplierName.trim() || !newSupplierRif.trim()) {
        showToast('Debe ingresar el Nombre y RIF del nuevo proveedor.');
        return;
      }
    } else {
      if (!selectedSupplierId) {
        showToast('Debe seleccionar o registrar un proveedor.');
        return;
      }
    }

    setWizardStep(2);
  };

  // Product Search Filter in Step 2
  const filteredInventoryProducts = products.filter((p) => {
    if (!productSearchQuery.trim()) return false;
    const q = productSearchQuery.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  // Select an existing product from inventory
  const handleSelectExistingProduct = (prod: Product) => {
    setSelectedProductForEntry(prod);
    setIsNewProductMode(false);

    setItemBarcode(prod.barcode);
    setItemName(prod.name);
    setItemCategory(prod.category);
    setItemUnit(prod.unit || 'UND');
    setItemMinStock(prod.minStock.toString());
    setItemUnitCost(prod.cost.toString());
    setItemQuantityReceived('1');
    setItemProfitMargin('30');
    
    // Calculate initial price or use current price
    if (prod.cost > 0) {
      const calcPrice = prod.cost / (1 - 0.30);
      setItemSalePrice(calcPrice.toFixed(2));
    } else {
      setItemSalePrice(prod.price.toString());
    }
    
    setItemImageUrl(prod.imageUrl || '');
    setProductSearchQuery('');
  };

  // Toggle New Product Mode
  const handleStartNewProductMode = () => {
    setSelectedProductForEntry(null);
    setIsNewProductMode(true);

    setItemBarcode(`750${Math.floor(1000000000 + Math.random() * 9000000000)}`);
    setItemName('');
    setItemCategory('Alimentos');
    setItemUnit('UND');
    setItemMinStock('5');
    setItemUnitCost('');
    setItemQuantityReceived('1');
    setItemProfitMargin('30');
    setItemSalePrice('');
    setItemImageUrl('');
  };

  // Recalculate price when cost or margin changes
  const handleCostOrMarginChange = (costStr: string, marginStr: string) => {
    setItemUnitCost(costStr);
    setItemProfitMargin(marginStr);

    const costVal = parseFloat(costStr) || 0;
    const marginVal = parseFloat(marginStr) || 0;

    if (costVal > 0 && marginVal > 0 && marginVal < 100) {
      const calculatedPrice = costVal / (1 - marginVal / 100);
      setItemSalePrice(calculatedPrice.toFixed(2));
    }
  };

  // Add Item to Receipt List
  const handleAddItemToReceipt = (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemName.trim() || !itemBarcode.trim()) {
      showToast('Nombre y código de producto son requeridos.');
      return;
    }

    const qty = parseFloat(itemQuantityReceived);
    if (isNaN(qty) || qty <= 0) {
      showToast('Debe ingresar una cantidad válida mayor a 0 (ej. 4000).');
      return;
    }

    const cost = parseFloat(itemUnitCost) || 0;
    const price = parseFloat(itemSalePrice) || cost;
    const margin = parseFloat(itemProfitMargin) || 30;

    const newItem: PurchaseReceiptItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: selectedProductForEntry ? selectedProductForEntry.id : undefined,
      productName: itemName.trim(),
      productBarcode: itemBarcode.trim(),
      category: itemCategory,
      unit: itemUnit,
      minStock: parseFloat(itemMinStock) || 5,
      unitCost: cost,
      quantityReceived: qty,
      subtotalCost: cost * qty,
      profitMarginPercent: margin,
      calculatedSalePrice: price,
      isNewProduct: isNewProductMode || !selectedProductForEntry,
      imageUrl: itemImageUrl || null
    };

    setReceiptItems((prev) => [...prev, newItem]);

    // Reset item form
    setSelectedProductForEntry(null);
    setIsNewProductMode(false);
    setItemName('');
    setItemBarcode('');
    setItemUnitCost('');
    setItemQuantityReceived('');
    setItemSalePrice('');
    showToast(`Producto "${newItem.productName}" agregado al recibo.`);
  };

  const handleRemoveItem = (itemId: string) => {
    setReceiptItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  // Step 2 Summary Calculations
  const subtotalReceiptCost = receiptItems.reduce((acc, item) => acc + item.subtotalCost, 0);
  const ivaAmountReceipt = hasIva ? subtotalReceiptCost * (ivaRatePercent / 100) : 0;
  const totalReceiptCost = subtotalReceiptCost + ivaAmountReceipt;

  // Step 2 Proceed to Step 3
  const handleProceedToStep3 = () => {
    if (receiptItems.length === 0) {
      showToast('Debe agregar al menos un producto al recibo antes de continuar.');
      return;
    }
    setWizardStep(3);
  };

  // Step 3 Final Execution: Submit Receipt and Update Inventory
  const handleFinalSubmitReceipt = async () => {
    setIsSubmitting(true);
    try {
      // 1. Resolve Supplier
      let finalSupplier: Supplier;
      if (isAddingNewSupplierInline) {
        finalSupplier = saveOrUpdateSupplier({
          name: newSupplierName,
          rif: newSupplierRif,
          phone: newSupplierPhone
        });
      } else {
        const found = suppliers.find((s) => s.id === selectedSupplierId);
        if (found) {
          finalSupplier = found;
        } else {
          finalSupplier = saveOrUpdateSupplier({
            name: 'Proveedor General',
            rif: 'J-00000000-0'
          });
        }
      }

      // 2. Process products in database (Restock or Create)
      for (const item of receiptItems) {
        if (item.productId) {
          // Existing product: Restock units directly to database
          await safeFetchJson(`/api/v1/products/${item.productId}/restock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quantity: item.quantityReceived,
              reason: `Recepción de Recibo #${receiptNumber.trim()}`
            })
          });

          // Update cost and sale price if modified
          await safeFetchJson(`/api/v1/products/${item.productId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cost: item.unitCost,
              price: item.calculatedSalePrice
            })
          });
        } else {
          // Check if barcode already exists in database
          const existingRes = await safeFetchJson<any>(`/api/v1/products/barcode/${encodeURIComponent(item.productBarcode)}`);
          if (existingRes.ok && existingRes.data?.product) {
            const existingProd = existingRes.data.product;
            // Restock existing product
            await safeFetchJson(`/api/v1/products/${existingProd.id}/restock`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                quantity: item.quantityReceived,
                reason: `Recepción de Recibo #${receiptNumber.trim()}`
              })
            });
            await safeFetchJson(`/api/v1/products/${existingProd.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cost: item.unitCost,
                price: item.calculatedSalePrice
              })
            });
          } else {
            // Create new product directly
            await safeFetchJson('/api/v1/products', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                barcode: item.productBarcode,
                sku: `SKU-${item.productBarcode}`,
                name: item.productName,
                category: item.category,
                unit: item.unit,
                stock: item.quantityReceived,
                minStock: item.minStock,
                cost: item.unitCost,
                price: item.calculatedSalePrice,
                imageUrl: item.imageUrl || null
              })
            });
          }
        }
      }

      // 3. Create Purchase Receipt Record
      const isPaidContado = paymentType === 'CONTADO';
      const newReceipt: PurchaseReceipt = {
        id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        receiptNumber: receiptNumber.trim(),
        supplierId: finalSupplier.id,
        supplierName: finalSupplier.name,
        supplierRif: finalSupplier.rif,
        supplierPhone: finalSupplier.phone,
        receivedAt: new Date(receivedAtDate).toISOString(),
        paymentType,
        paymentMethod: isPaidContado ? paymentMethodStep1 : undefined,
        dueDate: paymentType === 'CREDITO' ? dueDateStep1 : undefined,
        hasIva,
        ivaRatePercent: hasIva ? ivaRatePercent : 0,
        subtotalCost: subtotalReceiptCost,
        taxAmount: ivaAmountReceipt,
        totalCost: totalReceiptCost,
        items: receiptItems,
        status: isPaidContado ? 'PAGADO' : 'PENDIENTE',
        paidAmountUsd: isPaidContado ? totalReceiptCost : 0,
        remainingBalanceUsd: isPaidContado ? 0 : totalReceiptCost,
        paymentsHistory: isPaidContado
          ? [
              {
                id: `pay-${Date.now()}`,
                date: new Date().toISOString(),
                amountUsd: totalReceiptCost,
                paymentMethod: paymentMethodStep1,
                notes: 'Pago de contado al recibir mercancía'
              }
            ]
          : [],
        createdAt: new Date().toISOString()
      };

      saveNewPurchaseReceipt(newReceipt);

      // Refresh frontend data & inventory across the entire application immediately
      await Promise.resolve(onRefreshProducts());
      loadData();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('inventory-sync', { detail: { type: 'purchase_receipt', receiptId: newReceipt.id, timestamp: Date.now() } }));
        try {
          localStorage.setItem('nubly_last_inventory_sync', Date.now().toString());
        } catch {}
      }

      // Reset wizard
      setWizardStep(1);
      setReceiptItems([]);
      setReceiptNumber(`REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setIsAddingNewSupplierInline(false);
      setNewSupplierName('');
      setNewSupplierRif('');
      setNewSupplierPhone('');

      showToast(`¡Recibo #${newReceipt.receiptNumber} registrado con éxito! El inventario ha sido actualizado en tiempo real.`);
      setActiveTab('historial');
    } catch (err: any) {
      console.error('Error al registrar recibo de compra:', err);
      showToast('Error registrando recibo: ' + (err.message || 'Intente de nuevo.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Payment/Abono to Supplier
  const handleRegisterPaymentToSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetReceipt) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Ingrese un monto de abono válido.');
      return;
    }

    if (amount > paymentTargetReceipt.remainingBalanceUsd + 0.01) {
      showToast(`El monto no puede superar el saldo pendiente de $${paymentTargetReceipt.remainingBalanceUsd.toFixed(2)} USD.`);
      return;
    }

    const newPayment: PurchaseReceiptPayment = {
      id: `pay-${Date.now()}`,
      date: new Date().toISOString(),
      amountUsd: amount,
      paymentMethod,
      reference: paymentReference.trim() || undefined,
      notes: paymentNotes.trim() || undefined
    };

    const newPaidAmount = paymentTargetReceipt.paidAmountUsd + amount;
    const newRemaining = Math.max(0, paymentTargetReceipt.totalCost - newPaidAmount);
    const newStatus = newRemaining <= 0.01 ? 'PAGADO' : 'PENDIENTE';

    const updated: PurchaseReceipt = {
      ...paymentTargetReceipt,
      status: newStatus,
      paidAmountUsd: newPaidAmount,
      remainingBalanceUsd: newRemaining,
      paymentsHistory: [...(paymentTargetReceipt.paymentsHistory || []), newPayment]
    };

    updatePurchaseReceipt(updated);
    loadData();

    if (selectedReceiptDetail?.id === updated.id) {
      setSelectedReceiptDetail(updated);
    }

    setIsPaymentModalOpen(false);
    setPaymentTargetReceipt(null);
    setPaymentAmount('');
    setPaymentReference('');
    setPaymentNotes('');

    showToast(`Abono de $${amount.toFixed(2)} USD registrado con éxito.`);
  };

  // Filtered lists
  const filteredReceipts = receipts.filter((r) => {
    const matchesSearch =
      r.receiptNumber.toLowerCase().includes(receiptSearch.toLowerCase()) ||
      r.supplierName.toLowerCase().includes(receiptSearch.toLowerCase()) ||
      r.supplierRif.toLowerCase().includes(receiptSearch.toLowerCase());

    if (statusFilter === 'PENDIENTE') return matchesSearch && r.status === 'PENDIENTE';
    if (statusFilter === 'PAGADO') return matchesSearch && r.status === 'PAGADO';
    return matchesSearch;
  });

  const filteredSuppliers = suppliers.filter((s) => {
    const q = supplierSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.rif.toLowerCase().includes(q);
  });

  // Calculate global pending accounts payable
  const totalPendingAccountsPayableUsd = receipts
    .filter((r) => r.status === 'PENDIENTE')
    .reduce((acc, r) => acc + r.remainingBalanceUsd, 0);

  // Dedicated Full Page for Supplier Profile & Accounts Payable
  if (viewingSupplierId) {
    const activeSupplier = suppliers.find((s) => s.id === viewingSupplierId);
    if (activeSupplier) {
      return (
        <SupplierDetailPage
          supplier={activeSupplier}
          receipts={receipts}
          creditNotes={creditNotes}
          generalPayments={generalPayments}
          bcvRate={bcvRate}
          products={products}
          onBack={() => setViewingSupplierId(null)}
          onRefreshData={loadData}
          showToast={showToast}
        />
      );
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* HEADER SECTION WITH STATS SUMMARY */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Cuentas por Pagar & Recepción de Compras</span>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                Módulo ERP
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Gestión de proveedores, antigüedad de saldos, compras a inventario y pagos amortizados FIFO.
            </p>
          </div>
        </div>

        {/* Global Total Debt KPI Card */}
        <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-2xl p-3.5 px-5 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-purple-900 uppercase tracking-wider">
              Total Cuentas por Pagar (Deuda)
            </div>
            <div className="text-lg font-black font-mono text-purple-950 flex items-baseline gap-2">
              <span>${totalPendingAccountsPayableUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
              <span className="text-xs font-bold text-purple-700">
                (Bs. {(totalPendingAccountsPayableUsd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TOP NAVIGATION TABS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {/* TAB 1: Directorio de Proveedores (First tab by user request) */}
        <button
          type="button"
          onClick={() => setActiveTab('proveedores')}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'proveedores'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Directorio de Proveedores ({suppliers.length})</span>
        </button>

        {/* TAB 2: Antigüedad de Saldos (Aging Report) */}
        <button
          type="button"
          onClick={() => setActiveTab('aging')}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'aging'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Antigüedad de Saldos (Aging)</span>
          {receipts.filter(r => r.status === 'PENDIENTE').length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'aging' ? 'bg-white text-purple-700' : 'bg-rose-100 text-rose-700'
            }`}>
              {receipts.filter(r => r.status === 'PENDIENTE').length}
            </span>
          )}
        </button>

        {/* TAB 3: Nueva Recepción de Compra */}
        <button
          type="button"
          onClick={() => setActiveTab('recepcion')}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'recepcion'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Recepción de Compra</span>
        </button>

        {/* TAB 4: Historial de Recibos */}
        <button
          type="button"
          onClick={() => setActiveTab('historial')}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'historial'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Historial de Recibos ({receipts.length})</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: FORMULARIO DE NUEVA RECEPCIÓN DE COMPRA (3 PASOS)  */}
      {/* ========================================================= */}
      {activeTab === 'recepcion' && (
        <div className="space-y-6">
          
          {/* STEP INDICATOR BAR */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Step 1 Indicator */}
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  wizardStep === 1
                    ? 'bg-purple-50 border-purple-300 text-purple-900 ring-2 ring-purple-500/20'
                    : wizardStep > 1
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    wizardStep === 1
                      ? 'bg-purple-600 text-white'
                      : wizardStep > 1
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-300 text-slate-600'
                  }`}
                >
                  {wizardStep > 1 ? <Check className="w-4 h-4" /> : '1'}
                </div>
                <div>
                  <div className="text-xs font-extrabold">1. Datos del Recibo</div>
                  <div className="text-[10px] text-slate-500">Proveedor, fecha y pago</div>
                </div>
              </div>

              {/* Step 2 Indicator */}
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  wizardStep === 2
                    ? 'bg-purple-50 border-purple-300 text-purple-900 ring-2 ring-purple-500/20'
                    : wizardStep > 2
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    wizardStep === 2
                      ? 'bg-purple-600 text-white'
                      : wizardStep > 2
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-300 text-slate-600'
                  }`}
                >
                  {wizardStep > 2 ? <Check className="w-4 h-4" /> : '2'}
                </div>
                <div>
                  <div className="text-xs font-extrabold">2. Carga de Productos</div>
                  <div className="text-[10px] text-slate-500">Buscador, cantidades y costo</div>
                </div>
              </div>

              {/* Step 3 Indicator */}
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  wizardStep === 3
                    ? 'bg-purple-50 border-purple-300 text-purple-900 ring-2 ring-purple-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    wizardStep === 3 ? 'bg-purple-600 text-white' : 'bg-slate-300 text-slate-600'
                  }`}
                >
                  3
                </div>
                <div>
                  <div className="text-xs font-extrabold">3. Verificación & Carga</div>
                  <div className="text-[10px] text-slate-500">Suma a inventario y guarda</div>
                </div>
              </div>

            </div>
          </div>

          {/* PASO 1: DATOS DEL RECIBO Y PROVEEDOR */}
          {wizardStep === 1 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>Paso 1: Información General del Recibo / Factura de Compra</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete los datos de la nota de entrega o factura del proveedor.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Número de Recibo */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Número de Recibo / Nota / Factura *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      placeholder="Ej: REC-2026-0012 o FACT-9831"
                      className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 focus:bg-white rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono font-bold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setReceiptNumber(`REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                      title="Generar correlativo"
                    >
                      Auto
                    </button>
                  </div>
                </div>

                {/* Fecha Recibida */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Fecha y Hora de Recepción *
                  </label>
                  <input
                    type="datetime-local"
                    value={receivedAtDate}
                    onChange={(e) => setReceivedAtDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 focus:bg-white rounded-xl px-4 py-2.5 text-xs text-slate-900 font-bold focus:outline-none"
                  />
                </div>

                {/* Seleccionar / Crear Proveedor */}
                <div className="col-span-1 md:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      <span>Proveedor de la Mercancía *</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewSupplierInline(!isAddingNewSupplierInline)}
                      className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {isAddingNewSupplierInline ? '← Seleccionar de la lista' : '+ Registrar Nuevo Proveedor'}
                    </button>
                  </div>

                  {!isAddingNewSupplierInline ? (
                    <div>
                      <select
                        value={selectedSupplierId}
                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-purple-600 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-bold focus:outline-none cursor-pointer"
                      >
                        <option value="">-- Seleccionar Proveedor Guardado --</option>
                        {suppliers.map((sup) => (
                          <option key={sup.id} value={sup.id}>
                            {sup.name} ({sup.rif}) {sup.phone ? `• Tel: ${sup.phone}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white border border-purple-200 rounded-xl p-3 animate-fade-in">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Nombre Comercial *</label>
                        <input
                          type="text"
                          value={newSupplierName}
                          onChange={(e) => setNewSupplierName(e.target.value)}
                          placeholder="Ej: Distribuidora Central C.A."
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">RIF / Cédula *</label>
                        <input
                          type="text"
                          value={newSupplierRif}
                          onChange={(e) => setNewSupplierRif(e.target.value)}
                          placeholder="Ej: J-12345678-9"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Teléfono (Opcional)</label>
                        <input
                          type="text"
                          value={newSupplierPhone}
                          onChange={(e) => setNewSupplierPhone(e.target.value)}
                          placeholder="Ej: 0412-1234567"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Tipo de Pago: CONTADO vs CREDITO */}
                <div className="col-span-1 md:col-span-2 space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Tipo de Pago del Recibo *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentType('CONTADO')}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        paymentType === 'CONTADO'
                          ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 text-purple-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black uppercase flex items-center gap-1.5">
                          <Coins className="w-4 h-4 text-emerald-600" />
                          <span>Pago de Contado</span>
                        </span>
                        {paymentType === 'CONTADO' && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal">
                        Cancelado inmediatamente al recibir el pedido. No genera saldo deudor.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentType('CREDITO')}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        paymentType === 'CREDITO'
                          ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 text-purple-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black uppercase flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span>A Crédito (Cuenta por Pagar)</span>
                        </span>
                        {paymentType === 'CREDITO' && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal">
                        Registra una Cuenta por Pagar al proveedor con fecha de vencimiento.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Sub-fields depending on Payment Type */}
                {paymentType === 'CONTADO' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Método de Pago Utilizado *
                    </label>
                    <select
                      value={paymentMethodStep1}
                      onChange={(e) => setPaymentMethodStep1(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="EFECTIVO_USD">Efectivo ($ USD)</option>
                      <option value="EFECTIVO_BS">Efectivo (Bs. Bolívares)</option>
                      <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                      <option value="PAGO_MOVIL">Pago Móvil</option>
                      <option value="ZELLE">Zelle / Dólar Electrónico</option>
                      <option value="PUNTO_VENTA">Tarjeta de Débito / Punto de Venta</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Fecha Límite de Pago (Vencimiento) *
                    </label>
                    <input
                      type="date"
                      value={dueDateStep1}
                      onChange={(e) => setDueDateStep1(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono font-bold focus:outline-none"
                    />
                  </div>
                )}

                {/* Checkbox IVA */}
                <div className="flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasIva}
                      onChange={(e) => setHasIva(e.target.checked)}
                      className="w-4.5 h-4.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-900">
                      Incluir IVA ({ivaRatePercent}%) en el costo total del recibo
                    </span>
                  </label>
                </div>

              </div>

              {/* Step 1 Actions */}
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleProceedToStep2}
                  className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs transition-all shadow-md shadow-purple-600/20 flex items-center gap-2 cursor-pointer"
                >
                  <span>Siguiente: Cargar Productos</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* PASO 2: BUSCADOR Y CARGA DE PRODUCTOS */}
          {wizardStep === 2 && (
            <div className="space-y-6">
              
              {/* BUSCADOR Y SELECTOR DE PRODUCTOS DE INVENTARIO O NUEVOS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Search className="w-4 h-4 text-purple-600" />
                      <span>Paso 2: Buscador & Carga de Productos Recibidos</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Busque productos existentes por código o nombre, o agregue un producto nuevo no registrado.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartNewProductMode}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-extrabold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4 text-emerald-600" />
                    <span>+ Producto Nuevo (No Registrado)</span>
                  </button>
                </div>

                {/* Real-time Search Box */}
                {!isNewProductMode && (
                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      placeholder="Buscar producto existente en inventario por Nombre o Código de Barras / SKU..."
                      className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 focus:bg-white rounded-xl pl-10 pr-4 py-3 text-xs text-slate-900 font-bold focus:outline-none"
                    />

                    {/* Auto-suggest dropdown */}
                    {filteredInventoryProducts.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto z-30 divide-y divide-slate-100 animate-fade-in">
                        {filteredInventoryProducts.map((prod, idx) => (
                          <button
                            key={`cxp-prod-sugg-${prod.id}-${idx}`}
                            type="button"
                            onClick={() => handleSelectExistingProduct(prod)}
                            className="w-full text-left p-3 hover:bg-purple-50/80 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              {prod.imageUrl ? (
                                <img src={prod.imageUrl} alt={prod.name} className="w-9 h-9 object-cover rounded-lg border border-slate-200" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                              <div>
                                <div className="text-xs font-extrabold text-slate-900">{prod.name}</div>
                                <div className="text-[10px] font-mono text-slate-500">
                                  Barcode: {prod.barcode} • Cat: {prod.category}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-bold font-mono text-slate-900">Stock actual: {prod.stock} {prod.unit}</div>
                              <div className="text-[10px] text-slate-500">Costo actual: ${prod.cost.toFixed(2)}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* FORMULARIO PARA INGRESAR DETALLES DEL PRODUCTO (EXISTENTE O NUEVO) */}
                {(selectedProductForEntry || isNewProductMode) && (
                  <form onSubmit={handleAddItemToReceipt} className="bg-purple-50/60 border border-purple-200 rounded-2xl p-5 space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
                      <span className="text-xs font-black text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span>
                          {isNewProductMode ? 'Creando Producto Nuevo para el Recibo' : `Cargando producto: ${selectedProductForEntry?.name}`}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProductForEntry(null);
                          setIsNewProductMode(false);
                        }}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {/* Name */}
                      <div className="md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Nombre del Producto *</label>
                        <input
                          type="text"
                          value={itemName}
                          onChange={(e) => setItemName(e.target.value)}
                          placeholder="Ej: Harina PAN 1kg"
                          required
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                        />
                      </div>

                      {/* Barcode */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Código de Barras *</label>
                        <input
                          type="text"
                          value={itemBarcode}
                          onChange={(e) => setItemBarcode(e.target.value)}
                          placeholder="750123456789"
                          required
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                        />
                      </div>

                      {/* Category */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Categoría</label>
                        <select
                          value={itemCategory}
                          onChange={(e) => setItemCategory(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                        >
                          <option value="Alimentos">Alimentos</option>
                          <option value="Bebidas">Bebidas</option>
                          <option value="Limpieza">Limpieza</option>
                          <option value="Charcutería">Charcutería</option>
                          <option value="Snacks">Snacks</option>
                          <option value="Lácteos">Lácteos</option>
                          <option value="Cuidado Personal">Cuidado Personal</option>
                          <option value="General">General</option>
                        </select>
                      </div>

                      {/* Unit */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Unidad de Medida</label>
                        <select
                          value={itemUnit}
                          onChange={(e) => setItemUnit(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                        >
                          <option value="UND">UND (Unidades)</option>
                          <option value="KG">KG (Kilogramos)</option>
                          <option value="PAQ">PAQ (Paquete)</option>
                          <option value="CAJA">CAJA (Caja)</option>
                          <option value="BOT">BOT (Botella)</option>
                          <option value="LTR">LTR (Litros)</option>
                        </select>
                      </div>

                      {/* Costo Unitario */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Costo Unitario ($ USD) *</label>
                        <input
                          type="number"
                          step="0.001"
                          value={itemUnitCost}
                          onChange={(e) => handleCostOrMarginChange(e.target.value, itemProfitMargin)}
                          placeholder="Ej: 1.20"
                          required
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                        />
                      </div>

                      {/* UNIDADES RECIBIDAS (SOPORTA +4000) */}
                      <div>
                        <label className="text-[11px] font-bold text-purple-900 block mb-1">
                          Unidades Recibidas * (Ej: 4000)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={itemQuantityReceived}
                          onChange={(e) => setItemQuantityReceived(e.target.value)}
                          placeholder="Ej: 4000"
                          required
                          className="w-full bg-white border-2 border-purple-400 focus:border-purple-600 rounded-xl px-3 py-2 text-xs font-mono font-black text-purple-950 focus:outline-none"
                        />
                      </div>

                      {/* Profit Margin */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">% Margen Ganancia</label>
                        <input
                          type="number"
                          step="0.5"
                          value={itemProfitMargin}
                          onChange={(e) => handleCostOrMarginChange(itemUnitCost, e.target.value)}
                          placeholder="30"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                        />
                      </div>

                      {/* Sale Price */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Precio Venta Sugerido ($ USD)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={itemSalePrice}
                          onChange={(e) => setItemSalePrice(e.target.value)}
                          placeholder="1.71"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-700 focus:outline-none"
                        />
                      </div>

                    </div>

                    {/* Cost Calculations Summary */}
                    {parseFloat(itemUnitCost) > 0 && parseFloat(itemQuantityReceived) > 0 && (
                      <div className="bg-white border border-purple-200 rounded-xl p-3 text-xs flex items-center justify-between font-mono">
                        <span className="text-slate-600">
                          Subtotal de esta línea: <strong className="text-purple-900">${(parseFloat(itemUnitCost) * parseFloat(itemQuantityReceived)).toFixed(2)} USD</strong>
                        </span>
                        <span className="text-slate-500">
                          Equivalente en Bs: <strong className="text-slate-800">Bs. {((parseFloat(itemUnitCost) * parseFloat(itemQuantityReceived)) * bcvRate).toFixed(2)}</strong>
                        </span>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Añadir Producto al Recibo</span>
                      </button>
                    </div>
                  </form>
                )}

              </div>

              {/* LISTADO DE PRODUCTOS CARGADOS EN EL RECIBO */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-purple-600" />
                    <span>Productos Incluidos en este Recibo ({receiptItems.length})</span>
                  </h3>
                  <span className="text-xs font-mono font-bold text-slate-600">
                    Suma total de unidades: <strong className="text-purple-700">{receiptItems.reduce((acc, item) => acc + item.quantityReceived, 0)} {receiptItems[0]?.unit || 'unidades'}</strong>
                  </span>
                </div>

                {receiptItems.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                    <Package className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-500">No ha agregado productos a este recibo aún.</p>
                    <p className="text-[11px] text-slate-400">Use el buscador superior para seleccionar o registrar los productos recibidos.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                          <th className="py-3 px-4">Producto</th>
                          <th className="py-3 px-4 font-mono">Código</th>
                          <th className="py-3 px-4 text-right">Unidades Recibidas</th>
                          <th className="py-3 px-4 text-right">Costo Unit. ($)</th>
                          <th className="py-3 px-4 text-right">Subtotal Costo ($)</th>
                          <th className="py-3 px-4 text-right">Precio Venta ($)</th>
                          <th className="py-3 px-4 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receiptItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.productName} className="w-8 h-8 object-cover rounded-lg border border-slate-200" />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs">
                                    <Package className="w-4 h-4" />
                                  </div>
                                )}
                                <div>
                                  <span className="font-extrabold text-slate-900 block">{item.productName}</span>
                                  <span className="text-[10px] text-slate-500">{item.category} • {item.unit}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-600">{item.productBarcode}</td>
                            <td className="py-3 px-4 text-right font-mono font-black text-purple-800 text-sm">
                              +{item.quantityReceived} {item.unit}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                              ${item.unitCost.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                              ${item.subtotalCost.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                              ${item.calculatedSalePrice.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                                title="Eliminar ítem del recibo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* FINANCIAL TOTALS BREAKDOWN FOR STEP 2 */}
                {receiptItems.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                    <div className="text-xs text-slate-500 font-medium">
                      <span>Recibo con <strong>{receiptItems.length}</strong> ítems cargados. </span>
                      {hasIva ? (
                        <span className="text-purple-700 font-bold">IVA ({ivaRatePercent}%) Aplicado.</span>
                      ) : (
                        <span className="text-slate-400 font-bold">Exento de IVA.</span>
                      )}
                    </div>

                    <div className="flex items-center gap-6 font-mono text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Subtotal Costos:</span>
                        <span className="font-bold text-slate-800">${subtotalReceiptCost.toFixed(2)} USD</span>
                      </div>

                      {hasIva && (
                        <div>
                          <span className="text-slate-500 block text-[10px]">IVA ({ivaRatePercent}%):</span>
                          <span className="font-bold text-purple-700">+${ivaAmountReceipt.toFixed(2)} USD</span>
                        </div>
                      )}

                      <div className="bg-purple-100 border border-purple-200 px-4 py-2 rounded-xl text-right">
                        <span className="text-purple-900 block text-[10px] font-bold uppercase">TOTAL DEL RECIBO:</span>
                        <span className="text-base font-black text-purple-950">${totalReceiptCost.toFixed(2)} USD</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Step 2 Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>

                <button
                  type="button"
                  onClick={handleProceedToStep3}
                  className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs transition-all shadow-md shadow-purple-600/20 flex items-center gap-2 cursor-pointer"
                >
                  <span>Siguiente: Revisar y Confirmar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {/* PASO 3: VERIFICACIÓN Y CONFIRMACIÓN FINAL */}
          {wizardStep === 3 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>Paso 3: Verificación Completa antes de Cargar Inventario</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verifique los detalles del recibo antes de enviar las unidades recibidas a sumar al inventario de forma atómica.
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Proveedor & Recibo */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-purple-600" />
                    <span>Datos del Proveedor & Recibo</span>
                  </h3>
                  <div className="text-xs space-y-1 font-medium text-slate-700">
                    <div>
                      <span className="text-slate-500">Recibo #:</span>{' '}
                      <strong className="font-mono text-purple-900">{receiptNumber}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Proveedor:</span>{' '}
                      <strong>
                        {isAddingNewSupplierInline
                          ? newSupplierName
                          : suppliers.find((s) => s.id === selectedSupplierId)?.name || 'Proveedor General'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">RIF:</span>{' '}
                      <span className="font-mono">
                        {isAddingNewSupplierInline
                          ? newSupplierRif
                          : suppliers.find((s) => s.id === selectedSupplierId)?.rif || 'J-00000000-0'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Fecha Recepción:</span>{' '}
                      <span>{new Date(receivedAtDate).toLocaleString('es-VE')}</span>
                    </div>
                  </div>
                </div>

                {/* Condiciones de Pago */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-purple-600" />
                    <span>Condiciones Financieras de la Compra</span>
                  </h3>
                  <div className="text-xs space-y-1 font-medium text-slate-700">
                    <div>
                      <span className="text-slate-500">Tipo de Pago:</span>{' '}
                      <strong className={paymentType === 'CONTADO' ? 'text-emerald-700' : 'text-amber-700'}>
                        {paymentType === 'CONTADO' ? 'CONTADO (Liquidado)' : 'A CRÉDITO (Cuenta por Pagar)'}
                      </strong>
                    </div>
                    {paymentType === 'CONTADO' ? (
                      <div>
                        <span className="text-slate-500">Método de Pago:</span>{' '}
                        <span className="font-bold">{paymentMethodStep1}</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-slate-500">Fecha Vencimiento:</span>{' '}
                        <span className="font-bold font-mono text-amber-800">{dueDateStep1}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500">Aplica IVA:</span>{' '}
                      <span>{hasIva ? `Sí (${ivaRatePercent}%)` : 'No (Exento)'}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Product Audit Table */}
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
                  Resumen de Productos e Incremento de Stock:
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3 font-mono">Barcode</th>
                        <th className="py-2.5 px-3 text-right">Unidades Recibidas</th>
                        <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                        <th className="py-2.5 px-3 text-right">Total Linea ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {receiptItems.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{item.productName}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{item.productBarcode}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-purple-700">
                            +{item.quantityReceived} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">${item.unitCost.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">${item.subtotalCost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Summary */}
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                  <span>
                    Al confirmar, el sistema sumará las unidades recibidas al inventario y registrará la transacción en el historial.
                  </span>
                </div>

                <div className="text-right font-mono">
                  <div className="text-[11px] text-slate-500">Monto Total a Cargar:</div>
                  <div className="text-xl font-black text-purple-950">${totalReceiptCost.toFixed(2)} USD</div>
                  <div className="text-xs font-bold text-purple-700 font-sans">
                    Bs. {(totalReceiptCost * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a Editar Productos</span>
                </button>

                <button
                  type="button"
                  onClick={handleFinalSubmitReceipt}
                  disabled={isSubmitting}
                  className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Actualizando Inventario...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Confirmar Recibo y Sumar al Inventario</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: HISTORIAL DE RECIBOS DE COMPRA                     */}
      {/* ========================================================= */}
      {activeTab === 'historial' && (
        <div className="space-y-4">
          
          {/* SEARCH AND FILTERS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={receiptSearch}
                onChange={(e) => setReceiptSearch(e.target.value)}
                placeholder="Buscar por Recibo #, Proveedor o RIF..."
                className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'ALL' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Todos ({receipts.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PENDIENTE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'PENDIENTE' ? 'bg-amber-600 text-white' : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}
              >
                Pendientes (CxP)
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PAGADO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'PAGADO' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                }`}
              >
                Saldados / Contado
              </button>
            </div>
          </div>

          {/* TABLE OF RECEIPTS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            {filteredReceipts.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-500">No se encontraron recibos de compra.</p>
                <p className="text-[11px] text-slate-400">Genere su primera recepción de mercancía desde el botón superior.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                      <th className="py-3 px-4">Recibo #</th>
                      <th className="py-3 px-4">Fecha e Hora Ingreso</th>
                      <th className="py-3 px-4">Proveedor</th>
                      <th className="py-3 px-4">Tipo Pago</th>
                      <th className="py-3 px-4 text-right">Monto Total ($)</th>
                      <th className="py-3 px-4 text-right">Saldo Deuda ($)</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReceipts.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-black text-purple-900">
                          {rec.receiptNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {new Date(rec.receivedAt || rec.createdAt).toLocaleString('es-VE')}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-slate-900 block">{rec.supplierName}</span>
                          <span className="text-[10px] font-mono text-slate-500">{rec.supplierRif}</span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700">
                          {rec.paymentType === 'CONTADO' ? 'CONTADO' : `A CRÉDITO (${rec.dueDate || 'S/F'})`}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900">
                          ${rec.totalCost.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-700">
                          ${rec.remainingBalanceUsd.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              rec.status === 'PAGADO'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 mx-auto">
                            <button
                              type="button"
                              onClick={() => setSelectedReceiptDetail(rec)}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                              title="Ver Detalle"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setReceiptToDelete(rec)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-colors cursor-pointer"
                              title="Eliminar Recibo de Compra"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: DIRECTORIO DE PROVEEDORES                          */}
      {/* ========================================================= */}
      {activeTab === 'proveedores' && (
        <div className="space-y-4">
          
          {/* Filter and Search Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                placeholder="Buscar proveedor por nombre, RIF o teléfono..."
                className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-500 font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span>Total: </span>
                <strong className="text-slate-900 font-bold">{filteredSuppliers.length} proveedores</strong>
              </div>
            </div>
          </div>

          {/* Directory Cards Grid */}
          {filteredSuppliers.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-600">No se encontraron proveedores</p>
              <p className="text-xs text-slate-400">Intente buscar con otro término o registre una nueva recepción de compra.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map((sup) => {
                const supplierReceipts = receipts.filter((r) => r.supplierId === sup.id || r.supplierRif === sup.rif);
                const pendingDebtUsd = supplierReceipts
                  .filter((r) => r.status === 'PENDIENTE')
                  .reduce((acc, r) => acc + r.remainingBalanceUsd, 0);
                const totalPurchasesUsd = supplierReceipts.reduce((acc, r) => acc + r.totalCost, 0);
                const totalPaidUsd = supplierReceipts.reduce((acc, r) => acc + r.paidAmountUsd, 0);

                // Available credit notes for this supplier
                const supplierCreditNotes = creditNotes.filter((c) => c.supplierId === sup.id || c.supplierRif === sup.rif);
                const availableCreditUsd = supplierCreditNotes
                  .filter((c) => c.status === 'DISPONIBLE' || c.status === 'PARCIAL')
                  .reduce((acc, c) => acc + c.remainingBalanceUsd, 0);

                return (
                  <div
                    key={sup.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-purple-300 hover:shadow-md transition-all space-y-3.5 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-900 leading-snug line-clamp-1">{sup.name}</h3>
                            <p className="text-xs font-mono font-bold text-purple-800">{sup.rif}</p>
                          </div>
                        </div>

                        {pendingDebtUsd > 0 ? (
                          <span className="text-[10px] font-black bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200 shrink-0">
                            Deuda Activa
                          </span>
                        ) : (
                          <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                            Al Día
                          </span>
                        )}
                      </div>

                      {/* Contact info if any */}
                      {(sup.phone || sup.email) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-mono">
                          {sup.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{sup.phone}</span>
                            </span>
                          )}
                          {sup.email && (
                            <span className="truncate max-w-[160px] text-slate-400">
                              {sup.email}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Financial KPI Summary Card for this Supplier */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs font-mono">
                        
                        {/* Saldo que le debo */}
                        <div className="flex items-baseline justify-between pb-1.5 border-b border-slate-200/70">
                          <span className="text-slate-500 font-sans font-bold text-[11px]">Saldo que le Debo:</span>
                          <div className="text-right">
                            <span className={`text-sm font-black ${pendingDebtUsd > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                              ${pendingDebtUsd.toFixed(2)} USD
                            </span>
                            {pendingDebtUsd > 0 && (
                              <span className="block text-[10px] text-rose-600 font-medium">
                                Bs. {(pendingDebtUsd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Totales Compras y Pagado */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                          <div>
                            <span className="text-slate-400 block text-[10px] font-sans">Total Compras:</span>
                            <strong className="text-slate-800 font-bold">${totalPurchasesUsd.toFixed(2)}</strong>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block text-[10px] font-sans">Total Pagado:</span>
                            <strong className="text-emerald-700 font-bold">${totalPaidUsd.toFixed(2)}</strong>
                          </div>
                        </div>

                        {/* Saldo a Favor por Nota de Crédito si existe */}
                        {availableCreditUsd > 0 && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 px-2 flex items-center justify-between text-[11px] text-emerald-900 font-sans">
                            <span className="flex items-center gap-1 font-bold">
                              <RotateCcw className="w-3 h-3 text-emerald-600" />
                              <span>Nota de Crédito a Favor:</span>
                            </span>
                            <span className="font-mono font-black text-emerald-800">${availableCreditUsd.toFixed(2)}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 font-sans">
                          <span>Notas / Recibos: <strong>{supplierReceipts.length}</strong></span>
                          <span>Pendientes: <strong className={pendingDebtUsd > 0 ? 'text-rose-700' : 'text-slate-700'}>
                            {supplierReceipts.filter(r => r.status === 'PENDIENTE').length}
                          </strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setViewingSupplierId(sup.id)}
                        className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Ver Perfil & Estado de Cuenta</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {pendingDebtUsd > 0 && (
                        <button
                          type="button"
                          onClick={() => setViewingSupplierId(sup.id)}
                          className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Coins className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Abonar al Saldo Pendiente</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: REPORTE DE ANTIGÜEDAD DE SALDOS (AGING REPORT)     */}
      {/* ========================================================= */}
      {activeTab === 'aging' && (
        <AgingReportView
          bcvRate={bcvRate}
          receipts={receipts}
          suppliers={suppliers}
          onSelectSupplier={(supId) => setViewingSupplierId(supId)}
          onOpenPaymentForReceipt={(receipt) => {
            setPaymentTargetReceipt(receipt);
            setPaymentAmount(receipt.remainingBalanceUsd.toString());
            setIsPaymentModalOpen(true);
          }}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL DETALLE COMPLETO DE RECIBO / NOTA DE COMPRA         */}
      {/* ========================================================= */}
      {selectedReceiptDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Recibo de Compra #{selectedReceiptDetail.receiptNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ingresado el {new Date(selectedReceiptDetail.receivedAt || selectedReceiptDetail.createdAt).toLocaleString('es-VE')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceiptDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Proveedor info */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
              <div>
                <span className="text-slate-500 block">Proveedor:</span>
                <strong className="text-slate-900 text-sm block">{selectedReceiptDetail.supplierName}</strong>
                <span className="font-mono text-purple-800">{selectedReceiptDetail.supplierRif}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Condición de Pago:</span>
                <strong className="text-slate-900 block">{selectedReceiptDetail.paymentType}</strong>
                <span className="text-slate-600 font-mono">
                  {selectedReceiptDetail.paymentType === 'CONTADO'
                    ? `Método: ${selectedReceiptDetail.paymentMethod}`
                    : `Vence: ${selectedReceiptDetail.dueDate}`}
                </span>
              </div>
            </div>

            {/* List of items */}
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">Desglose de Productos Recibidos:</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                      <th className="py-2.5 px-3">Producto</th>
                      <th className="py-2.5 px-3 text-right">Cant. Recibida</th>
                      <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedReceiptDetail.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {it.productName}
                          <span className="block text-[10px] font-mono text-slate-400">{it.productBarcode}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-purple-800">
                          +{it.quantityReceived} {it.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">${it.unitCost.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">${it.subtotalCost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment history if applicable */}
            {selectedReceiptDetail.paymentsHistory && selectedReceiptDetail.paymentsHistory.length > 0 && (
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">Historial de Abonos / Pagos:</h4>
                <div className="space-y-1.5">
                  {selectedReceiptDetail.paymentsHistory.map((p, idx) => (
                    <div key={`receipt-pay-${p.id || idx}-${idx}`} className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs font-mono flex items-center justify-between">
                      <div>
                        <span className="font-bold text-emerald-950">${p.amountUsd.toFixed(2)} USD</span>
                        <span className="text-slate-500 text-[10px] block">
                          {new Date(p.date).toLocaleString('es-VE')} • {p.paymentMethod} {p.reference ? `(Ref: ${p.reference})` : ''}
                        </span>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Totals */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between font-mono">
              <div>
                <span className="text-xs text-slate-500 block">Total Recibo: <strong>${selectedReceiptDetail.totalCost.toFixed(2)} USD</strong></span>
                <span className="text-xs text-slate-500 block">Abonado: <strong>${selectedReceiptDetail.paidAmountUsd.toFixed(2)} USD</strong></span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Saldo Pendiente:</span>
                <span className="text-lg font-black text-rose-700">${selectedReceiptDetail.remainingBalanceUsd.toFixed(2)} USD</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              {selectedReceiptDetail.status === 'PENDIENTE' && (
                <button
                  type="button"
                  onClick={() => {
                    setPaymentTargetReceipt(selectedReceiptDetail);
                    setPaymentAmount(selectedReceiptDetail.remainingBalanceUsd.toString());
                    setIsPaymentModalOpen(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Coins className="w-4 h-4" />
                  <span>Abonar / Pagar Deuda</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const target = selectedReceiptDetail;
                  setSelectedReceiptDetail(null);
                  setReceiptToDelete(target);
                }}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar Recibo</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedReceiptDetail(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer ml-auto"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL REGISTRO DE ABONO A PROVEEDOR                       */}
      {/* ========================================================= */}
      {isPaymentModalOpen && paymentTargetReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Abonar a Recibo #{paymentTargetReceipt.receiptNumber}</h3>
                  <p className="text-[11px] text-slate-500">{paymentTargetReceipt.supplierName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterPaymentToSupplier} className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs font-mono">
                <span className="text-slate-500 block">Saldo Deuda Actual:</span>
                <span className="text-lg font-black text-purple-950">${paymentTargetReceipt.remainingBalanceUsd.toFixed(2)} USD</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Monto a Abonar ($ USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  max={paymentTargetReceipt.remainingBalanceUsd}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono font-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Método de Pago *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-bold focus:outline-none"
                >
                  <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                  <option value="PAGO_MOVIL">Pago Móvil</option>
                  <option value="EFECTIVO_USD">Efectivo ($ USD)</option>
                  <option value="EFECTIVO_BS">Efectivo (Bs. Bolívares)</option>
                  <option value="ZELLE">Zelle</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Número de Referencia (Opcional)</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ej: 8849201"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Registrar Abono</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE ADVERTENCIA PARA ELIMINAR NOTA DE COMPRA         */}
      {/* ========================================================= */}
      {receiptToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-rose-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  ¿Eliminar Recibo #{receiptToDelete.receiptNumber}?
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Proveedor: {receiptToDelete.supplierName} • Monto: ${receiptToDelete.totalCost.toFixed(2)} USD
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
              <div className="font-bold flex items-center gap-1.5 text-amber-800 text-sm">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>AVISO IMPORTANTE DE INVENTARIO</span>
              </div>
              <p className="leading-relaxed">
                Al eliminar este recibo de compra, <strong className="text-rose-900 underline">NO se restará automáticamente lo añadido al stock</strong> de los productos.
              </p>
              <p className="leading-relaxed text-slate-700">
                Por favor, verifique cuántas unidades entraron en este recibo e ingrese al módulo de <strong>Inventario</strong> para quitarlas manualmente si lo requiere, o déjelas en el inventario si así lo prefiere.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReceiptToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deletePurchaseReceipt(receiptToDelete.id);
                  setReceipts(getPurchaseReceipts());
                  setCreditNotes(getCreditNotes());
                  setGeneralPayments(getSupplierGeneralPayments());
                  setReceiptToDelete(null);
                  if (onRefreshProducts) onRefreshProducts();
                  showToast(`Nota de compra #${receiptToDelete.receiptNumber} eliminada correctamente.`);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmar Eliminación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-fade-in text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
