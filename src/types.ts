export type PresentationType = 'CAJA' | 'COMBO' | 'SIXPACK' | 'BULTO' | 'CUSTOM';

export interface ProductPresentation {
  id: string;
  type: PresentationType;
  name: string; // e.g. "Caja de 12 unds", "Bulto de 20 kg", "Sixpack Cerveza", "Combo Oferta"
  unitsToDeduct: number; // base units (und, kg, m, L) consumed from stock per package
  packagePrice: number; // total package price in USD
  barcode?: string; // custom optional package barcode
  enabled: boolean;
}

export interface Product {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  wholesalePrice?: number | null; // Precio al mayor opcional
  cost: number;
  stock: number;
  minStock: number;
  unit: string;
  imageUrl?: string | null;
  isActive: boolean;
  presentationsJson?: string | null;
  presentations?: ProductPresentation[];
  returnableBottleConfig?: {
    hasReturnableBottle: boolean;
    bottleName?: string;
    emptyBottleStock?: number;
    bottleDepositPrice?: number;
    supplierReturnPackSize?: number;
  };
  isWeighable?: boolean; // Producto Pesable para Balanza Etiquetadora EAN-13/EAN-14
  plu?: string; // Código PLU asignado en la balanza
  isVariablePrice?: boolean; // Producto con precio variable / modificable en POS
  variablePriceCurrency?: 'USD' | 'BS'; // Moneda base para el ingreso del precio variable
}

export interface CartItem {
  product: Product;
  quantity: number;
  presentation?: ProductPresentation; // Selected package presentation if applicable
  effectiveUnitPrice?: number; // Override price per unit/package
  unitsDeductedPerPackage?: number; // Override units deducted per item/package
  isWholesale?: boolean; // Whether wholesale price was applied
}

export interface HeldCart {
  id: string;
  ticketNumber: number; // 0, 1, 2, ...
  createdAt: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  note?: string;
}

export interface SplitPaymentEntry {
  id: string;
  method: 'CASH_USD' | 'CASH_BS' | 'DEBIT_CARD' | 'PAGO_MOVIL' | 'BINANCE' | 'CREDIT';
  currency: 'USD' | 'BS';
  amount: number; // in entered currency
  amountInUsd: number;
  amountInBs: number;
  reference?: string;
  clientName?: string;
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  cashierName: string;
  paymentMethod: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  changeDue: number;
  bcvRate?: number;
  status: string;
  createdAt: string;
  items: SaleItem[];
  notes?: string;
}

export interface RestockAlert {
  id: string;
  productId: string;
  currentStock: number;
  minStock: number;
  severity: 'CRITICAL' | 'WARNING';
  status: string;
  evaluatedAt: string;
  product: {
    name: string;
    barcode: string;
    sku: string;
    category: string;
  };
}

export interface BcvRateInfo {
  usdRate: number;
  eurRate?: number | null;
  usdtRate?: number | null;
  dateLabel: string;
  lastUpdated: string;
  source: string;
  isManualOverride: boolean;
  activeCurrency?: 'USD' | 'EUR' | 'USDT' | 'SCHEDULED' | 'CUSTOM';
  effectiveRate?: number;
  effectiveCurrency?: string;
  activeScheduleName?: string | null;
}

