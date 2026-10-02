import { createClient } from '@base44/sdk';
import { prisma } from '../config/database';
import { 
  Product, 
  Sale, 
  SaleItem, 
  CashShift, 
  StockMovement, 
  RestockAlert, 
  CashOutflow, 
  InventoryAudit, 
  InventoryAuditItem, 
  ExchangeRateHistory, 
  RateSchedule, 
  RateConfig, 
  SystemConfig, 
  User 
} from '@prisma/client';

export class CloudSyncService {
  private client: any = null;
  private enabled: boolean = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { id: 'default' }
      });

      if (config?.cloudSyncEnabled && config.cloudAppId && config.cloudToken) {
        this.enabled = true;
        this.client = createClient({
          appId: config.cloudAppId,
          headers: {
            "Authorization": `Bearer ${config.cloudToken}`
          }
        });
        console.log('[CloudSync] SDK Client initialized for App ID:', config.cloudAppId);
      } else {
        this.enabled = false;
        this.client = null;
      }
    } catch (err) {
      console.error('[CloudSync] Initialization error:', err);
    }
  }

  /**
   * Reload configuration from DB (call after settings update)
   */
  async reloadConfig() {
    await this.initialize();
  }

  /**
   * Sync a single entity to the cloud
   */
  async syncEntity(entityName: string, data: any) {
    if (!this.enabled || !this.client) return;

    try {
      // Base44 entities map closely to our Prisma models
      // SDK usage: client.entities[entityName].create(data) or update(...)
      // For simplicity, we use upsert logic if possible, or just create.
      // The provided SDK reference shows create, list, update, get, delete.
      
      // We'll use the local ID as the cloud ID to keep them in sync
      const entity = this.client.entities[entityName];
      if (!entity) {
        console.warn(`[CloudSync] Entity ${entityName} not found in Cloud SDK`);
        return;
      }

      console.log(`[CloudSync] Syncing ${entityName} ID: ${data.id}`);

      // Try to update first, if fail (404), create
      try {
        await entity.update(data.id, data);
      } catch (err: any) {
        // If not found, create
        await entity.create(data);
      }
    } catch (err) {
      console.error(`[CloudSync] Error syncing ${entityName}:`, err);
    }
  }

  /**
   * Bulk sync entities (useful for initial migration or background catch-up)
   */
  async bulkSync(entityName: string, items: any[]) {
    if (!this.enabled || !this.client || items.length === 0) return;

    try {
      const entity = this.client.entities[entityName];
      if (!entity) return;

      console.log(`[CloudSync] Bulk syncing ${items.length} items for ${entityName}`);
      await entity.bulkCreate(items);
    } catch (err) {
      console.error(`[CloudSync] Bulk sync error for ${entityName}:`, err);
    }
  }
}

export const cloudSyncService = new CloudSyncService();
