import { safeFetchJson } from './api';

export const CORE_MODULE_IDS = ['auth', 'pos', 'inventory', 'config'] as const;
export type CoreModuleId = typeof CORE_MODULE_IDS[number];

export const OPTIONAL_MODULE_IDS = [
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
export type OptionalModuleId = typeof OPTIONAL_MODULE_IDS[number];

export type AnyModuleId = CoreModuleId | OptionalModuleId;

export interface ModuleDefinition {
  id: string;
  name: string;
  category: 'core' | 'optional';
  isCore: boolean;
  description: string;
  resourceImpact: string;
  tag: string;
}

export const SYSTEM_MODULES_CATALOG: Record<string, ModuleDefinition> = {
  auth: {
    id: 'auth',
    name: 'Autenticación & Usuarios',
    category: 'core',
    isCore: true,
    description: 'Gestión de inicio de sesión, sesiones JWT, contraseñas y asignación de cajeros.',
    resourceImpact: 'Núcleo obligatorio: requerido para la seguridad integral del sistema.',
    tag: 'Núcleo Protegido'
  },
  pos: {
    id: 'pos',
    name: 'Punto de Venta Fundamental',
    category: 'core',
    isCore: true,
    description: 'Cobro rápido, lector de código de barras, cálculo de vuelto y tickets.',
    resourceImpact: 'Núcleo obligatorio: motor principal de transacciones.',
    tag: 'Núcleo Protegido'
  },
  inventory: {
    id: 'inventory',
    name: 'Gestión Básica de Inventario',
    category: 'core',
    isCore: true,
    description: 'Catálogo de productos, existencias, precios multidivisa (USD/Bs) y costos.',
    resourceImpact: 'Núcleo obligatorio: base de datos central de productos.',
    tag: 'Núcleo Protegido'
  },
  config: {
    id: 'config',
    name: 'Configuración del Sistema',
    category: 'core',
    isCore: true,
    description: 'Parámetros del negocio, tasa BCV, impresoras térmicas y control modular.',
    resourceImpact: 'Núcleo obligatorio: orquestador de entorno y parámetros.',
    tag: 'Núcleo Protegido'
  },
  combos: {
    id: 'combos',
    name: 'Combos & Paquetes Promocionales',
    category: 'optional',
    isCore: false,
    description: 'Creación y venta de combos de varios productos (fijos o seleccionables/variados) con horario y descuento de stock fraccionado.',
    resourceImpact: 'Ahorro: Desactiva el motor de combos, horarios y botón de combos en el POS.',
    tag: 'Ventas Especiales & Promociones'
  },
  cxc: {
    id: 'cxc',
    name: 'Cuentas por Cobrar (CxC / Fiados)',
    category: 'optional',
    isCore: false,
    description: 'Control de deudas de clientes, límites de crédito, pagos fraccionados y abonos.',
    resourceImpact: 'Ahorro: 0 consultas de saldo pendiente y 0 transacciones de cobro en diferido.',
    tag: 'Ahorro de Memoria & Consultas'
  },
  cxp: {
    id: 'cxp',
    name: 'Cuentas por Pagar (CxP / Proveedores)',
    category: 'optional',
    isCore: false,
    description: 'Registro de facturas a crédito de proveedores, cronogramas de pago y aging reports.',
    resourceImpact: 'Ahorro: Desactiva conciliaciones de deuda a distribuidores y tablas de pasivos.',
    tag: 'Ahorro de Tablas & Cálculos'
  },
  audits: {
    id: 'audits',
    name: 'Auditorías Físicas de Inventario',
    category: 'optional',
    isCore: false,
    description: 'Conteos físicos ciegos, control de mermas, sobrantes y ajustes de existencias.',
    resourceImpact: 'Ahorro: Elimina snapshots pesados de stock y bloqueos temporales de conteo.',
    tag: 'Ahorro de Transacciones SQLite'
  },
  alerts: {
    id: 'alerts',
    name: 'Alertas de Stock & Cron Job 60s',
    category: 'optional',
    isCore: false,
    description: 'Worker periódico de node-cron que evalúa existencias críticas cada 60 segundos.',
    resourceImpact: 'Ahorro: 100% de consultas periódicas a BD y detiene el worker en memoria (0% CPU).',
    tag: 'Zero-Resource Background'
  },
  clients: {
    id: 'clients',
    name: 'Directorio de Clientes',
    category: 'optional',
    isCore: false,
    description: 'Base de datos de clientes con RIF/Cédula, límite de crédito, teléfonos y direcciones.',
    resourceImpact: 'Ahorro: Omite consultas del padrón de clientes y optimiza el flujo directo del POS.',
    tag: 'Optimización de Búsquedas'
  },
  kardex: {
    id: 'kardex',
    name: 'Kardex & Trazabilidad Histórica',
    category: 'optional',
    isCore: false,
    description: 'Bitácora inmutable de entradas, salidas, mermas y ajustes con costo ponderado.',
    resourceImpact: 'Ahorro: Disminuye escrituras I/O en disco y consultas de auditoría forense.',
    tag: 'Ahorro de I/O en Disco'
  },
  shifts: {
    id: 'shifts',
    name: 'Arqueo de Caja & Turnos',
    category: 'optional',
    isCore: false,
    description: 'Apertura de turno, control de egresos de caja chica, arqueo ciego y reportes X/Z.',
    resourceImpact: 'Ahorro: Permite cobro continuo directo sin requerir turnos previos obligatorios.',
    tag: 'Simplificación Operativa'
  },
  sales: {
    id: 'sales',
    name: 'Historial de Ventas Recientes',
    category: 'optional',
    isCore: false,
    description: 'Visor de notas de entrega anteriores, re-impresión de tickets y anulación.',
    resourceImpact: 'Ahorro: Elimina consultas de histórico y agregaciones de tickets pasados.',
    tag: 'Ahorro de Consultas SQL'
  },
  envases: {
    id: 'envases',
    name: 'Envases, Botellas Vacías & Tobos (Retornables)',
    category: 'optional',
    isCore: false,
    description: 'Control automático de botellas vacías al vender cervezas/licores y gestión de inventario/préstamo de tobos de cerveza.',
    resourceImpact: 'Ahorro: Desactiva el contador de botellas vacías, catálogo de tobos y campos retornables.',
    tag: 'Especializado Licorerías & Bodegón'
  },
  balanza: {
    id: 'balanza',
    name: '⚖️ Balanza Etiquetadora & Productos Pesables (Carnicería/Charcutería)',
    category: 'optional',
    isCore: false,
    description: 'Lectura dinámica de etiquetas impresas por balanzas etiquetadoras en formato EAN-13 / EAN-14 (Prefijo 21 / PLU + Precio).',
    resourceImpact: 'Especializado: Decodifica peso y precio dinámico al escanear carnes, embutidos y víveres al peso.',
    tag: 'Especial Carnicerías & Charcuterías'
  },
  open_price: {
    id: 'open_price',
    name: '🏷️ Productos con Precio Modificable (Open Price)',
    category: 'optional',
    isCore: false,
    description: 'Permite crear productos genéricos (ej: "Verduras", "Varios") cuyo precio se ingresa manualmente en el POS al momento de la venta.',
    resourceImpact: 'Flexibilidad: Permite vender productos sin precio fijo o servicios eventuales.',
    tag: 'Flexibilidad en Venta'
  }
};

const STORAGE_KEY = 'bodegon_enabled_modules';

/**
 * Get initial cached active modules from localStorage
 */
export function getLocalEnabledModules(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return Array.from(new Set([...CORE_MODULE_IDS, ...parsed]));
      }
    }
  } catch (e) {
    console.warn('[systemModules] Error reading local modules:', e);
  }
  // Default: All active
  return [...CORE_MODULE_IDS, ...OPTIONAL_MODULE_IDS];
}

