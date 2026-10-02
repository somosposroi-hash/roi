export interface SaleItemRequest {
  productId: string;
  quantity: number;
  unitPrice?: number;
  unitsToDeduct?: number;
  presentationName?: string;
  productName?: string;
  productBarcode?: string;
}

export interface CreateSaleRequest {
  cashierName?: string;
  paymentMethod: 'CASH_USD' | 'CASH_BS' | 'DEBIT_CARD' | 'PAGO_MOVIL' | 'SPLIT' | 'CREDIT' | 'BINANCE';
  amountPaid: number;
  items: SaleItemRequest[];
  notes?: string;
}

export interface SaleItemResponse {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface SaleResponse {
  id: string;
  invoiceNumber: string;
  cashierName: string;
  paymentMethod: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  changeDue: number;
  status: string;
  bcvRate: number;
  createdAt: Date;
  items: SaleItemResponse[];
}

export interface BarcodeLookupResponse {
  product: {
    id: string;
    barcode: string;
    sku: string;
    name: string;
    category: string;
    price: number;
    cost: number;
    stock: number;
    minStock: number;
    unit: string;
    isActive: boolean;
  };
  cached: boolean;
  lookupTimeMs: number;
}

export interface ConcurrencyTestRequest {
  productId: string;
  concurrentRequests: number;
  quantityPerRequest: number;
}

export interface ConcurrencyTestResult {
  totalRequests: number;
  successful: number;
  failed: number;
  initialStock: number;
  finalStock: number;
  durationMs: number;
  raceConditionDetected: boolean;
  logs: Array<{
    attempt: number;
    success: boolean;
    error?: string;
    timeMs: number;
  }>;
}
