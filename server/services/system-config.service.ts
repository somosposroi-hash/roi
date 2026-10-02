import { prisma } from '../config/database';

export const CORE_MODULES = ['auth', 'pos', 'inventory', 'config'] as const;
export type CoreModuleId = typeof CORE_MODULES[number];

export const OPTIONAL_MODULES = [
  'combos',
  'kardex',
  'cxc',
  'cxp',
  'audits',
  'alerts',
  'clients',
  'shifts',
  'sales',
  'envases',
  'balanza',
  'open_price'
] as const;
export type OptionalModuleId = typeof OPTIONAL_MODULES[number];

export type ModuleId = CoreModuleId | OptionalModuleId;

export interface ModuleInfo {
  id: string;
  name: string;
  category: 'core' | 'optional';
  isCore: boolean;
  description: string;
  resourceImpact: string;
}

export const MODULE_REGISTRY: Record<string, ModuleInfo> = {
  auth: {
    id: 'auth',
    name: 'Autenticación & Usuarios',
    category: 'core',
    isCore: true,
    description: 'Control de sesiones, contraseñas y permisos de acceso al sistema.',
    resourceImpact: 'Esencial: requerido para la seguridad del software.'
  },
  pos: {
    id: 'pos',
    name: 'Punto de Venta Fundamental',
    category: 'core',
    isCore: true,
    description: 'Escaneo de códigos de barra, cálculo de impuestos, tickets y cobro rápido.',
    resourceImpact: 'Esencial: motor central de facturación con caché en memoria.'
  },
  inventory: {
    id: 'inventory',
    name: 'Gestión Básica de Inventario',
    category: 'core',
    isCore: true,
    description: 'Catálogo de productos, precios en dólares/bolívares, existencias y costos.',
    resourceImpact: 'Esencial: tabla principal de productos de alta velocidad.'
  },
  config: {
    id: 'config',
    name: 'Configuración del Sistema',
    category: 'core',
    isCore: true,
    description: 'Ajustes generales del negocio, tasa BCV, impresoras y parámetros del POS.',
    resourceImpact: 'Esencial: orquestación de parámetros y entorno del negocio.'
  },
  combos: {
    id: 'combos',
    name: 'Combos & Paquetes Promocionales',
    category: 'optional',
    isCore: false,
    description: 'Combos de productos fijos o variados/seleccionables con control de inventario y horarios.',
    resourceImpact: 'Al desactivar: desactiva el motor de combos, horarios y botón de combos en el POS.'
  },
  cxc: {
    id: 'cxc',
    name: 'Cuentas por Cobrar (CxC)',
    category: 'optional',
    isCore: false,
    description: 'Créditos, límites de endeudamiento a clientes y registro de abonos parciales.',
    resourceImpact: 'Al desactivar: cancela consultas de deudas pendientes y previene bloqueos de crédito.'
  },
  cxp: {
    id: 'cxp',
    name: 'Cuentas por Pagar (CxP)',
    category: 'optional',
    isCore: false,
    description: 'Gestión de compras a crédito de proveedores y cronograma de vencimientos.',
    resourceImpact: 'Al desactivar: elimina tablas de pasivos y recálculo de deudas a suplidores.'
  },
  audits: {
    id: 'audits',
    name: 'Auditorías Físicas de Inventario',
    category: 'optional',
    isCore: false,
    description: 'Conteos cíclicos a ciegas, cálculo de mermas, sobrantes y reconciliación de stock.',
    resourceImpact: 'Al desactivar: ahorra snapshots de tablas y consultas transaccionales de conteo.'
  },
  alerts: {
    id: 'alerts',
    name: 'Alertas de Stock & Cron 60s',
    category: 'optional',
    isCore: false,
    description: 'Servicio en segundo plano que examina cada 60s existencias mínimas para compras.',
    resourceImpact: 'Al desactivar: detiene el Cron Job en segundo plano (0% CPU, 0 consultas periódicas a BD).'
  },
  clients: {
    id: 'clients',
    name: 'Directorio de Clientes',
    category: 'optional',
    isCore: false,
    description: 'Fichas con RIF/Cédula, dirección, teléfonos y contactos de clientes.',
    resourceImpact: 'Al desactivar: omite búsquedas e índices de directorio en el proceso de venta.'
  },
  kardex: {
    id: 'kardex',
    name: 'Kardex & Trazabilidad Histórica',
    category: 'optional',
    isCore: false,
    description: 'Bitácora inmutable de cada entrada, salida, ajuste y venta con costos unitarios.',
    resourceImpact: 'Al desactivar: reduce escrituras intensivas en disco y consultas de auditoría.'
  },
  shifts: {
    id: 'shifts',
    name: 'Arqueo de Caja & Turnos',
    category: 'optional',
    isCore: false,
    description: 'Aperturas de turno, cuadre ciego por método de pago, egresos de caja y reportes X/Z.',
    resourceImpact: 'Al desactivar: agiliza cobros continuos sin restricciones de turno previo.'
  },
  sales: {
    id: 'sales',
    name: 'Historial de Ventas Recientes',
    category: 'optional',
    isCore: false,
    description: 'Consulta, auditoría, anulación y reimpresión de facturas y notas de entrega.',
    resourceImpact: 'Al desactivar: desactiva consultas de agregación y listado de transacciones pasadas.'
  },
  envases: {
    id: 'envases',
    name: 'Envases, Botellas Vacías & Tobos',
    category: 'optional',
    isCore: false,
    description: 'Control de botellas vacías, depósito/garantías y tobos de cerveza.',
    resourceImpact: 'Gestión especializada para licorerías y bodegones.'
  },
  balanza: {
    id: 'balanza',
    name: '⚖️ Balanza Etiquetadora & Productos Pesables',
    category: 'optional',
    isCore: false,
    description: 'Lectura de códigos EAN-13/EAN-14 (Prefijo 21 / PLU + Precio) para carnicerías y charcuterías.',
    resourceImpact: 'Decodificación dinámica de peso y precio al escanear etiquetas.'
  },
  open_price: {
    id: 'open_price',
    name: '🏷️ Productos con Precio Modificable (Open Price)',
    category: 'optional',
    isCore: false,
    description: 'Permite crear productos genéricos cuyo precio se ingresa manualmente en el POS.',
    resourceImpact: 'Flexibilidad: Permite vender productos sin precio fijo o servicios eventuales.'
  }
};