export interface ExchangeRateHistoryItem {
  id: string;
  rateDate: string;
  usdRate: number;
  eurRate?: number | null;
  usdtRate?: number | null;
  previousRate?: number | null;
  variation?: number | null;
  source: string;
  dateLabel?: string | null;
  isManual: boolean;
  userName?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ExchangeRateHistoryStats {
  totalRecords: number;
  currentRate: number;
  maxRate: number;
  minRate: number;
  avgRate: number;
  periodVariation: number;
  lastUpdated: string;
}

export interface RateScheduleItem {
  id: string;
  name: string;
  currencyTarget: 'USD' | 'EUR' | 'USDT' | 'CUSTOM';
  customRateValue?: number | null;
  startTime: string; // "09:00"
  endTime: string;   // "10:00"
  durationType: 'INDEFINITE' | 'DATE_RANGE';
  startDate?: string | null;
  endDate?: string | null;
  daysOfWeek: number[]; // 0=Sunday..6=Saturday
  isActive: boolean;
  priority: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RateConfigData {
  id?: string;
  activeCurrency: 'USD' | 'EUR' | 'USDT' | 'SCHEDULED' | 'CUSTOM';
  customFixedRate?: number | null;
  autoSyncEnabled: boolean;
  syncIntervalMin: number;
  fallbackCurrency: 'USD' | 'EUR' | 'USDT';
  updatedAt?: string;
}

export interface ActiveRateEvaluation {
  effectiveRate: number;
  effectiveCurrency: 'USD' | 'EUR' | 'USDT' | 'CUSTOM';
  currencySymbol: string;
  currencyName: string;
  sourceLabel: string;
  isFromSchedule: boolean;
  activeScheduleName?: string | null;
  activeScheduleWindow?: string | null;
  nextScheduleSwitch?: {
    time: string;
    targetCurrency: string;
    scheduleName: string;
  } | null;
}

export interface AppUser {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
  role?: string;
  imageUrl?: string;
  allowedDepartments?: string[];
  allowedFunctions?: string[];
  canConfigurePrinters?: boolean;
  canModifyManualRate?: boolean;
  cashRegister?: string;
  canViewOtherShifts?: boolean;
  canViewAllSales?: boolean;
  dashboardType?: string;
  canRegisterExpenses?: boolean;
  canApplyDiscountOrSurcharge?: boolean;
  canSellOnCredit?: boolean;
  canVoidSales?: boolean;
}

export interface CronStatus {
  isActive: boolean;
  cronSchedule: string;
  lastRunAt: string | null;
  totalRuns: number;
  recentLogs: Array<{
    timestamp: string;
    durationMs: number;
    criticalCount: number;
    warningCount: number;
    resolvedCount: number;
    status: string;
  }>;
}

export interface UnitTestResult {
  suite: string;
  total: number;
  passed: number;
  failed: number;
  results: Array<{
    name: string;
    passed: boolean;
    durationMs: number;
    error?: string;
  }>;
}

export interface ConcurrencyTestResponse {
  totalRequests: number;
  successful: number;
  failed: number;
  initialStock: number;
  finalStock: number;
  durationMs: number;
  raceConditionDetected: boolean;
  guaranteeNote: string;
  logs: Array<{
    attempt: number;
    success: boolean;
    error?: string;
    timeMs: number;
  }>;
}

export interface Client {
  id: string;
  name: string;
  docType: 'V' | 'E' | 'J' | 'G' | 'P' | 'C' | 'S'; // V, E, J, G, P, C, S
  docNumber: string;
  phone: string;
  notes: string;
  createdAt: string;
  creditLimit?: number; // Límite de crédito opcional en USD
  paymentDayOfMonth?: number; // Día de pago recurrente opcional en el mes (1-31)
  creditDays?: number; // Días de crédito / tolerancia antes de mora (default 15)
}

export type DeliveryNoteCurrency = 'BS' | 'USD' | 'BOTH';

export interface POSConfig {
  // Business / Company Details
  businessName: string;
  businessRif: string;
  businessPhone: string;

  // Delivery Note Customization (POS Checks & Settings)
  deliveryNoteShowBusinessName: boolean;
  deliveryNoteShowBusinessRif: boolean;
  deliveryNoteShowBusinessPhone: boolean;
  deliveryNotePriceCurrency: DeliveryNoteCurrency; // 'BS' (default) | 'USD' | 'BOTH'
  deliveryNoteDisclaimerAccepted: boolean;
  deliveryNoteShowBcvRate: boolean;
  deliveryNoteShowPaymentMethod: boolean;

  debitCardRefRequired: boolean;
  pagoMovilRefRequired: boolean;
  cashBsRefRequired: boolean;
  cashUsdRefRequired: boolean;
  binanceRefRequired: boolean;
  creditRefRequired: boolean;
  splitRefRequired: boolean;
  
