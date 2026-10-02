import { POSConfig, Client } from '../types';

export const DEFAULT_POS_CONFIG: POSConfig = {
  // Business / Company Details
  businessName: 'Nubly Market',
  businessRif: 'J-50123456-7',
  businessPhone: '0412-1234567',

  // Delivery Note Customization (POS Checks & Settings)
  deliveryNoteShowBusinessName: true,
  deliveryNoteShowBusinessRif: true,
  deliveryNoteShowBusinessPhone: true,
  deliveryNotePriceCurrency: 'BS', // Predeterminado: Todo en Bolívares (Bs.)
  deliveryNoteDisclaimerAccepted: false,
  deliveryNoteShowBcvRate: true,
  deliveryNoteShowPaymentMethod: true,

  debitCardRefRequired: false,
  pagoMovilRefRequired: true,
  cashBsRefRequired: false,
  cashUsdRefRequired: false,
  binanceRefRequired: true,
  creditRefRequired: true,
  splitRefRequired: false,
  
  useClientData: false,
  showClientName: true,
  clientNameRequired: true,
  showClientRif: true,
  clientRifRequired: true,
  showClientPhone: true,
  clientPhoneRequired: false,
  showClientNotes: true,
  clientNotesRequired: false,

  enablePOSContainerCharges: true,
  enableContainerLoans: true,
  enableScaleEan13: true,
  askQuantityInPos: true,

  showPopularProducts: true,
  enableDiscountsAndCharges: true,
  pagoMovilBankName: 'Banco de Venezuela (BDV)',
  pagoMovilPhone: '0412-1234567',
  pagoMovilRif: 'J-12345678-9',
  pagoMovilShowBank: true,
  pagoMovilShowAccountType: true,

  wholesalePassword: '1234',
  outflowPassword: '1234',
  voidSalePassword: '1234',

  // Printer configuration defaults
  printerConnectionType: 'SYSTEM_PRINT',
  printerEnabled: false,
  printerAutoPrint: true,
  printerPaperWidth: '58mm',
  printerAutoCut: true,
  printerName: '',
  printerPluginUrl: 'http://localhost:8000',
  printerEpsonIp: '192.168.1.100',
  printerEpsonPort: '8008',
  btDeviceName: '',
  btDeviceId: '',
  hideProductPhotosAndEmojis: false,
  darkMode: false,
  sidebarCategories: [
    { id: 'cat-sales', name: 'Ventas y Caja', itemIds: ['pos', 'combos', 'shifts', 'sales', 'cxc', 'rates'] },
    { id: 'cat-inventory', name: 'Inventario y Almacén', itemIds: ['inventory', 'kardex', 'audits', 'alerts'] },
    { id: 'cat-admin', name: 'Administración', itemIds: ['dashboard', 'cxp', 'clients', 'config'] },
    { id: 'cat-dev', name: 'Desarrollo y Pruebas', itemIds: ['concurrency', 'architecture'] }
  ]
};

const CONFIG_KEY = 'nubly_app_pos_config_v1';
const CLIENTS_KEY = 'nubly_app_pos_clients_v1';

export function getPOSConfig(): POSConfig {
  if (typeof window === 'undefined') return DEFAULT_POS_CONFIG;
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (!saved) {
      // Save default
      localStorage.setItem(CONFIG_KEY, JSON.stringify(DEFAULT_POS_CONFIG));
      return DEFAULT_POS_CONFIG;
    }
    const parsed = JSON.parse(saved);
    const config: POSConfig = { ...DEFAULT_POS_CONFIG, ...parsed };

    // Ensure 'combos' and 'rates' exist in sidebarCategories
    if (Array.isArray(config.sidebarCategories) && config.sidebarCategories.length > 0) {
      const allItemIds = config.sidebarCategories.flatMap(c => c.itemIds || []);
      const salesCat = config.sidebarCategories.find(c => c.id === 'cat-sales') || config.sidebarCategories[0];
      if (salesCat) {
        if (!allItemIds.includes('combos')) {
          salesCat.itemIds = ['pos', 'combos', ...(salesCat.itemIds || []).filter(id => id !== 'pos' && id !== 'combos')];
        }
        if (!allItemIds.includes('rates')) {
          salesCat.itemIds = [...(salesCat.itemIds || []), 'rates'];
        }
      }
    }

    return config;
  } catch (e) {
    return DEFAULT_POS_CONFIG;
  }
}

export function savePOSConfig(config: POSConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('pos-config-updated', { detail: config }));
  } catch (e) {
    console.error('Error saving POS config:', e);
  }
}

export function getClientsList(): Client[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(CLIENTS_KEY);
    if (!saved) return [];
    return JSON.parse(saved);
  } catch (e) {
    return [];
  }
}

export function saveClientsList(clients: Client[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  } catch (e) {
    console.error('Error saving clients list:', e);
  }
}
