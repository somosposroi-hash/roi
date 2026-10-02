import { AuditRepository } from '../repositories/audit.repository';
import { ProductRepository } from '../repositories/product.repository';
import { AppError } from '../domain/errors/app-error';

export class AuditService {
  constructor(
    private readonly auditRepo: AuditRepository = new AuditRepository(),
    private readonly productRepo: ProductRepository = new ProductRepository()
  ) {}

  async listAudits(status?: string) {
    return this.auditRepo.findAll(status);
  }

  async getAudit(id: string) {
    if (!id) throw new AppError('ID de auditoría no especificado', 400, 'MISSING_ID');
    const audit = await this.auditRepo.findById(id);
    if (!audit) throw new AppError('Auditoría no encontrada', 404, 'AUDIT_NOT_FOUND');
    return audit;
  }

  async startAudit(params: {
    type: 'CATEGORY' | 'MANUAL' | 'ALL';
    category?: string;
    productIds?: string[];
    createdBy?: string;
  }) {
    const { type, category, productIds, createdBy } = params;

    let targetProducts: Array<{
      id: string;
      name: string;
      category?: string | null;
      unit: string;
      stock: number;
      cost: number;
    }> = [];

    const allProducts = await this.productRepo.findAll();
    const activeProducts = allProducts.filter((p) => p.isActive);

    if (type === 'CATEGORY') {
      if (!category || !category.trim()) {
        throw new AppError('Debe seleccionar una categoría para auditar', 400, 'MISSING_CATEGORY');
      }
      targetProducts = activeProducts.filter(
        (p) => (p.category || '').toLowerCase() === category.trim().toLowerCase()
      );
    } else if (type === 'MANUAL') {
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        throw new AppError('Debe seleccionar al menos un producto para la auditoría', 400, 'MISSING_PRODUCTS');
      }
      const set = new Set(productIds);
      targetProducts = activeProducts.filter((p) => set.has(p.id));
    } else if (type === 'ALL') {
      targetProducts = activeProducts;
    } else {
      throw new AppError('Tipo de auditoría no válido (debe ser CATEGORY, MANUAL o ALL)', 400, 'INVALID_TYPE');
    }

    if (targetProducts.length === 0) {
      throw new AppError('No se encontraron productos activos para auditar con el criterio especificado', 400, 'NO_PRODUCTS');
    }

    return this.auditRepo.createAudit({
      type,
      categoryFilter: type === 'CATEGORY' ? category : undefined,
      createdBy: createdBy || 'Admin',
      products: targetProducts.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit || 'UND',
        stock: p.stock,
        cost: p.cost,
      })),
    });
  }

  async saveProgress(
    auditId: string,
    items: Array<{ itemId: string; countedStock: number | null }>
  ) {
    if (!auditId) throw new AppError('ID de auditoría no especificado', 400);
    if (!Array.isArray(items)) throw new AppError('La lista de conteos es inválida', 400);
    return this.auditRepo.saveProgress(auditId, items);
  }

  async closeAudit(
    auditId: string,
    data: {
      itemsCounts: Array<{ itemId: string; countedStock: number }>;
      completedBy?: string;
    }
  ) {
    if (!auditId) throw new AppError('ID de auditoría no especificado', 400);
    if (!data.itemsCounts || !Array.isArray(data.itemsCounts) || data.itemsCounts.length === 0) {
      throw new AppError('Debe enviar los conteos físicos de los productos', 400);
    }

    return this.auditRepo.closeAudit(auditId, {
      itemsCounts: data.itemsCounts,
      completedBy: data.completedBy || 'Auditor',
    });
  }

  async cancelAudit(auditId: string) {
    if (!auditId) throw new AppError('ID de auditoría no especificado', 400);
    return this.auditRepo.cancelAudit(auditId);
  }
}
