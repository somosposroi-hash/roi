import { Combo, ComboFixedItem, Product, SelectedVarietyItem } from '../types';
import { safeFetchJson } from './api';

const STORAGE_KEY = 'bodegon_combos_catalog';

/**
 * Convert quantity from any entered unit (G, KG, ML, LTR, CM, MTS, UND)
 * to the base unit required for stock deduction of the product.
 */
export function calculateUnitsToDeduct(productUnit: string, enteredUnit: string, quantity: number): number {
  const pUnit = (productUnit || 'UND').toUpperCase().trim();
  const eUnit = (enteredUnit || 'UND').toUpperCase().trim();
  const qty = Number(quantity) || 0;

  if (pUnit === 'KG') {
    if (eUnit === 'G' || eUnit === 'GR' || eUnit === 'GRAMOS') return qty / 1000;
    if (eUnit === 'KG' || eUnit === 'KILOS') return qty;
  }
  if (pUnit === 'G' || pUnit === 'GR') {
    if (eUnit === 'KG' || eUnit === 'KILOS') return qty * 1000;
    if (eUnit === 'G' || eUnit === 'GR') return qty;
  }
  if (pUnit === 'LTR' || pUnit === 'L' || pUnit === 'LITRO') {
    if (eUnit === 'ML' || eUnit === 'CC') return qty / 1000;
    if (eUnit === 'LTR' || eUnit === 'L') return qty;
  }
  if (pUnit === 'ML') {
    if (eUnit === 'LTR' || eUnit === 'L') return qty * 1000;
    if (eUnit === 'ML') return qty;
  }
  if (pUnit === 'MTS' || pUnit === 'M' || pUnit === 'METRO') {
    if (eUnit === 'CM') return qty / 100;
    if (eUnit === 'MTS' || eUnit === 'M') return qty;
  }

  return qty;
}

/**
 * Format quantity display with its unit (e.g. 500 G, 1.5 KG, 2 UND)
 */
export function formatComboItemQuantity(item: ComboFixedItem): string {
  const u = (item.unit || 'UND').toUpperCase();
  if (u === 'G' || u === 'GR') {
    return `${item.quantity}g`;
  }
  if (u === 'KG') {
    return `${item.quantity} kg`;
  }
  if (u === 'ML') {
    return `${item.quantity} ml`;
  }
  if (u === 'LTR' || u === 'L') {
    return `${item.quantity} L`;
  }
  return `${item.quantity} ${item.unit}`;
}

export const DAYS_OF_WEEK = [
  { day: 1, label: 'Lunes', short: 'Lun' },
  { day: 2, label: 'Martes', short: 'Mar' },
  { day: 3, label: 'Miércoles', short: 'Mié' },
  { day: 4, label: 'Jueves', short: 'Jue' },
  { day: 5, label: 'Viernes', short: 'Vie' },
  { day: 6, label: 'Sábado', short: 'Sáb' },
  { day: 0, label: 'Domingo', short: 'Dom' },
];

/**
 * Real-time verification of combo availability based on calendar days, hour ranges and manual status.
 */
