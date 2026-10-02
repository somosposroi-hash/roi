import { Request, Response, NextFunction } from 'express';
import { systemConfigService } from '../services/system-config.service';

export interface RequireModuleOptions {
  /**
   * If true, safe read methods (GET, HEAD, OPTIONS) are allowed in read-only mode
   * to ensure historical reporting and financial aggregations never break.
   * All write operations (POST, PUT, PATCH, DELETE) remain strictly blocked with HTTP 403.
   * Default: true
   */
  allowReadOnly?: boolean;
}

/**
 * Global optimization & security middleware for optional modules.
 * 
 * - When enabled: Zero overhead pass-through.
 * - When disabled:
 *   1. Write methods (POST, PUT, PATCH, DELETE) -> HTTP 403 (MODULE_DISABLED).
 *   2. Read methods (GET) -> Allowed in Read-Only mode for historical records and aggregated reports,
 *      or blocked if allowReadOnly is false.
 */
export function requireModule(moduleId: string, options: RequireModuleOptions = { allowReadOnly: true }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const isEnabled = systemConfigService.isModuleEnabled(moduleId);
    if (isEnabled) {
      return next();
    }

    const method = req.method.toUpperCase();
    const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (isWriteMethod) {
      return res.status(403).json({
        success: false,
        error: `Módulo desactivado: El módulo '${moduleId}' se encuentra inactivo en la configuración del sistema. Las operaciones de escritura y modificación no están permitidas.`,
        moduleDisabled: true,
        code: 'MODULE_DISABLED',
        module: moduleId,
        readOnly: true,
        timestamp: new Date().toISOString()
      });
    }

    // Read methods (GET, HEAD, OPTIONS)
    if (options.allowReadOnly) {
      res.setHeader('X-Module-Status', 'INACTIVE_READ_ONLY');
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `El módulo '${moduleId}' se encuentra desactivado globalmente en la configuración del sistema.`,
      moduleDisabled: true,
      code: 'MODULE_DISABLED',
      module: moduleId,
      timestamp: new Date().toISOString()
    });
  };
}