/**
 * Check if a specific module is enabled
 */
export function isModuleEnabled(moduleId: string): boolean {
  if (CORE_MODULE_IDS.includes(moduleId as CoreModuleId)) {
    return true;
  }
  const enabled = getLocalEnabledModules();
  return enabled.includes(moduleId);
}

/**
 * Synchronize modules with backend /api/v1/system/config
 */
export async function syncSystemModules(): Promise<string[]> {
  try {
    const res = await safeFetchJson<any>('/api/v1/system/config');
    const enabledArr = res?.data?.enabledModules || res?.rawJson?.data?.enabledModules;
    if (res?.ok && Array.isArray(enabledArr)) {
      const list = Array.from(new Set([...CORE_MODULE_IDS, ...enabledArr]));
      
      // Stability check: only dispatch and save if different from current
      const currentRaw = localStorage.getItem(STORAGE_KEY);
      let isSame = false;
      if (currentRaw) {
        try {
          const current = JSON.parse(currentRaw);
          isSame = Array.isArray(current) && 
                   current.length === list.length && 
                   current.every(m => list.includes(m));
        } catch (e) { /* ignore */ }
      }

      if (!isSame) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent('system-modules-updated', { detail: list }));
      }
      return list;
    }
  } catch (err) {
    console.warn('[systemModules] Could not sync with backend, using local fallback:', err);
  }
  return getLocalEnabledModules();
}

