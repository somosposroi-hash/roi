import { Product } from '../types';

/**
 * Returns a fitting, vibrant emoji icon for products that do not have an uploaded photo.
 */
export function getProductEmoji(product: Product): string {
  const name = product.name.toLowerCase();
  const category = (product.category || '').toLowerCase();

  if (name.includes('harina') || name.includes('pan') || name.includes('trigo') || name.includes('arepa')) return '🌾';
  if (name.includes('cerveza') || name.includes('polar') || name.includes('beer')) return '🍺';
  if (name.includes('nutella') || name.includes('chocolate') || name.includes('dulce') || name.includes('galleta')) return '🍫';
  if (name.includes('leche') || name.includes('lacteo') || name.includes('yogurt')) return '🥛';
  if (name.includes('queso') || name.includes('guayanes') || name.includes('parmesano')) return '🧀';
  if (name.includes('ron') || name.includes('whisky') || name.includes('licor') || name.includes('vino')) return '🥃';
  if (name.includes('cafe') || name.includes('café')) return '☕';
  if (name.includes('aceite') || name.includes('oliva') || name.includes('mazeite')) return '🫒';
  if (name.includes('pringles') || name.includes('papa') || name.includes('snack') || name.includes('dorito')) return '🥔';
  if (name.includes('arroz') || name.includes('grano')) return '🍚';
  if (name.includes('pasta') || name.includes('espagueti')) return '🍝';
  if (name.includes('atun') || name.includes('atún') || name.includes('sardina') || name.includes('pescado')) return '🐟';
  if (name.includes('salsa') || name.includes('tomate') || name.includes('ketchup')) return '🥫';
  if (name.includes('jabon') || name.includes('jabón') || name.includes('shampoo') || name.includes('detergente')) return '🧼';
  if (name.includes('jugo') || name.includes('refresco') || name.includes('coca') || name.includes('pepsi')) return '🥤';
  if (name.includes('agua')) return '💧';
  if (name.includes('carne') || name.includes('pollo') || name.includes('jamon') || name.includes('jamón')) return '🥩';

  if (category.includes('licor') || category.includes('bebida')) return '🍾';
  if (category.includes('lacteo') || category.includes('lácteo')) return '🧀';
  if (category.includes('snack')) return '🍿';
  if (category.includes('dulce') || category.includes('importado')) return '🍬';
  if (category.includes('alimento')) return '🛒';

  return '📦';
}

/**
 * Returns products sorted by demand / popularity.
 * Products with higher rotation (like staples, popular snacks, drinks) or non-zero stock come first.
 */
export function getPopularProducts(products: Product[]): Product[] {
  // Priority list of popular keywords in a Bodegón
  const priorityKeywords = ['harina', 'nutella', 'polar', 'cerveza', 'leche', 'cafe', 'café', 'aceite', 'queso', 'ron', 'pringles'];

  return [...products].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    const aPriority = priorityKeywords.findIndex((k) => aName.includes(k));
    const bPriority = priorityKeywords.findIndex((k) => bName.includes(k));

    const aScore = aPriority >= 0 ? aPriority : 999;
    const bScore = bPriority >= 0 ? bPriority : 999;

    if (aScore !== bScore) {
      return aScore - bScore;
    }

    // Secondary: active in stock first
    if ((a.stock > 0 && b.stock <= 0) || (b.stock > 0 && a.stock <= 0)) {
      return b.stock - a.stock;
    }

    return a.name.localeCompare(b.name);
  });
}