class SystemConfigService {
  private activeModules: Set<string> = new Set([
    ...CORE_MODULES,
    ...OPTIONAL_MODULES
  ]);
  private isInitialized = false;
  private onModuleStatusChangeListeners: Array<(moduleId: string, isEnabled: boolean) => void> = [];

  /**
   * Initialize in-memory cache from database at server startup
   */
  async initialize(): Promise<void> {
    try {
      const configRecord = await prisma.systemConfig.findUnique({
        where: { id: 'default' }
      });

      if (configRecord && configRecord.enabledModules) {
        try {
          const parsed = JSON.parse(configRecord.enabledModules);
          if (Array.isArray(parsed)) {
            this.activeModules = new Set<string>([
              ...CORE_MODULES,
              ...parsed
            ]);
            console.log(`[SystemConfig] Active modules loaded from DB:`, Array.from(this.activeModules));
          }
        } catch (e) {
          console.warn('[SystemConfig] Error parsing enabledModules JSON, using defaults:', e);
        }
      } else {
        // Create initial default row in DB
        const defaultList = [...OPTIONAL_MODULES];
        await prisma.systemConfig.upsert({
          where: { id: 'default' },
          update: { enabledModules: JSON.stringify(defaultList) },
          create: {
            id: 'default',
            enabledModules: JSON.stringify(defaultList)
          }
        });
        console.log('[SystemConfig] Default modular configuration created in DB.');
      }
      this.isInitialized = true;
    } catch (err) {
      console.error('[SystemConfig] Error initializing SystemConfig from DB:', err);
      // Fallback: keep all enabled so nothing breaks
      this.activeModules = new Set<string>([...CORE_MODULES, ...OPTIONAL_MODULES]);
      this.isInitialized = true;
    }
  }

  /**
   * Ultra-fast O(1) in-memory check. Zero database queries. Zero async penalty.
   */
  isModuleEnabled(moduleId: string): boolean {
    // Core modules are permanently active
    if (CORE_MODULES.includes(moduleId as CoreModuleId)) {
      return true;
    }
    return this.activeModules.has(moduleId);
  }

  /**
   * Get current state of modules
   */
  getModulesStatus() {
    const enabled = Array.from(this.activeModules);
    const disabled = OPTIONAL_MODULES.filter(m => !this.activeModules.has(m));

    return {
      coreModules: Array.from(CORE_MODULES),
      optionalModules: Array.from(OPTIONAL_MODULES),
      enabledModules: enabled,
      disabledModules: disabled,
      registry: MODULE_REGISTRY
    };
  }

