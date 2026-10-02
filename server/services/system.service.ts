import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../config/database';

export class SystemService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  /**
   * Purge all transactional and inventory data from the system.
   * Keeps SystemConfig and basic RateConfig.
   */
  async purgeAllData(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[SystemService] Starting full system purge...');

      // Order matters due to foreign keys if they were strictly enforced, 
      // but in SQLite we can just run them in a transaction or sequential deletes.
      await this.db.$transaction([
        // 1. Transactional Data
        this.db.saleItem.deleteMany(),
        this.db.stockMovement.deleteMany(),
        this.db.restockAlert.deleteMany(),
        this.db.cashOutflow.deleteMany(),
        this.db.sale.deleteMany(),
        this.db.cashShift.deleteMany(),
        
        // 2. Inventory Audits
        this.db.inventoryAuditItem.deleteMany(),
        this.db.inventoryAudit.deleteMany(),

        // 3. Inventory Catalog
        this.db.product.deleteMany(),

        // 4. Exchange Rate History
        this.db.exchangeRateHistory.deleteMany(),
        this.db.rateSchedule.deleteMany(),
        
        // 5. Users (Delete all except maybe keep configuration?)
        // If we delete all users, we must ensure onboarding can start again.
        this.db.user.deleteMany(),
      ]);

      console.log('[SystemService] Full system purge completed successfully.');
      return {
        success: true,
        message: 'Todos los datos (Ventas, Inventario, Usuarios, Turnos) han sido eliminados correctamente.'
      };
    } catch (error: any) {
      console.error('[SystemService] Error during system purge:', error);
      throw new Error(`Error al purgar los datos: ${error.message}`);
    }
  }
}
