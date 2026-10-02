import { Product } from '@prisma/client';
import { ProductRepository } from '../repositories/product.repository';
import { cloudSyncService } from './cloud-sync.service';
import { ProductNotFoundError } from '../domain/errors/product-not-found.error';
import { BarcodeLookupResponse } from '../domain/entities/types';
import { AppError } from '../domain/errors/app-error';

interface CachedEntry {
  product: Product;
  cachedAt: number;
}

export class ProductService {
  private readonly memoryCache = new Map<string, CachedEntry>();
  private readonly ttlMs = 1000 * 60 * 5; // 5 minutes TTL
  private hitCount = 0;
  private missCount = 0;

  constructor(private readonly productRepo: ProductRepository = new ProductRepository()) {}

  /**
   * Ultra-fast barcode lookup optimized for POS scanner guns.
   * Leverages in-memory LRU-like dictionary + SQLite indexed fallback.
   * Returns response time in milliseconds with sub-millisecond precision.
   */
  async lookupByBarcode(rawBarcode: string): Promise<BarcodeLookupResponse> {
    const startTime = process.hrtime.bigint();
    const barcode = rawBarcode.trim();

    if (!barcode) {
      throw new ProductNotFoundError(rawBarcode, 'barcode');
    }

    const now = Date.now();
    const cached = this.memoryCache.get(barcode);

    // Cache hit: serve straight from process memory (< 0.2 - 0.5 ms)
    if (cached && now - cached.cachedAt < this.ttlMs) {
      // Robustness check: Ensure cached item is still active
      if (cached.product.isActive === false) {
        this.memoryCache.delete(barcode);
      } else {
        this.hitCount++;
        const endTime = process.hrtime.bigint();
        const lookupTimeMs = Number(endTime - startTime) / 1_000_000;

        return {
          product: cached.product,
          cached: true,
          lookupTimeMs: Number(lookupTimeMs.toFixed(3)),
        };
      }
    }

    // Cache miss: fast indexed query to SQLite WAL (< 1.5 - 3 ms)
    this.missCount++;
    const rawProduct = await this.productRepo.findByBarcode(barcode);

    if (!rawProduct || rawProduct.isActive === false) {
      // Fallback check 1: Scale barcode decoding (EAN-13/EAN-14 Prefix 21 / PLU + Price)
      const allProducts: any[] = await this.getAllProducts();
      if (/^(2[0-9])\d{11,12}$/.test(barcode)) {
        let pluStr = '';
        let priceCentsStr = '';
        if (barcode.length === 14 && barcode.startsWith('21')) {
          pluStr = barcode.substring(4, 8);
          priceCentsStr = barcode.substring(8, 13);
        } else if (barcode.length === 13 && barcode.startsWith('21')) {
          pluStr = barcode.substring(2, 7);
          priceCentsStr = barcode.substring(7, 12);
        } else if (barcode.length === 14) {
          pluStr = barcode.substring(3, 8);
          priceCentsStr = barcode.substring(8, 13);
        } else {
          pluStr = barcode.substring(2, 7);
          priceCentsStr = barcode.substring(7, 12);
        }

        const pluClean = pluStr.replace(/^0+/, '') || pluStr;
        const embeddedPrice = parseInt(priceCentsStr, 10) / 100;

        for (const prod of allProducts) {
          const pPlu = (prod.plu || '').toString().trim().replace(/^0+/, '');
          const pBar = (prod.barcode || '').toString().trim().replace(/^0+/, '');
          const pSku = (prod.sku || '').toString().trim().replace(/^0+/, '');

          if (pPlu === pluClean || pBar === pluClean || pSku === pluClean || prod.plu === pluStr) {
            const endTime = process.hrtime.bigint();
            const lookupTimeMs = Number(endTime - startTime) / 1_000_000;
            return {
              product: {
                ...prod,
                scaleBarcodeData: {
                  rawBarcode: barcode,
                  plu: pluClean,
                  embeddedPrice,
                  calculatedQuantity: prod.price > 0 ? Math.round((embeddedPrice / prod.price) * 10000) / 10000 : 1,
                },
              } as any,
              cached: false,
              lookupTimeMs: Number(lookupTimeMs.toFixed(3)),
            };
          }
        }
      }

      // Fallback check 2: see if barcode matches any product presentation's custom barcode
      for (const prod of allProducts) {
        if (prod.presentations && Array.isArray(prod.presentations)) {
          const matchedPres = prod.presentations.find(
            (pres: any) => pres.enabled && pres.barcode && pres.barcode.trim() === barcode
          );
          if (matchedPres) {
            const endTime = process.hrtime.bigint();
            const lookupTimeMs = Number(endTime - startTime) / 1_000_000;
            return {
              product: {
                ...prod,
                matchedPresentation: matchedPres,
              } as any,
              cached: false,
              lookupTimeMs: Number(lookupTimeMs.toFixed(3)),
            };
          }
        }
      }
      throw new ProductNotFoundError(barcode, 'barcode');
    }

    const product = this.formatProduct(rawProduct);

    // Store in cache for subsequent scans
    this.memoryCache.set(barcode, {
      product,
      cachedAt: now,
    });

    const endTime = process.hrtime.bigint();
    const lookupTimeMs = Number(endTime - startTime) / 1_000_000;

    return {
      product,
      cached: false,
      lookupTimeMs: Number(lookupTimeMs.toFixed(3)),
    };
  }

  /**
   * Warm up cache with hot products on server startup
   */
  async warmupCache(): Promise<number> {
    const products = await this.productRepo.findAll();
    const now = Date.now();
    for (const p of products) {
      this.memoryCache.set(p.barcode, { product: p, cachedAt: now });
    }
    return products.length;
  }

