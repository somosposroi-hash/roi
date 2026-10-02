import { Product, Combo } from '../types';

export interface ReturnableBottleConfig {
  hasReturnableBottle: boolean;
  bottleName?: string; // e.g. "Botella Polar Pilsen 222ml Retornable"
  emptyBottleStock?: number; // Stock actual de botellas vacías
  bottleDepositPrice?: number; // Garantía o valor de reposición ($)
  costPrice?: number; // Costo de adquisición/reposición de la botella vacía ($)
  supplierReturnPackSize?: number; // e.g. 24 or 36 bottles per box/crate
}

export interface BeerBucket {
  id: string;
  name: string; // e.g. "Tobo Polar Metálico Azul", "Tobo Corona Galvanizado"
  brand?: string;
  color?: string;
  totalStock: number; // Total de tobos propiedad del negocio
  loanedStock: number; // Tobos prestados a clientes en la calle
  availableStock: number; // Tobos disponibles en local
  depositPrice: number; // Depósito sugerido de garantía ($)
  costPrice?: number; // Costo de adquisición del tobo ($)
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BucketLoan {
  id: string;
  bucketId: string;
  bucketName: string;
  clientName: string;
  clientPhone?: string;
  clientDoc?: string;
  quantity: number;
  saleId?: string;
  invoiceNumber?: string;
  comboName?: string;
  loanDate: string;
  status: 'ACTIVE' | 'RETURNED';
  depositAmountUsd?: number;
  returnDate?: string;
  notes?: string;
}

export interface BottleMovement {
  id: string;
  productId: string;
  productName: string;
  bottleName: string;
  type: 'SALE_CONSUMED' | 'MANUAL_ADJUST' | 'SUPPLIER_RETURN' | 'CUSTOMER_RETURN';
  quantity: number; // positive = empty bottles added; negative = bottles sent to supplier
  reason: string;
  date: string;
  saleInvoice?: string;
}

const STORAGE_KEYS = {
  EMPTY_BOTTLES: 'nubly_empty_bottles_stock',
  BUCKETS: 'nubly_beer_buckets_inventory',
  BUCKET_LOANS: 'nubly_bucket_loans_registry',
  BOTTLE_MOVEMENTS: 'nubly_bottle_movements_history',
};

// Default preset buckets for bodegones / liquor stores in Venezuela
const DEFAULT_BUCKETS: BeerBucket[] = [
  {
    id: 'bucket-polar-blue',
    name: 'Tobo Polar Pilsen Azul Metálico',
    brand: 'Empresas Polar',
    color: 'Azul',
    totalStock: 30,
    loanedStock: 0,
    availableStock: 30,
    depositPrice: 5.0,
    notes: 'Tobo oficial Polar Pilsen para 10-12 tercios',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bucket-polar-light',
    name: 'Tobo Polar Light Plateado',
    brand: 'Empresas Polar',
    color: 'Plateado / Gris',
    totalStock: 25,
    loanedStock: 0,
    availableStock: 25,
    depositPrice: 5.0,
    notes: 'Tobo Polar Light con destapador lateral',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bucket-solera-green',
    name: 'Tobo Solera Premium Verde',
    brand: 'Solera',
    color: 'Verde / Dorado',
    totalStock: 15,
    loanedStock: 0,
    availableStock: 15,
    depositPrice: 7.0,
    notes: 'Tobo premium Solera Kriek / Reserva',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bucket-zulia-red',
    name: 'Tobo Cerveza Zulia Rojo',
    brand: 'Zulia',
    color: 'Rojo',
    totalStock: 20,
    loanedStock: 0,
    availableStock: 20,
    depositPrice: 5.0,
    notes: 'Tobo metálico clásico Zulia',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bucket-standard-black',
    name: 'Tobo Plástico Alto Impacto Negro',
    brand: 'Genérico',
    color: 'Negro',
    totalStock: 40,
    loanedStock: 0,
    availableStock: 40,
    depositPrice: 3.0,
    notes: 'Tobo plástico resistente para eventos y alquiler',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Helper: Get product returnable config
export function getProductReturnableConfig(product: Product): ReturnableBottleConfig {
  if (product.returnableBottleConfig) {
    return product.returnableBottleConfig;
  }
  if (product.presentationsJson) {
    try {
      const parsed = JSON.parse(product.presentationsJson);
      if (parsed && typeof parsed === 'object' && parsed.returnableBottleConfig) {
        return parsed.returnableBottleConfig;
      }
    } catch {
      // ignore
    }
  }

  // Automatic heuristic for beer & returnable liquor
  const name = product.name.toLowerCase();
  const cat = (product.category || '').toLowerCase();
  const isLiquid = name.includes('polar') || name.includes('solera') || name.includes('zulia') || 
                   name.includes('cerveza') || name.includes('regional') || name.includes('tercio') ||
                   name.includes('botella') || name.includes('malta') || name.includes('retornable') ||
                   cat.includes('licor') || cat.includes('cerveza') || cat.includes('bebida');

  return {
    hasReturnableBottle: isLiquid,
    bottleName: `Botella / Envase ${product.name}`,
    emptyBottleStock: 0,
    costPrice: 0.25,
    bottleDepositPrice: 0.50,
    supplierReturnPackSize: 24,
  };
}

// -------------------------------------------------------------
// EMPTY BOTTLES INVENTORY API
// -------------------------------------------------------------

export function getEmptyBottlesMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EMPTY_BOTTLES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveEmptyBottlesMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.EMPTY_BOTTLES, JSON.stringify(map));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('empty-bottles-updated', { detail: map }));
    }
  } catch (err) {
    console.warn('Error saving empty bottles map:', err);
  }
}