export function isComboAvailableNow(combo: Combo, atDate: Date = new Date()): { isAvailable: boolean; statusLabel: string; reason?: string } {
  if (!combo.isActive) {
    return { isAvailable: false, statusLabel: 'Desactivado', reason: 'Combo pausado manualmente por administración' };
  }

  if (combo.isAlwaysAvailable) {
    return { isAvailable: true, statusLabel: 'Disponible 24/7' };
  }

  // 1. Check Date Range if active
  if (combo.hasDateRange) {
    const todayIso = atDate.toISOString().slice(0, 10);
    if (combo.startDate && todayIso < combo.startDate) {
      return { 
        isAvailable: false, 
        statusLabel: 'Próximamente', 
        reason: `Promoción inicia el ${combo.startDate}` 
      };
    }
    if (combo.endDate && todayIso > combo.endDate) {
      return { 
        isAvailable: false, 
        statusLabel: 'Finalizado', 
        reason: `Promoción caducó el ${combo.endDate}` 
      };
    }
  }

  // 2. Check Days of Week
  if (combo.availableDays && combo.availableDays.length > 0) {
    const currentDay = atDate.getDay(); // 0-6
    if (!combo.availableDays.includes(currentDay)) {
      const allowedLabels = combo.availableDays
        .map(d => DAYS_OF_WEEK.find(day => day.day === d)?.short || '')
        .filter(Boolean)
        .join(', ');
      return { 
        isAvailable: false, 
        statusLabel: 'Día no disponible', 
        reason: `Disponible únicamente los días: ${allowedLabels}` 
      };
    }
  }

  // 3. Check Hour Time Range
  if (combo.hasTimeRange && combo.startTime && combo.endTime) {
    const currentHours = atDate.getHours().toString().padStart(2, '0');
    const currentMinutes = atDate.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHours}:${currentMinutes}`;

    if (currentTime < combo.startTime || currentTime > combo.endTime) {
      return { 
        isAvailable: false, 
        statusLabel: 'Fuera de Horario', 
        reason: `Horario de venta: ${combo.startTime} a ${combo.endTime}` 
      };
    }
  }

  return { isAvailable: true, statusLabel: 'Disponible Ahora' };
}

/**
 * Checks physical inventory stock of all items comprising a combo to prevent overselling.
 */
export function checkComboStockAvailability(
  combo: Combo, 
  allProducts: Product[]
): { hasStock: boolean; maxCombosAvailable: number; missingProducts: string[] } {
  const prodMap = new Map<string, Product>();
  for (const p of allProducts) {
    prodMap.set(p.id, p);
  }

  if (combo.type === 'FIXED') {
    if (!combo.items || combo.items.length === 0) {
      return { hasStock: true, maxCombosAvailable: 999, missingProducts: [] };
    }

    let minPossible = Infinity;
    const missing: string[] = [];

    for (const item of combo.items) {
      const prod = prodMap.get(item.productId);
      const deductQty = item.unitsToDeduct > 0 ? item.unitsToDeduct : item.quantity;
      if (!prod || prod.stock < deductQty) {
        missing.push(item.productName || prod?.name || 'Producto sin stock');
        minPossible = 0;
      } else {
        const possibleWithThis = Math.floor(prod.stock / deductQty);
        if (possibleWithThis < minPossible) {
          minPossible = possibleWithThis;
        }
      }
    }

    return {
      hasStock: minPossible > 0,
      maxCombosAvailable: minPossible === Infinity ? 0 : minPossible,
      missingProducts: missing
    };
  }

  // If SELECTABLE
  if (combo.type === 'SELECTABLE') {
    const selectableIds = combo.selectableProductIds || [];
    let totalStockAcrossPool = 0;
    for (const pid of selectableIds) {
      const prod = prodMap.get(pid);
      if (prod && prod.stock > 0) {
        totalStockAcrossPool += prod.stock;
      }
    }

    const requiredPerCombo = combo.totalSelectableQuantity || 1;
    const maxCombos = Math.floor(totalStockAcrossPool / requiredPerCombo);

    return {
      hasStock: maxCombos > 0,
      maxCombosAvailable: maxCombos,
      missingProducts: totalStockAcrossPool < requiredPerCombo ? ['Stock total de opciones insuficiente'] : []
    };
  }

  return { hasStock: true, maxCombosAvailable: 999, missingProducts: [] };
}

/**
 * Seed initial sample combos if none exist
 */
export function getInitialDefaultCombos(): Combo[] {
  return [
    {
      id: 'combo-cervezas-5x10',
      name: 'Combo Cervezas Variadas 5x$10',
      description: 'Elige 5 cervezas de cualquier marca disponible por solo $10.00. Descuento exacto por marca seleccionada.',
      imageUrl: 'https://images.unsplash.com/photo-1608270191834-315893d56e63?w=600&auto=format&fit=crop&q=60',
      type: 'SELECTABLE',
      price: 10.00,
      category: 'Licores y Bebidas',
      isActive: true,
      isAlwaysAvailable: true,
      totalSelectableQuantity: 5,
      selectableProductIds: [], // Populated dynamically with available beer products
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'combo-desayuno-criollo',
      name: 'Combo Desayuno Criollo',
      description: '1 Harina P.A.N. 1kg + 1 Café Fama de América 500g + 500g de Queso Guayanés Fresco.',
      imageUrl: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&auto=format&fit=crop&q=60',
      type: 'FIXED',
      price: 8.50,
      category: 'Alimentos',
      isActive: true,
      isAlwaysAvailable: true,
      items: [
        {
          id: 'item-1',
          productId: '',
          productName: 'Harina P.A.N. Blanca 1kg',
          productBarcode: '7591011000012',
          quantity: 1,
          unit: 'PAQ',
          unitsToDeduct: 1,
          unitPrice: 1.40
        },
        {
          id: 'item-2',
          productId: '',
          productName: 'Café Fama de América Molido 500g',
          productBarcode: '7591011000067',
          quantity: 1,
          unit: 'PAQ',
          unitsToDeduct: 1,
          unitPrice: 3.80
        },
        {
          id: 'item-3',
          productId: '',
          productName: 'Queso Guayanés Fresco 500g',
          productBarcode: '7591011000081',
          quantity: 500,
          unit: 'G',
          unitsToDeduct: 0.5,
          unitPrice: 3.30
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'combo-happy-hour',
      name: 'Combo Parrillero Bodegón',
      description: '1 Aceite Mazeite 1L + 2 Atún Margarita 170g + 2 Arroz Mary 1kg en horario especial.',
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=60',
      type: 'FIXED',
      price: 9.90,
      category: 'Alimentos',
      isActive: true,
      isAlwaysAvailable: false,
      availableDays: [1, 2, 3, 4, 5, 6, 0], // Todos los días
      hasTimeRange: true,
      startTime: '10:00',
      endTime: '22:00',
      items: [
        {
          id: 'item-p1',
          productId: '',
          productName: 'Aceite de Maíz Mazeite 1L',
          productBarcode: '7591011000074',
          quantity: 1,
          unit: 'BOT',
          unitsToDeduct: 1,
          unitPrice: 4.10
        },
        {
          id: 'item-p2',
          productId: '',
          productName: 'Atún Margarita en Aceite 170g',
          productBarcode: '7591011000159',
          quantity: 2,
          unit: 'UND',
          unitsToDeduct: 2,
          unitPrice: 1.85
        },
        {
          id: 'item-p3',
          productId: '',
          productName: 'Arroz Mary Tradicional 1kg',
          productBarcode: '7591011000111',
          quantity: 2,
          unit: 'PAQ',
          unitsToDeduct: 2,
          unitPrice: 1.35
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

/**
 * Load combos from local storage with fallback
 */
export function getLocalCombos(): Combo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[combosHelper] Error reading combos from local storage:', e);
  }
  const defaults = getInitialDefaultCombos();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
}

/**
 * Save combos locally and dispatch sync event
 */
export function saveLocalCombos(combos: Combo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(combos));
    window.dispatchEvent(new CustomEvent('bodegon-combos-updated', { detail: combos }));
  } catch (e) {
    console.warn('[combosHelper] Error saving combos locally:', e);
  }
}

/**
 * Synchronize combos with server endpoint /api/v1/combos
 */
export async function syncCombos(): Promise<Combo[]> {
  try {
    const res = await safeFetchJson<Combo[]>('/api/v1/combos');
    if (res?.ok && Array.isArray(res.data) && res.data.length > 0) {
      saveLocalCombos(res.data);
      return res.data;
    }
  } catch (e) {
    console.warn('[combosHelper] Backend sync failed, using local combos:', e);
  }
  return getLocalCombos();
}

/**
 * Save single combo (create or update) to backend & local
 */
export async function persistCombo(combo: Combo): Promise<{ success: boolean; data?: Combo; error?: string }> {
  try {
    const current = getLocalCombos();
    const index = current.findIndex(c => c.id === combo.id);
    let updated: Combo[];
    if (index >= 0) {
      updated = [...current];
      updated[index] = { ...combo, updatedAt: new Date().toISOString() };
    } else {
      updated = [{ ...combo, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...current];
    }
    saveLocalCombos(updated);

    // Call server endpoint
    const res = await safeFetchJson<Combo>('/api/v1/combos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(combo)
    });

    if (res?.ok && res.data) {
      return { success: true, data: res.data };
    }

    return { success: true, data: combo };
  } catch (err: any) {
    console.error('[combosHelper] Error persisting combo:', err);
    return { success: false, error: err.message || 'Error guardando el combo' };
  }
}

/**
 * Delete a combo from server & local storage
 */
export async function removeCombo(comboId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const current = getLocalCombos();
    const updated = current.filter(c => c.id !== comboId);
    saveLocalCombos(updated);

    await safeFetchJson(`/api/v1/combos/${comboId}`, {
      method: 'DELETE'
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error eliminando el combo' };
  }
}