  /**
   * Evict product from cache when stock or details change
   */
  invalidateCache(barcode: string): void {
    this.memoryCache.delete(barcode);
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.memoryCache.clear();
  }

  /**
   * Get cache telemetry stats for monitoring
   */
  getCacheStats() {
    return {
      size: this.memoryCache.size,
      hits: this.hitCount,
      misses: this.missCount,
      totalLookups: this.hitCount + this.missCount,
      hitRatio: (this.hitCount / (this.hitCount + this.missCount || 1)).toFixed(4),
    };
  }

  private formatProduct(p: Product): any {
    let presentations = [];
    if (p.presentationsJson) {
      try {
        presentations = JSON.parse(p.presentationsJson);
      } catch {
        presentations = [];
      }
    }

    let returnableBottleConfig = undefined;
    if (p.returnableBottleConfigJson) {
      try {
        returnableBottleConfig = JSON.parse(p.returnableBottleConfigJson);
      } catch {
        returnableBottleConfig = undefined;
      }
    }

    return {
      ...p,
      presentations,
      returnableBottleConfig,
    };
  }

  /**
   * Retrieve all products with inventory status
   */
  async getAllProducts(): Promise<Product[]> {
    const products = await this.productRepo.findAll(true);
    return products.map((p) => this.formatProduct(p));
  }

  /**
   * Restock a product and invalidate cache
   */
  async restock(productId: string, quantity: number, reason = 'Reabastecimiento Bodega'): Promise<Product> {
    const updated = await this.productRepo.addStock(productId, quantity, reason);
    this.invalidateCache(updated.barcode);
    // Sync to cloud
    cloudSyncService.syncEntity('Product', updated);
    return updated;
  }

  /**
   * Update product properties (including imageUrl)
   */
  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    if (data.barcode) {
      const existing = await this.productRepo.findByBarcode(data.barcode);
      if (existing && existing.id !== id) {
        throw new AppError(`El código de barras "${data.barcode}" ya pertenece a otro producto (${existing.name}).`, 400, 'DUPLICATE_BARCODE');
      }
    }

    if (data.sku) {
      const existingSku = await this.productRepo.findBySku(data.sku);
      if (existingSku && existingSku.id !== id) {
        throw new AppError(`El código SKU "${data.sku}" ya está asignado al producto "${existingSku.name}".`, 400, 'DUPLICATE_SKU');
      }
    }

    const updateData: any = { ...data };
    if (updateData.presentations) {
      updateData.presentationsJson = JSON.stringify(updateData.presentations);
      delete updateData.presentations;
    }
    if (updateData.returnableBottleConfig) {
      updateData.returnableBottleConfigJson = JSON.stringify(updateData.returnableBottleConfig);
      delete updateData.returnableBottleConfig;
    }

    const rawUpdated = await this.productRepo.update(id, updateData);
    const updated = this.formatProduct(rawUpdated);
    this.invalidateCache(updated.barcode);
    this.memoryCache.set(updated.barcode, {
      product: updated,
      cachedAt: Date.now(),
    });
    // Sync to cloud
    cloudSyncService.syncEntity('Product', rawUpdated);
    return updated;
  }

  /**
   * Create a new product and add to memory cache
   */
  async createProduct(data: any): Promise<Product> {
    const rawBarcode = String(data.barcode || '').trim();
    if (!rawBarcode) {
      throw new AppError('El código de barras es requerido.', 400, 'MISSING_BARCODE');
    }

    // Check barcode uniqueness
    const existingBarcode = await this.productRepo.findByBarcode(rawBarcode);
    if (existingBarcode) {
      throw new AppError(`El código de barras "${rawBarcode}" ya pertenece al producto "${existingBarcode.name}".`, 400, 'DUPLICATE_BARCODE');
    }

    // Process and validate SKU
    let finalSku = String(data.sku || '').trim();
    if (finalSku) {
      const existingSku = await this.productRepo.findBySku(finalSku);
      if (existingSku) {
        throw new AppError(`El código SKU "${finalSku}" ya está asignado al producto "${existingSku.name}". Por favor especifique un SKU diferente.`, 400, 'DUPLICATE_SKU');
      }
    } else {
      // Auto-generate unique SKU if not provided
      const baseSku = `SKU-${rawBarcode}`;
      let candidateSku = baseSku;
      let counter = 1;
      while (await this.productRepo.findBySku(candidateSku)) {
        candidateSku = `${baseSku}-${counter}`;
        counter++;
      }
      finalSku = candidateSku;
    }

    const productData = {
      ...data,
      barcode: rawBarcode,
      sku: finalSku,
    };

    if (productData.presentations) {
      productData.presentationsJson = JSON.stringify(productData.presentations);
      delete productData.presentations;
    }

    if (productData.returnableBottleConfig) {
      productData.returnableBottleConfigJson = JSON.stringify(productData.returnableBottleConfig);
      delete productData.returnableBottleConfig;
    }

    const rawNew = await this.productRepo.create(productData);
    const product = this.formatProduct(rawNew);
    
    this.memoryCache.set(product.barcode, {
      product,
      cachedAt: Date.now(),
    });

    // Sync to cloud
    cloudSyncService.syncEntity('Product', rawNew);

    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await this.productRepo.findById(id);
    if (product) {
      this.invalidateCache(product.barcode);
      // Soft-delete / Deactivate product to prevent database constraint crashes and preserve sales history
      const updated = await this.productRepo.update(id, { isActive: false });
      // Sync to cloud
      cloudSyncService.syncEntity('Product', updated);
    }
  }
}