  /**
   * Register a listener for module status changes (e.g. starting/stopping background workers)
   */
  onModuleStatusChange(callback: (moduleId: string, isEnabled: boolean) => void) {
    this.onModuleStatusChangeListeners.push(callback);
  }

  /**
   * Pre-check validation: Verifies whether a module can be safely deactivated.
   * Prevents deactivation if open shifts, in-progress audits, pending receivables or payable debts exist.
   * GUARANTEE: Never drops tables or deletes rows. Foreign keys remain 100% intact.
   */
  async canDisableModule(
    moduleId: string, 
    context?: { clients?: any[]; suppliers?: any[] }
  ): Promise<{ canDisable: boolean; reason?: string; details?: any }> {
    // Core modules can never be disabled
    if (CORE_MODULES.includes(moduleId as CoreModuleId)) {
      return {
        canDisable: false,
        reason: `El módulo '${moduleId}' es parte del Núcleo Fundamental del sistema y no puede ser desactivado.`
      };
    }

    try {
      // 1. Module: 'audits' (Physical Inventory Audits)
      if (moduleId === 'audits') {
        const inProgressAudit = await prisma.inventoryAudit.findFirst({
          where: { status: 'IN_PROGRESS' },
          include: {
            items: true
          }
        });

        if (inProgressAudit) {
          return {
            canDisable: false,
            reason: `No se puede desactivar el módulo de 'Auditorías': La auditoría #${inProgressAudit.code || 1} se encuentra actualmente EN PROGRESO con ${inProgressAudit.items.length} productos en conteo. Debe finalizarla o cancelarla antes de desactivar el módulo.`,
            details: {
              auditId: inProgressAudit.id,
              auditCode: inProgressAudit.code,
              startedAt: inProgressAudit.startedAt,
              itemsCount: inProgressAudit.items.length
            }
          };
        }
      }

      // 2. Module: 'shifts' (Arqueo de Caja / Turnos)
      if (moduleId === 'shifts') {
        const openShift = await prisma.cashShift.findFirst({
          where: { status: 'OPEN' }
        });

        if (openShift) {
          return {
            canDisable: false,
            reason: `No se puede desactivar el módulo de 'Arqueo de Caja': El Turno #${openShift.shiftNumber} (${openShift.cashierName}) se encuentra actualmente ABIERTO. Debe realizar el cierre y arqueo de caja antes de desactivar el módulo.`,
            details: {
              shiftId: openShift.id,
              shiftNumber: openShift.shiftNumber,
              cashierName: openShift.cashierName,
              openedAt: openShift.openedAt
            }
          };
        }
      }

      // 3. Module: 'cxc' (Cuentas por Cobrar)
      if (moduleId === 'cxc') {
        if (context?.clients && Array.isArray(context.clients)) {
          const debtors = context.clients.filter(c => Number(c.balance || c.pendingDebt || 0) > 0.01);
          if (debtors.length > 0) {
            const totalDebt = debtors.reduce((sum, c) => sum + Number(c.balance || c.pendingDebt || 0), 0);
            return {
              canDisable: false,
              reason: `No se puede desactivar el módulo de 'Cuentas por Cobrar': Existen ${debtors.length} clientes con saldos deudores pendientes por un total de $${totalDebt.toFixed(2)}. Debe saldar o conciliar las deudas antes de desactivar el módulo.`,
              details: {
                debtorsCount: debtors.length,
                totalDebtUsd: totalDebt,
                topDebtors: debtors.slice(0, 3).map(d => ({ name: d.name, balance: d.balance || d.pendingDebt }))
              }
            };
          }
        }
      }

      // 4. Module: 'cxp' (Cuentas por Pagar)
      if (moduleId === 'cxp') {
        if (context?.suppliers && Array.isArray(context.suppliers)) {
          const pendingSuppliers = context.suppliers.filter(s => Number(s.pendingBalance || s.balance || 0) > 0.01);
          if (pendingSuppliers.length > 0) {
            const totalPayable = pendingSuppliers.reduce((sum, s) => sum + Number(s.pendingBalance || s.balance || 0), 0);
            return {
              canDisable: false,
              reason: `No se puede desactivar el módulo de 'Cuentas por Pagar': Existen facturas a crédito y pasivos pendientes con ${pendingSuppliers.length} proveedores por un total de $${totalPayable.toFixed(2)}. Debe registrar los pagos correspondientes antes de desactivar el módulo.`,
              details: {
                suppliersCount: pendingSuppliers.length,
                totalPayableUsd: totalPayable,
                suppliers: pendingSuppliers.slice(0, 3).map(s => ({ name: s.name, balance: s.pendingBalance || s.balance }))
              }
            };
          }
        }
      }

      // Safe to disable
      return { canDisable: true };
    } catch (err: any) {
      console.error(`[SystemConfig] Error checking canDisableModule for '${moduleId}':`, err);
      // In case of error, permit with warning to avoid blocking system
      return { canDisable: true };
    }
  }