export function getProductEmptyBottleStock(productId: string, fallback = 0): number {
  const map = getEmptyBottlesMap();
  return map[productId] !== undefined ? map[productId] : fallback;
}

export function adjustProductEmptyBottles(
  product: Product,
  delta: number,
  type: BottleMovement['type'] = 'MANUAL_ADJUST',
  reason = 'Ajuste manual de botellas vacías',
  saleInvoice?: string
): number {
  const map = getEmptyBottlesMap();
  const current = map[product.id] !== undefined ? map[product.id] : (product.returnableBottleConfig?.emptyBottleStock || 0);
  const newStock = Math.max(0, current + delta);
  map[product.id] = newStock;
  saveEmptyBottlesMap(map);

  // Record movement
  const config = getProductReturnableConfig(product);
  recordBottleMovement({
    productId: product.id,
    productName: product.name,
    bottleName: config.bottleName || `Botella ${product.name}`,
    type,
    quantity: delta,
    reason,
    date: new Date().toISOString(),
    saleInvoice,
  });

  return newStock;
}

// -------------------------------------------------------------
// BOTTLE MOVEMENTS HISTORY
// -------------------------------------------------------------

export function getBottleMovements(): BottleMovement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOTTLE_MOVEMENTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordBottleMovement(movement: Omit<BottleMovement, 'id'>): void {
  try {
    const current = getBottleMovements();
    const newRecord: BottleMovement = {
      ...movement,
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
    const updated = [newRecord, ...current].slice(0, 300); // Keep last 300
    localStorage.setItem(STORAGE_KEYS.BOTTLE_MOVEMENTS, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bottle-movements-updated', { detail: updated }));
    }
  } catch (err) {
    console.warn('Error saving bottle movement:', err);
  }
}

// -------------------------------------------------------------
// BEER BUCKETS (TOBOS) INVENTORY API
// -------------------------------------------------------------

export function getBeerBuckets(): BeerBucket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUCKETS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.BUCKETS, JSON.stringify(DEFAULT_BUCKETS));
      return DEFAULT_BUCKETS;
    }
    const parsed: BeerBucket[] = JSON.parse(raw);
    return parsed.map((b) => ({
      ...b,
      availableStock: Math.max(0, b.totalStock - (b.loanedStock || 0)),
    }));
  } catch {
    return DEFAULT_BUCKETS;
  }
}

export function saveBeerBuckets(buckets: BeerBucket[]): void {
  try {
    const sanitized = buckets.map((b) => ({
      ...b,
      availableStock: Math.max(0, b.totalStock - (b.loanedStock || 0)),
      updatedAt: new Date().toISOString(),
    }));
    localStorage.setItem(STORAGE_KEYS.BUCKETS, JSON.stringify(sanitized));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('beer-buckets-updated', { detail: sanitized }));
    }
  } catch (err) {
    console.warn('Error saving beer buckets:', err);
  }
}