/**
 * Pre-check verification function to check if a specific module can be safely deactivated.
 * Prevents deactivation if open shifts, in-progress audits, pending receivables or payable debts exist.
 */
export async function checkCanDisableModule(
  moduleId: string,
  context?: { clients?: any[]; suppliers?: any[] }
): Promise<{ canDisable: boolean; reason?: string; details?: any }> {
  // Core modules can never be disabled
  if (CORE_MODULE_IDS.includes(moduleId as CoreModuleId)) {
    return {
      canDisable: false,
      reason: `El módulo '${moduleId}' es un componente protegido del Núcleo Fundamental y no puede ser desactivado.`
    };
  }

  // Fast client-side pre-checks
  if (moduleId === 'cxc' && context?.clients && Array.isArray(context.clients)) {
    const debtors = context.clients.filter(c => Number(c.balance || c.pendingDebt || 0) > 0.01);
    if (debtors.length > 0) {
      const totalDebt = debtors.reduce((sum, c) => sum + Number(c.balance || c.pendingDebt || 0), 0);
      return {
        canDisable: false,
        reason: `No se puede desactivar 'Cuentas por Cobrar': Existen ${debtors.length} clientes con deudas activas por un total de $${totalDebt.toFixed(2)}. Debe conciliar o saldar las deudas antes de desactivar el módulo.`,
        details: { debtorsCount: debtors.length, totalDebtUsd: totalDebt }
      };
    }
  }

  if (moduleId === 'cxp' && context?.suppliers && Array.isArray(context.suppliers)) {
    const pendingSuppliers = context.suppliers.filter(s => Number(s.pendingBalance || s.balance || 0) > 0.01);
    if (pendingSuppliers.length > 0) {
      const totalPayable = pendingSuppliers.reduce((sum, s) => sum + Number(s.pendingBalance || s.balance || 0), 0);
      return {
        canDisable: false,
        reason: `No se puede desactivar 'Cuentas por Pagar': Existen facturas a crédito pendientes con ${pendingSuppliers.length} proveedores por un total de $${totalPayable.toFixed(2)}. Debe registrar los pagos correspondientes antes de desactivar el módulo.`,
        details: { suppliersCount: pendingSuppliers.length, totalPayableUsd: totalPayable }
      };
    }
  }

  // Server-side pre-check (database queries for shifts, audits, etc.)
  try {
    const res = await safeFetchJson<{ canDisable: boolean; reason?: string; details?: any }>('/api/v1/system/modules/pre-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, context })
    });

    if (res?.ok && res.data) {
      return res.data;
    }
    if (res?.error) {
      return { canDisable: false, reason: res.error };
    }
  } catch (err: any) {
    console.warn('[systemModules] Error calling pre-check endpoint:', err);
  }

  return { canDisable: true };
}

/**
 * Save modular configuration to backend with strict pre-check validation and zero data loss guarantee.
 */
export async function saveSystemModulesToBackend(
  enabledModules: string[],
  context?: { clients?: any[]; suppliers?: any[] }
): Promise<{ success: boolean; error?: string; data?: any }> {
  const sanitized = Array.from(new Set([
    ...CORE_MODULE_IDS,
    ...enabledModules.filter(m => OPTIONAL_MODULE_IDS.includes(m as OptionalModuleId))
  ]));

  try {
    const res = await safeFetchJson<any>('/api/v1/system/modules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabledModules: sanitized, context })
    });

    if (res?.ok) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      window.dispatchEvent(new CustomEvent('system-modules-updated', { detail: sanitized }));
      return {
        success: true,
        data: res.data
      };
    }

    return {
      success: false,
      error: res?.error || 'No se pudo guardar la configuración modular en el servidor.'
    };
  } catch (err: any) {
    console.error('[systemModules] Error saving modules to backend:', err);
    return {
      success: false,
      error: err.message || 'Error de conexión con el servidor.'
    };
  }
}
