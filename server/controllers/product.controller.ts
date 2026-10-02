import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';
import { AppError } from '../domain/errors/app-error';

export class ProductController {
  constructor(private readonly productService: ProductService) {}

  /**
   * GET /api/v1/products/barcode/:barcode
   * Ultra-fast sub-millisecond barcode scan endpoint
   */
  getByBarcode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { barcode } = req.params;

      if (!barcode || barcode.trim() === '') {
        throw new AppError('Código de barras no proporcionado', 400, 'INVALID_BARCODE');
      }

      const result = await this.productService.lookupByBarcode(barcode);

      res.setHeader('X-Lookup-Time-Ms', result.lookupTimeMs.toString());
      res.setHeader('X-Cache-Hit', result.cached ? 'HIT' : 'MISS');

      res.json({
        success: true,
        data: result.product,
        meta: {
          cached: result.cached,
          lookupTimeMs: result.lookupTimeMs,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/products
   * Retrieve all products with inventory levels
   */
  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const products = await this.productService.getAllProducts();
      res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/products/:id/restock
   * Restock product units
   */
  restock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { quantity, reason } = req.body;

      const qty = parseInt(String(quantity), 10);
      if (isNaN(qty) || qty <= 0) {
        throw new AppError('Cantidad de reabastecimiento inválida', 400, 'INVALID_RESTOCK_QUANTITY');
      }

      const updated = await this.productService.restock(id, qty, reason);
      res.json({
        success: true,
        message: `Producto reabastecido exitosamente (+${qty} unidades)`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH/PUT /api/v1/products/:id
   * Update product details, pricing or imageUrl
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, price, wholesalePrice, cost, stock, minStock, category, unit, barcode, sku, imageUrl, isActive, presentationsJson, presentations } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (price !== undefined) updateData.price = parseFloat(String(price));
      if (wholesalePrice !== undefined) updateData.wholesalePrice = wholesalePrice !== null && wholesalePrice !== '' ? parseFloat(String(wholesalePrice)) : null;
      if (cost !== undefined) updateData.cost = parseFloat(String(cost));
      if (stock !== undefined) updateData.stock = parseFloat(String(stock));
      if (minStock !== undefined) updateData.minStock = parseFloat(String(minStock));
      if (category !== undefined) updateData.category = category;
      if (unit !== undefined) updateData.unit = unit;
      if (barcode !== undefined) updateData.barcode = barcode;
      if (sku !== undefined) updateData.sku = sku;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
      
      // Explicitly check for isActive state to handle false correctly
      if (req.body.isActive !== undefined) {
        updateData.isActive = String(req.body.isActive) === 'true';
      }
      if (req.body.isVariablePrice !== undefined) updateData.isVariablePrice = Boolean(req.body.isVariablePrice);
      if (req.body.variablePriceCurrency !== undefined) updateData.variablePriceCurrency = req.body.variablePriceCurrency;

      if (presentations !== undefined) {
        updateData.presentationsJson = JSON.stringify(presentations);
      } else if (presentationsJson !== undefined) {
        updateData.presentationsJson = presentationsJson;
      }
      
      // Handle returnable config if provided
      if (req.body.returnableBottleConfig !== undefined) {
        updateData.returnableBottleConfigJson = JSON.stringify(req.body.returnableBottleConfig);
      }

      const updated = await this.productService.updateProduct(id, updateData);
      res.json({
        success: true,
        message: 'Producto actualizado exitosamente',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/products
   * Create new product with optional photo
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { 
        name, barcode, sku, category, price, wholesalePrice, cost, stock, minStock, unit, imageUrl, 
        presentations, presentationsJson, isVariablePrice, variablePriceCurrency, returnableBottleConfig 
      } = req.body;

      if (!name || !barcode || (isVariablePrice !== true && !price)) {
        throw new AppError('Nombre, código de barras y precio son requeridos', 400, 'MISSING_FIELDS');
      }

      let pJson: string | null = null;
      if (presentations !== undefined) {
        pJson = JSON.stringify(presentations);
      } else if (presentationsJson !== undefined) {
        pJson = presentationsJson;
      }

      const newProduct = await this.productService.createProduct({
        name,
        barcode,
        sku,
        category,
        price: parseFloat(String(price || 0)),
        wholesalePrice: wholesalePrice ? parseFloat(String(wholesalePrice)) : null,
        cost: cost ? parseFloat(String(cost)) : parseFloat(String(price || 0)) * 0.7,
        stock: parseFloat(String(stock || 0)),
        minStock: parseFloat(String(minStock || 5)),
        unit,
        imageUrl,
        presentationsJson: pJson,
        isVariablePrice: Boolean(isVariablePrice),
        variablePriceCurrency: variablePriceCurrency || 'USD',
        returnableBottleConfigJson: returnableBottleConfig ? JSON.stringify(returnableBottleConfig) : null
      });
      res.status(201).json({
        success: true,
        message: 'Producto creado exitosamente',
        data: newProduct,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/products/cache/stats
   * Cache telemetry
   */
  getCacheStats = async (req: Request, res: Response): Promise<void> => {
    const stats = this.productService.getCacheStats();
    res.json({
      success: true,
      data: stats,
    });
  };

  deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.productService.deleteProduct(id);
      res.json({
        success: true,
        message: 'Producto eliminado del catálogo exitosamente',
      });
    } catch (error) {
      next(error);
    }
  };
}
