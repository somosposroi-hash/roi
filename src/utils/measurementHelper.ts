/**
 * Utility functions and definitions for POS measurement unit conversions (Weight, Length, Volume).
 * 
 * Base Units stored in catalog & inventory:
 * - Weight (Peso): Kilogram (kg)
 * - Length (Longitud): Meter (m)
 * - Volume (Volumen): Liter (L)
 */

export type MeasurementCategory = 'WEIGHT' | 'LENGTH' | 'VOLUME' | 'UNIT';
export type UnitMode = 'BASE' | 'SUB'; // BASE (kg, m, L) vs SUB (g, cm, ml)

export interface UnitConfig {
  category: MeasurementCategory;
  baseUnit: string;        // 'kg', 'm', 'L'
  subUnit: string;         // 'g', 'cm', 'ml'
  baseLabel: string;       // 'Kilos (kg)'
  subLabel: string;        // 'Gramos (g)'
  baseShort: string;       // 'kg'
  subShort: string;        // 'g'
  scale: number;           // 1000 for g/ml, 100 for cm
  defaultStep: number;     // 0.001 or 1
  basePlaceholder: string; // 'Ej: 2.340'
  subPlaceholder: string;  // 'Ej: 100'
}

/**
 * Detects measurement category based on product unit string
 */
export function detectMeasurementCategory(unit: string): MeasurementCategory {
  if (!unit) return 'UNIT';
  const u = unit.toLowerCase().trim();

  // Weight / Peso (kg, g, kilo, kilogramo, gramo, etc.)
  if (
    ['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos', 'g', 'gramo', 'gramos'].includes(u) ||
    u.startsWith('kg') ||
    u === 'g'
  ) {
    return 'WEIGHT';
  }

  // Length / Longitud (m, mts, metro, metros, cm, centimetro, etc.)
  if (
    ['m', 'mts', 'metro', 'metros', 'cm', 'centimetro', 'centímetros', 'centimetros'].includes(u) ||
    u === 'm' ||
    u === 'mts' ||
    u === 'cm'
  ) {
    return 'LENGTH';
  }

  // Volume / Volumen (l, ltr, lts, litro, litros, ml, mililitro, mililitros, bot, botella, frasco)
  if (
    ['l', 'ltr', 'lts', 'litro', 'litros', 'ml', 'mililitro', 'mililitros', 'bot', 'botella', 'botellas', 'frasco'].includes(u) ||
    u.startsWith('ltr') ||
    u.startsWith('lts') ||
    u.startsWith('litr') ||
    u === 'l' ||
    u === 'ml'
  ) {
    return 'VOLUME';
  }

  return 'UNIT';
}

/**
 * Get configuration and conversion rules for a category
 */
export function getMeasurementConfig(category: MeasurementCategory): UnitConfig {
  switch (category) {
    case 'WEIGHT':
      return {
        category: 'WEIGHT',
        baseUnit: 'kg',
        subUnit: 'g',
        baseLabel: 'Kilos (kg)',
        subLabel: 'Gramos (g)',
        baseShort: 'kg',
        subShort: 'g',
        scale: 1000,
        defaultStep: 0.001,
        basePlaceholder: 'Ej: 2.340 kg',
        subPlaceholder: 'Ej: 100 g',
      };
    case 'LENGTH':
      return {
        category: 'LENGTH',
        baseUnit: 'm',
        subUnit: 'cm',
        baseLabel: 'Metros (m)',
        subLabel: 'Centímetros (cm)',
        baseShort: 'm',
        subShort: 'cm',
        scale: 100,
        defaultStep: 0.01,
        basePlaceholder: 'Ej: 2.50 m',
        subPlaceholder: 'Ej: 45 cm',
      };
    case 'VOLUME':
      return {
        category: 'VOLUME',
        baseUnit: 'L',
        subUnit: 'ml',
        baseLabel: 'Litros (L)',
        subLabel: 'Mililitros (ml)',
        baseShort: 'L',
        subShort: 'ml',
        scale: 1000,
        defaultStep: 0.001,
        basePlaceholder: 'Ej: 1.500 L',
        subPlaceholder: 'Ej: 250 ml',
      };
    default:
      return {
        category: 'UNIT',
 baseUnit: 'und',
        subUnit: 'und',
        baseLabel: 'Unidades',
        subLabel: 'Unidades',
        baseShort: 'und',
        subShort: 'und',
        scale: 1,
        defaultStep: 1,
        basePlaceholder: '1',
        subPlaceholder: '1',
      };
  }
}

/**
 * Unified conversion function:
 * Converts input value from cashier (whether entered in Kilos/Metros/Litros or Gramos/cm/ml)
 * into base quantity stored in catalog & inventory (kg, m, L).
 */
