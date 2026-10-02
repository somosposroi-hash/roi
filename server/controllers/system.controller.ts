import { Request, Response, NextFunction } from 'express';
import { SystemService } from '../services/system.service';
import { systemConfigService } from '../services/system-config.service';
import { cloudSyncService } from '../services/cloud-sync.service';

export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  getCloudConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const config = await systemConfigService.getCloudSyncSettings();
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  };

  updateCloudConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { cloudSyncEnabled, cloudAppId, cloudToken } = req.body;
      await systemConfigService.updateCloudSyncSettings({
        cloudSyncEnabled: Boolean(cloudSyncEnabled),
        cloudAppId,
        cloudToken
      });
      
      // Reload cloud sync service with new credentials
      await cloudSyncService.reloadConfig();

      res.json({ success: true, message: 'Configuración de sincronización actualizada' });
    } catch (error) {
      next(error);
    }
  };

  purgeAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check for a confirmation header or body flag to prevent accidental calls
      const { confirmPurge } = req.body;
      if (confirmPurge !== 'PURGE_ALL_DATA_NOW') {
        res.status(400).json({ 
          success: false, 
          error: 'Confirmación inválida para purgar datos.' 
        });
        return;
      }

      const result = await this.systemService.purgeAllData();
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