  // Client configuration
  useClientData: boolean;
  showClientName: boolean;
  clientNameRequired: boolean;
  showClientRif: boolean;
  clientRifRequired: boolean;
  showClientPhone: boolean;
  clientPhoneRequired: boolean;
  showClientNotes: boolean;
  clientNotesRequired: boolean;

  // Containers (Tobos y Botellas) in POS
  enablePOSContainerCharges?: boolean;
  enableContainerLoans?: boolean;

  // Scale EAN-13/EAN-14 Barcode Decoding
  enableScaleEan13?: boolean;

  // Quantity behavior
  askQuantityInPos?: boolean;

  // New settings
  showPopularProducts: boolean;
  enableDiscountsAndCharges: boolean;
  pagoMovilBankName: string;
  pagoMovilPhone: string;
  pagoMovilRif: string;
  pagoMovilShowBank: boolean;
  pagoMovilShowAccountType: boolean;

  // Wholesale Authorization Password
  wholesalePassword?: string;

  // Cash Outflow (Salidas de Caja Chica) Special Password
  outflowPassword?: string;

  // Sale Void Authorization Password
  voidSalePassword?: string;

  // Printer configuration settings
  printerConnectionType: 'BLUETOOTH' | 'PLUGIN_HTTP' | 'EPSON_EPOS' | 'WEB_USB' | 'SYSTEM_PRINT';
  printerEnabled: boolean;
  printerAutoPrint: boolean;
  printerPaperWidth: '58mm' | '80mm';
  printerAutoCut: boolean;
  printerName: string;
  printerPluginUrl: string;
  printerEpsonIp: string;
  printerEpsonPort: string;
  btDeviceName?: string;
  btDeviceId?: string;
  hideProductPhotosAndEmojis?: boolean;
  sidebarCategories?: SidebarCategory[];
  darkMode?: boolean;
}

export interface SidebarCategory {
  id: string;
  name: string;
  itemIds: string[];
}

export interface Supplier {
  id: string;
  name: string;
  rif: string; // e.g. J-12345678-9 or V-12345678
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface PurchaseReceiptItem {
  id: string;
  productId?: string;
  productName: string;
  productBarcode: string;
  category: string;
  unit: string; // UND, KG, PAQ, LTR, etc.
  minStock: number;
  unitCost: number; // Costo unitario en USD
  quantityReceived: number; // Unidades recibidas
  subtotalCost: number; // unitCost * quantityReceived
  profitMarginPercent: number; // Margen de ganancia
  calculatedSalePrice: number; // Precio de venta
  isNewProduct?: boolean;
  imageUrl?: string | null;
}

export interface PurchaseReceiptPayment {
  id: string;
  date: string;
  amountUsd: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}

export interface PurchaseReceipt {
  id: string;
  receiptNumber: string; // Número de recibo / nota de compra / factura
  supplierId: string;
  supplierName: string;
  supplierRif: string;
  supplierPhone?: string;
  receivedAt: string; // Fecha y hora de recepción (ISO String)
  
  paymentType: 'CONTADO' | 'CREDITO';
  paymentMethod?: string; // If CONTADO
  dueDate?: string; // If CREDITO (Fecha límite de pago)
  
  hasIva: boolean;
  ivaRatePercent: number; // Default 16
  subtotalCost: number;
  taxAmount: number;
  totalCost: number;
  
  items: PurchaseReceiptItem[];
  
  status: 'PAGADO' | 'PENDIENTE' | 'CANCELADO';
  paidAmountUsd: number;
  remainingBalanceUsd: number;
  