export function saveOrUpdateBucket(bucket: Partial<BeerBucket> & { name: string; totalStock: number }): BeerBucket {
  const buckets = getBeerBuckets();
  const id = bucket.id || `bucket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const existingIdx = buckets.findIndex((b) => b.id === id);

  const newBucket: BeerBucket = {
    id,
    name: bucket.name.trim(),
    brand: bucket.brand?.trim() || 'General',
    color: bucket.color?.trim() || 'Metal',
    totalStock: Math.max(0, Number(bucket.totalStock) || 0),
    loanedStock: existingIdx >= 0 ? buckets[existingIdx].loanedStock : 0,
    availableStock: Math.max(0, (Number(bucket.totalStock) || 0) - (existingIdx >= 0 ? buckets[existingIdx].loanedStock : 0)),
    depositPrice: Number(bucket.depositPrice) || 5.0,
    notes: bucket.notes?.trim() || '',
    createdAt: existingIdx >= 0 ? buckets[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    buckets[existingIdx] = newBucket;
  } else {
    buckets.unshift(newBucket);
  }

  saveBeerBuckets(buckets);
  return newBucket;
}

export function deleteBeerBucket(bucketId: string): boolean {
  const buckets = getBeerBuckets();
  const target = buckets.find((b) => b.id === bucketId);
  if (target && target.loanedStock > 0) {
    throw new Error(`No se puede eliminar el tobo "${target.name}" porque tiene ${target.loanedStock} unidades prestadas a clientes.`);
  }
  const filtered = buckets.filter((b) => b.id !== bucketId);
  saveBeerBuckets(filtered);
  return true;
}

// -------------------------------------------------------------
// BUCKET LOANS REGISTRY (PRÉSTAMOS DE TOBOS A CLIENTES)
// -------------------------------------------------------------

export function getBucketLoans(): BucketLoan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUCKET_LOANS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveBucketLoans(loans: BucketLoan[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BUCKET_LOANS, JSON.stringify(loans));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bucket-loans-updated', { detail: loans }));
    }
  } catch (err) {
    console.warn('Error saving bucket loans:', err);
  }
}

export function registerBucketLoan(params: {
  bucketId: string;
  clientName: string;
  clientPhone?: string;
  clientDoc?: string;
  quantity: number;
  saleId?: string;
  invoiceNumber?: string;
  comboName?: string;
  depositAmountUsd?: number;
  notes?: string;
}): BucketLoan {
  const buckets = getBeerBuckets();
  const bucketIdx = buckets.findIndex((b) => b.id === params.bucketId);
  if (bucketIdx < 0) {
    throw new Error('El tobo seleccionado no existe en el inventario.');
  }

  const bucket = buckets[bucketIdx];
  const qty = Math.max(1, params.quantity);
  
  if (bucket.availableStock < qty) {
    console.warn(`Alerta: Tobos disponibles insuficientes (${bucket.availableStock} disponibles), pero se registra préstamo.`);
  }

  // Update bucket loaned stock
  bucket.loanedStock = (bucket.loanedStock || 0) + qty;
  bucket.availableStock = Math.max(0, bucket.totalStock - bucket.loanedStock);
  buckets[bucketIdx] = bucket;
  saveBeerBuckets(buckets);

  // Create loan entry
  const loans = getBucketLoans();
  const newLoan: BucketLoan = {
    id: `loan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    bucketId: bucket.id,
    bucketName: bucket.name,
    clientName: params.clientName.trim() || 'Cliente General',
    clientPhone: params.clientPhone?.trim(),
    clientDoc: params.clientDoc?.trim(),
    quantity: qty,
    saleId: params.saleId,
    invoiceNumber: params.invoiceNumber,
    comboName: params.comboName,
    loanDate: new Date().toISOString(),
    status: 'ACTIVE',
    depositAmountUsd: params.depositAmountUsd,
    notes: params.notes,
  };

  loans.unshift(newLoan);
  saveBucketLoans(loans);
  return newLoan;
}