export function convertToBaseQuantity(
  inputValue: number,
  mode: UnitMode,
  config: UnitConfig
): number {
  if (isNaN(inputValue) || inputValue <= 0) return 0;
  
  if (mode === 'SUB') {
    // Gramos -> Kilos (/1000)
    // Centímetros -> Metros (/100)
    // Mililitros -> Litros (/1000)
    const baseVal = inputValue / config.scale;
    return Math.round(baseVal * 10000) / 10000;
  }

  // Entered directly in base unit (kg, m, L)
  return Math.round(inputValue * 10000) / 10000;
}

/**
 * Converts base quantity (kg, m, L) to subunit (g, cm, ml) for UI prefilling
 */
export function convertFromBaseQuantity(
  baseValue: number,
  mode: UnitMode,
  config: UnitConfig
): number {
  if (isNaN(baseValue) || baseValue <= 0) return 0;

  if (mode === 'SUB') {
    return Math.round(baseValue * config.scale * 10000) / 10000;
  }

  return Math.round(baseValue * 10000) / 10000;
}

/**
 * Calculates total price for line item: Price_unit * BaseQuantity
 */
export function calculateMeasurementSubtotal(
  pricePerBaseUnit: number,
  baseQuantity: number
): number {
  return Math.round(pricePerBaseUnit * baseQuantity * 100) / 100;
}

/**
 * Formats base quantity nicely for display (e.g., 2.34 kg, 100 g, 0.45 m, 250 ml)
 */
export function formatMeasurementQuantity(
  baseQuantity: number,
  category: MeasurementCategory,
  unitLabel?: string
): string {
  const config = getMeasurementConfig(category);
  
  if (category === 'UNIT') {
    return `${baseQuantity} ${unitLabel || 'und'}`;
  }

  // If base quantity is small (less than 1 base unit), show both base and sub format for clarity
  if (baseQuantity < 1) {
    const subVal = Math.round(baseQuantity * config.scale * 100) / 100;
    return `${baseQuantity} ${config.baseShort} (${subVal} ${config.subShort})`;
  }

  return `${baseQuantity.toFixed(3).replace(/\.?0+$/, '')} ${config.baseShort}`;
}

export interface ScaleBarcodeResult {
  isScaleBarcode: boolean;
  rawBarcode: string;
  plu: string;
  embeddedPrice: number;
  matchedProduct?: any;
  calculatedQuantity?: number;
}

/**
 * Decodes scale label barcodes (EAN-13 / EAN-14 starting with 21 or 20-29).
 * Extracts PLU code and embedded total price or weight.
 * Example EAN-14: 21 + 00 + PLU(2244) + Price(00099 = $0.99) + CheckDigit(4) -> 21002244000994
 * Example EAN-13: 21 + PLU(02244) + Price(00099 = $0.99) + CheckDigit(4) -> 2102244000994
 */
export function parseScaleBarcode(barcode: string, products: any[] = []): ScaleBarcodeResult | null {
  if (!barcode) return null;
  const clean = barcode.trim();

  // Scale barcodes start with 20-29 and are 13 or 14 digits long
  if (!/^(2[0-9])\d{11,12}$/.test(clean)) {
    return null;
  }

  let pluStr = '';
  let priceCentsStr = '';

  if (clean.length === 14 && clean.startsWith('21')) {
    // EAN-14: 21 + 00 + PLU(4 digits) + Price*100(5 digits) + CheckDigit(1 digit)
    pluStr = clean.substring(4, 8);
    priceCentsStr = clean.substring(8, 13);
  } else if (clean.length === 13 && clean.startsWith('21')) {
    // EAN-13: 21 + PLU(5 digits) + Price*100(5 digits) + CheckDigit(1 digit)
    pluStr = clean.substring(2, 7);
    priceCentsStr = clean.substring(7, 12);
  } else if (clean.length === 14) {
    pluStr = clean.substring(3, 8);
    priceCentsStr = clean.substring(8, 13);
  } else {
    pluStr = clean.substring(2, 7);
    priceCentsStr = clean.substring(7, 12);
  }

  const embeddedPrice = parseInt(priceCentsStr, 10) / 100;
  if (isNaN(embeddedPrice)) return null;

  const pluClean = pluStr.replace(/^0+/, '') || pluStr;

  const matched = Array.isArray(products)
    ? products.find((p) => {
        if (!p) return false;
        const pPlu = (p.plu || '').toString().trim().replace(/^0+/, '');
        const pBar = (p.barcode || '').toString().trim().replace(/^0+/, '');
        const pSku = (p.sku || '').toString().trim().replace(/^0+/, '');
        return (
          pPlu === pluClean ||
          pBar === pluClean ||
          pSku === pluClean ||
          p.plu === pluStr ||
          p.barcode === clean
        );
      })
    : undefined;

  let calculatedQuantity = 1;
  if (matched && matched.price > 0) {
    calculatedQuantity = Math.round((embeddedPrice / matched.price) * 10000) / 10000;
  }

  return {
    isScaleBarcode: true,
    rawBarcode: clean,
    plu: pluClean,
    embeddedPrice,
    matchedProduct: matched,
    calculatedQuantity,
  };
}