  /**
   * Updates enabled modules in DB and in-memory cache.
   * GUARANTEE: This is a purely functional flag toggle. It NEVER runs DROP TABLE,
   * TRUNCATE, or DELETE operations. All historical data, foreign keys, and ledger
   * records remain intact and queryable for financial reports.
   */
  async updateEnabledModules(
    modulesToEnable: string[],
    context?: { clients?: any[]; suppliers?: any[] }
  ): Promise<{ enabledModules: string[]; disabledModules: string[] }> {
    // Enforce core modules are never removed
    const filteredOptionals = modulesToEnable.filter(m => 
      OPTIONAL_MODULES.includes(m as OptionalModuleId)
    );

    const oldActive = new Set(this.activeModules);
    const newSet = new Set<string>([
      ...CORE_MODULES,
      ...filteredOptionals
    ]);

    // Find modules that are being deactivated
    const modulesBeingDeactivated = OPTIONAL_MODULES.filter(m => 
      oldActive.has(m) && !newSet.has(m)
    );

    // Run pre-checks for all modules being deactivated
    for (const modId of modulesBeingDeactivated) {
      const checkResult = await this.canDisableModule(modId, context);
      if (!checkResult.canDisable) {
        const error: any = new Error(checkResult.reason || `No es posible desactivar el módulo '${modId}' debido a procesos pendientes.`);
        error.statusCode = 400;
        error.code = 'MODULE_HAS_PENDING_PROCESSES';
        error.details = checkResult.details;
        throw error;
      }
    }

    // Update database (non-destructive metadata update only)
    await prisma.systemConfig.upsert({
      where: { id: 'default' },
      update: {
        enabledModules: JSON.stringify(filteredOptionals),
        updatedAt: new Date()
      },
      create: {
        id: 'default',
        enabledModules: JSON.stringify(filteredOptionals)
      }
    });

    // Update memory cache
    this.activeModules = newSet;

    // Trigger listeners for modules that changed state
    for (const optModule of OPTIONAL_MODULES) {
      const wasEnabled = oldActive.has(optModule);
      const isNowEnabled = newSet.has(optModule);
      if (wasEnabled !== isNowEnabled) {
        console.log(`[SystemConfig] Module '${optModule}' changed state: ${wasEnabled} -> ${isNowEnabled}`);
        for (const listener of this.onModuleStatusChangeListeners) {
          try {
            listener(optModule, isNowEnabled);
          } catch (listenerErr) {
            console.error(`[SystemConfig] Error in module status listener for ${optModule}:`, listenerErr);
          }
        }
      }
    }

    return {
      enabledModules: Array.from(this.activeModules),
      disabledModules: OPTIONAL_MODULES.filter(m => !this.activeModules.has(m))
    };
  }

  /**
   * Get cloud sync settings
   */
  async getCloudSyncSettings() {
    const config = await prisma.systemConfig.findUnique({
      where: { id: 'default' }
    });
    return {
      cloudSyncEnabled: config?.cloudSyncEnabled ?? false,
      cloudAppId: config?.cloudAppId ?? '',
      cloudToken: config?.cloudToken ?? ''
    };
  }

  /**
   * Update cloud sync settings
   */
  async updateCloudSyncSettings(data: { cloudSyncEnabled?: boolean; cloudAppId?: string; cloudToken?: string }) {
    return prisma.systemConfig.upsert({
      where: { id: 'default' },
      update: {
        ...data,
        updatedAt: new Date()
      },
      create: {
        id: 'default',
        enabledModules: JSON.stringify([...OPTIONAL_MODULES]),
        ...data
      }
    });
  }
}

export const systemConfigService = new SystemConfigService();