export function returnBucketLoan(loanId: string, notes?: string): boolean {
  const loans = getBucketLoans();
  const loanIdx = loans.findIndex((l) => l.id === loanId);
  if (loanIdx < 0) return false;

  const loan = loans[loanIdx];
  if (loan.status === 'RETURNED') return true;

  // Return to bucket stock
  const buckets = getBeerBuckets();
  const bucketIdx = buckets.findIndex((b) => b.id === loan.bucketId);
  if (bucketIdx >= 0) {
    buckets[bucketIdx].loanedStock = Math.max(0, (buckets[bucketIdx].loanedStock || 0) - loan.quantity);
    buckets[bucketIdx].availableStock = Math.max(0, buckets[bucketIdx].totalStock - buckets[bucketIdx].loanedStock);
    saveBeerBuckets(buckets);
  }

  // Mark loan as returned
  loan.status = 'RETURNED';
  loan.returnDate = new Date().toISOString();
  if (notes) {
    loan.notes = loan.notes ? `${loan.notes} • ${notes}` : notes;
  }
  loans[loanIdx] = loan;
  saveBucketLoans(loans);

  return true;
}

// -------------------------------------------------------------
// AUTOMATIC SALE HOOK: INCREMENT EMPTY BOTTLES & PROCESS COMBO TOBOS
// -------------------------------------------------------------

export function processSaleContainers(params: {
  items: Array<{
    productId?: string;
    productBarcode?: string;
    productName: string;
    quantity: number;
    presentation?: any;
    comboDetails?: Combo;
  }>;
  products: Product[];
  invoiceNumber: string;
  client?: { name: string; phone?: string; docNumber?: string };
  loanBucketForCombos?: boolean;
}): void {
  const { items, products, invoiceNumber, client, loanBucketForCombos = false } = params;

  for (const item of items) {
    // 1. Direct product sale with returnable bottle
    if (item.productId) {
      const prod = products.find((p) => p.id === item.productId || p.barcode === item.productBarcode);
      if (prod) {
        const config = getProductReturnableConfig(prod);
        if (config.hasReturnableBottle) {
          const unitsPerItem = item.presentation?.unitsToDeduct || 1;
          const totalEmptyBottles = item.quantity * unitsPerItem;
          
          adjustProductEmptyBottles(
            prod,
            totalEmptyBottles,
            'SALE_CONSUMED',
            `Venta en POS (+${totalEmptyBottles} botellas vacías acumuladas)`,
            invoiceNumber
          );
        }
      }
    }

    // 2. Combo items check (fixed items or selectable items)
    if (item.comboDetails) {
      const combo = item.comboDetails;
      
      // If combo includes a bucket and loan is requested
      if (combo.includesBucket && combo.bucketId && loanBucketForCombos) {
        try {
          registerBucketLoan({
            bucketId: combo.bucketId,
            clientName: client?.name || 'Cliente POS (Combo Cervezas)',
            clientPhone: client?.phone,
            clientDoc: client?.docNumber,
            quantity: (combo.bucketQuantity || 1) * item.quantity,
            invoiceNumber,
            comboName: combo.name,
            depositAmountUsd: combo.bucketDepositPrice || 0,
            notes: `Préstamo automático por venta de combo "${combo.name}"`,
          });
        } catch (e) {
          console.warn('Could not register automatic combo bucket loan:', e);
        }
      }

      // If combo contains beers with returnable bottles in items
      if (combo.items && Array.isArray(combo.items)) {
        for (const fixedItem of combo.items) {
          const prod = products.find((p) => p.id === fixedItem.productId || p.barcode === fixedItem.productBarcode);
          if (prod) {
            const config = getProductReturnableConfig(prod);
            if (config.hasReturnableBottle) {
              const emptyQty = (fixedItem.unitsToDeduct || fixedItem.quantity || 1) * item.quantity;
              adjustProductEmptyBottles(
                prod,
                emptyQty,
                'SALE_CONSUMED',
                `Venta de Combo "${combo.name}" (+${emptyQty} botellas vacías)`,
                invoiceNumber
              );
            }
          }
        }
      }
    }
  }
}
