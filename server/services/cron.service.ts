import cron, { ScheduledTask } from 'node-cron';
import { ProductRepository } from '../repositories/product.repository';
import { AlertRepository } from '../repositories/alert.repository';
import { config } from '../config/env';
import { systemConfigService } from './system-config.service';
import { cloudSyncService } from './cloud-sync.service';

export interface CronExecutionLog {
  timestamp: Date;
  durationMs: number;
  criticalCount: number;
  warningCount: number;
  resolvedCount: number;
  status: 'SUCCESS' | 'ERROR';
  errorMessage?: string;
}

export class CronService {
  private task: ScheduledTask | null = null;
  private lastRunAt: Date | null = null;
  private totalRuns = 0;
  private executionLogs: CronExecutionLog[] = [];

  constructor(
    private readonly productRepo: ProductRepository = new ProductRepository(),
    private readonly alertRepo: AlertRepository = new AlertRepository()
  ) {}

  /**
   * Initializes and starts the 60-second local cron job
   */
  start(): void {
    if (this.task) {
      console.log('[CronService] Stock alert cron job is already active.');
      return;
    }

    // Zero-resource overhead: Do not register cron if alerts module is disabled globally
    if (!systemConfigService.isModuleEnabled('alerts')) {
      console.log('[CronService] Módulo "alerts" desactivado en SystemConfig. Cron worker NO registrado en memoria (0% CPU / 0 DB queries).');
      return;
    }

    const schedule = config.cronSchedule; // '* * * * *' (every minute)
    console.log(`[CronService] Initializing 60-second stock evaluation cron (${schedule})...`);

    this.task = cron.schedule(schedule, async () => {
      console.log(`[CronService] [${new Date().toISOString()}] Evaluating inventory stock levels...`);
      await this.evaluateStockNow();
    });

    console.log('[CronService] Stock alert cron job successfully started.');

    // Run initial evaluation right on server startup
    this.evaluateStockNow().catch((err) => {
      console.error('[CronService] Initial startup evaluation error:', err);
    });
  }

  /**
   * Stop the scheduled cron job
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[CronService] Stock alert cron job stopped.');
    }
  }

  /**
   * Core evaluation logic:
   * 1. Fetches all products where stock <= minStock
   * 2. Categorizes severity (CRITICAL if stock <= 0, WARNING if stock <= minStock)
   * 3. Upserts active alerts in RestockAlert table
   * 4. Resolves alerts for products that were restocked
   */
  async evaluateStockNow(): Promise<CronExecutionLog> {
    const startTime = process.hrtime.bigint();
    this.lastRunAt = new Date();
    this.totalRuns++;

    let criticalCount = 0;
    let warningCount = 0;
    let resolvedCount = 0;

    try {
      // 1. Get all low stock products
      const lowStockProducts = await this.productRepo.findLowStockProducts();
      const lowStockIds = new Set<string>();

      for (const product of lowStockProducts) {
        lowStockIds.add(product.id);
        const severity = product.stock <= 0 ? 'CRITICAL' : 'WARNING';
        if (severity === 'CRITICAL') criticalCount++;
        else warningCount++;

        await this.alertRepo.upsertAlert(
          product.id,
          product.stock,
          product.minStock,
          severity
        );
      }

      // 2. Find any active alerts for products that have since been replenished
      const activeAlerts = await this.alertRepo.getActiveAlerts();
      const healthyIdsToResolve = activeAlerts
        .filter((a) => !lowStockIds.has(a.productId))
        .map((a) => a.productId);

      if (healthyIdsToResolve.length > 0) {
        resolvedCount = await this.alertRepo.resolveAlertsForHealthyProducts(healthyIdsToResolve);
      }

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      const log: CronExecutionLog = {
        timestamp: this.lastRunAt,
        durationMs: Number(durationMs.toFixed(2)),
        criticalCount,
        warningCount,
        resolvedCount,
        status: 'SUCCESS',
      };

      this.recordLog(log);
      console.log(
        `[CronService] Stock evaluation finished in ${durationMs.toFixed(2)}ms. Critical: ${criticalCount}, Warning: ${warningCount}, Resolved: ${resolvedCount}`
      );

      return log;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const log: CronExecutionLog = {
        timestamp: this.lastRunAt,
        durationMs: Number(durationMs.toFixed(2)),
        criticalCount,
        warningCount,
        resolvedCount,
        status: 'ERROR',
        errorMessage,
      };

      this.recordLog(log);
      console.error('[CronService] Stock evaluation failed:', error);
      return log;
    }
  }

  private recordLog(log: CronExecutionLog) {
    this.executionLogs.unshift(log);
    if (this.executionLogs.length > 50) {
      this.executionLogs.pop();
    }
  }

  /**
   * Diagnostic and status summary for POS UI
   */
  getStatus() {
    const isModuleEnabled = systemConfigService.isModuleEnabled('alerts');
    return {
      isActive: this.task !== null,
      isModuleEnabled,
      cronSchedule: config.cronSchedule,
      lastRunAt: this.lastRunAt,
      totalRuns: this.totalRuns,
      recentLogs: this.executionLogs.slice(0, 10),
    };
  }
}