  paymentsHistory?: PurchaseReceiptPayment[];
  createdAt: string;
}

export interface SupplierCreditNoteItem {
  id: string;
  productId?: string;
  productBarcode?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  subtotal: number;
  returnReason: 'DEFECTUOSO' | 'VENCIDO' | 'ERROR_DESPACHO' | 'OTRO';
}

export interface SupplierCreditNote {
  id: string;
  code: string; // ej. NC-2026-0001
  supplierId: string;
  supplierName: string;
  supplierRif: string;
  receiptId?: string;
  receiptNumber?: string;
  date: string;
  reason: string;
  notes?: string;
  items: SupplierCreditNoteItem[];
  totalAmountUsd: number;
  appliedAmountUsd: number;
  remainingBalanceUsd: number;
  status: 'DISPONIBLE' | 'PARCIAL' | 'APLICADA' | 'ANULADA';
  appliedToReceipts?: {
    receiptId: string;
    receiptNumber: string;
    appliedAmountUsd: number;
    date: string;
    notes?: string;
  }[];
  createdAt: string;
}

export interface SupplierGeneralPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierRif: string;
  date: string;
  amountUsd: number;
  bcvRateAtPayment: number;
  amountBs: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  amortizedReceipts: {
    receiptId: string;
    receiptNumber: string;
    amortizedAmountUsd: number;
  }[];
  createdAt: string;
}

export interface InventoryAuditItem {
  id: string;
  auditId: string;
  productId: string;
  productName: string;
  categoryName?: string;
  unit: string;
  systemStock: number;
  costPrice: number;
  countedStock: number | null;
  differenceQty: number;
  differenceCost: number;
  salesQty: number;
  inboundQty: number;
  outboundQty: number;
  status: 'PENDING' | 'MATCHED' | 'MISSING' | 'SURPLUS';
  product?: Product;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryAudit {
  id: string;
  code: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  type: 'CATEGORY' | 'MANUAL' | 'ALL';
  categoryFilter?: string;
  startedAt: string;
  completedAt?: string;
  createdBy: string;
  completedBy?: string;
  totalLossCost: number;
  totalSurplusCost: number;
  netDifferenceCost: number;
  items: InventoryAuditItem[];
  _count?: {
    items: number;
  };
  createdAt: string;
  updatedAt: string;
}

export type ComboType = 'FIXED' | 'SELECTABLE';

export interface ComboFixedItem {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  quantity: number; // Configured quantity, e.g. 2, 0.5, 500
  unit: string; // 'UND' | 'KG' | 'G' | 'PAQ' | 'BOT' | 'LTR' | 'ML' | 'MTS' | 'CM'
  unitsToDeduct: number; // Base unit stock deducted from product (e.g. 500 G of KG product = 0.5)
  unitPrice?: number; // Optional unit price breakdown within combo
  imageUrl?: string | null;
}

export interface Combo {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string | null;
  type: ComboType; // 'FIXED' | 'SELECTABLE'
  price: number; // Total combo price in USD
  category?: string;
  isActive: boolean;
  
  // Schedule & Availability Configuration
  isAlwaysAvailable: boolean; // true = 24/7
  availableDays?: number[]; // [0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab]
  hasTimeRange?: boolean;
  startTime?: string; // e.g. "14:00"
  endTime?: string; // e.g. "20:00"
  hasDateRange?: boolean;
  startDate?: string; // "YYYY-MM-DD"
  endDate?: string; // "YYYY-MM-DD"

  // Fixed combo items
  items?: ComboFixedItem[];

  // Beer Bucket (Tobo de Cerveza) configuration
  includesBucket?: boolean; // Whether this combo includes a bucket
  bucketId?: string; // ID of selected BeerBucket from inventory
  bucketQuantity?: number; // Number of buckets included (default: 1)
  isBucketLoanable?: boolean; // Can be loaned to customer with guarantee
  bucketDepositPrice?: number; // Deposit guarantee price in USD

  // Selectable variety combo config
  totalSelectableQuantity?: number; // e.g. 5 units
  selectableProductIds?: string[]; // IDs of products user can choose among
  selectableProducts?: Array<{
    id: string;
    name: string;
    barcode: string;
    imageUrl?: string | null;
    stock: number;
    unit: string;
    price: number;
    category?: string;
  }>;

  createdAt?: string;
  updatedAt?: string;
}

export interface SelectedVarietyItem {
  product: Product;
  quantity: number;
}



