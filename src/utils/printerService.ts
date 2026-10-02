import { Sale, POSConfig } from '../types';
import { getPOSConfig, savePOSConfig } from './configHelper';

export type PrinterStatus = {
  isConnected: boolean;
  printerName: string;
  connectionType: 'BLUETOOTH' | 'PLUGIN_HTTP' | 'EPSON_EPOS' | 'WEB_USB' | 'SYSTEM_PRINT';
  paperWidth: '58mm' | '80mm';
  statusText: string;
};

// Global in-memory Web Bluetooth / WebUSB device references
let activeBtDevice: any = null;
let activeBtCharacteristic: any = null;
let activeUsbDevice: any = null;

type StatusListener = (status: PrinterStatus) => void;
const listeners: Set<StatusListener> = new Set();

/**
 * Returns current status of the printer based on configuration and active hardware GATT connection.
 */
export function getPrinterStatus(): PrinterStatus {
  const config = getPOSConfig();

  if (!config.printerEnabled || config.printerConnectionType === 'SYSTEM_PRINT') {
    return {
      isConnected: false,
      printerName: 'Sin impresora',
      connectionType: 'SYSTEM_PRINT',
      paperWidth: config.printerPaperWidth || '58mm',
      statusText: 'Sin impresora configurada (Usa Windows Print)',
    };
  }

  if (config.printerConnectionType === 'BLUETOOTH') {
    const isBtActive = !!(activeBtDevice && activeBtDevice.gatt && activeBtDevice.gatt.connected);
    const name = config.printerName || config.btDeviceName || 'Impresora Bluetooth';
    return {
      isConnected: isBtActive,
      printerName: isBtActive ? name : 'Sin impresora',
      connectionType: 'BLUETOOTH',
      paperWidth: config.printerPaperWidth || '58mm',
      statusText: isBtActive ? `Conectada por Bluetooth: ${name}` : 'Bluetooth Desconectado',
    };
  }

  if (config.printerConnectionType === 'PLUGIN_HTTP') {
    const name = config.printerName || 'Impresora Térmica Local';
    return {
      isConnected: true,
      printerName: name,
      connectionType: 'PLUGIN_HTTP',
      paperWidth: config.printerPaperWidth || '58mm',
      statusText: `Servidor Plugin activo (${config.printerPluginUrl})`,
    };
  }

  if (config.printerConnectionType === 'EPSON_EPOS') {
    const name = config.printerName || 'Epson ePOS Network';
    return {
      isConnected: true,
      printerName: name,
      connectionType: 'EPSON_EPOS',
      paperWidth: config.printerPaperWidth || '80mm',
      statusText: `Epson Red IP: ${config.printerEpsonIp}:${config.printerEpsonPort}`,
    };
  }

  if (config.printerConnectionType === 'WEB_USB') {
    const isUsbActive = !!(activeUsbDevice && activeUsbDevice.opened);
    const name = config.printerName || 'Impresora USB';
    return {
      isConnected: isUsbActive,
      printerName: isUsbActive ? name : 'Sin impresora',
      connectionType: 'WEB_USB',
      paperWidth: config.printerPaperWidth || '58mm',
      statusText: isUsbActive ? `USB Conectada: ${name}` : 'USB Desconectada',
    };
  }

  return {
    isConnected: false,
    printerName: 'Sin impresora',
    connectionType: 'SYSTEM_PRINT',
    paperWidth: config.printerPaperWidth || '58mm',
    statusText: 'Sin impresora',
  };
}

export function subscribePrinterStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener(getPrinterStatus());
  return () => {
    listeners.delete(listener);
  };
}

function notifyStatusChange() {
  const currentStatus = getPrinterStatus();
  listeners.forEach((fn) => fn(currentStatus));
}

/**
 * Connect to a Bluetooth thermal printer using Web Bluetooth API
 */
export async function connectBluetoothPrinter(): Promise<{ success: boolean; deviceName: string; error?: string }> {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    return {
      success: false,
      deviceName: '',
      error: 'Tu navegador no soporta la API Web Bluetooth. Usa Google Chrome o Microsoft Edge.',
    };
  }

  const isIframe = window.self !== window.top;

  try {
    console.log('[PrinterService] Solicitando dispositivo Bluetooth...');
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Standard BLE Thermal Printer Service
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Serial Port Service
        '00001101-0000-1000-8000-00805f9b34fb',
      ],
    });

    if (!device) {
      return { success: false, deviceName: '', error: 'No se seleccionó ningún dispositivo.' };
    }

    console.log(`[PrinterService] Dispositivo seleccionado: ${device.name || device.id}. Conectando GATT Server...`);
    
    let server: any = null;
    let lastGattErr: any = null;

    // Retry GATT connection up to 3 times with a delay (BLE devices often take a moment to wake up)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[PrinterService] Intento ${attempt}/3 de conexión GATT...`);
        if (device.gatt) {
          if (device.gatt.connected) {
            server = device.gatt;
          } else {
            server = await device.gatt.connect();
          }
        }
        if (server && server.connected) {
          console.log(`[PrinterService] ¡GATT Server conectado exitosamente en el intento ${attempt}!`);
          break;
        }
      } catch (e: any) {
        lastGattErr = e;
        console.warn(`[PrinterService] Error en intento ${attempt} de GATT connect:`, e);
        if (attempt < 3) {
          await new Promise((res) => setTimeout(res, 700));
        }
      }
    }

    if (!server || !server.connected) {
      const gattErrMsg = lastGattErr?.message || 'Connection attempt failed';
      console.error('[PrinterService] No se pudo establecer la conexión GATT:', lastGattErr);

      return {
        success: false,
        deviceName: device.name || 'Impresora Bluetooth',
        error: `No se pudo enlazar vía Bluetooth BLE con "${device.name || 'Impresora'}".\n\nDetalle: ${gattErrMsg}.\n\nSugerencias de Solución:\n1. Asegúrate de que la impresora esté encendida, cargada y NO esté conectada al Bluetooth de otro celular.\n2. Si tu impresora es Bluetooth Clásica (2.0/3.0 SPP no-BLE), la Web Bluetooth API requiere una impresora BLE. Puedes usar la opción "Servidor/Plugin Local" o "Impresión Nativa".`,
      };
    }
    
    // Attempt to locate printable write characteristic
    let characteristic: any = null;

    if (server) {
      try {
        const services = await server.getPrimaryServices();
        for (const service of services) {
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              characteristic = c;
              break;
            }
          }
          if (characteristic) break;
        }
      } catch (e) {
        console.warn('[PrinterService] Advertencia buscando características GATT:', e);
      }
    }

    activeBtDevice = device;
    activeBtCharacteristic = characteristic;

    const deviceName = device.name || 'Impresora Bluetooth POS';

    // Disconnection listener
    device.addEventListener('gattserverdisconnected', () => {
      console.log('[PrinterService] Dispositivo Bluetooth desconectado');
      activeBtDevice = null;
      activeBtCharacteristic = null;
      notifyStatusChange();
    });

    // Update config
    const posConfig = getPOSConfig();
    savePOSConfig({
      ...posConfig,
      printerEnabled: true,
      printerConnectionType: 'BLUETOOTH',
      printerName: deviceName,
      btDeviceName: deviceName,
      btDeviceId: device.id,
    });

    notifyStatusChange();

    return { success: true, deviceName };
  } catch (err: any) {
    console.error('[PrinterService] Error conectando Bluetooth:', err);
    let userMsg = err.message || 'Fallo de conexión Bluetooth.';

    if (err.message && (err.message.toLowerCase().includes('permissions policy') || err.message.toLowerCase().includes('disallowed'))) {
      if (isIframe) {
        userMsg = 'Web Bluetooth está bloqueado por la política de seguridad del visor (iframe). Haz clic en "Abrir en Nueva Pestaña" para vincular tu impresora Bluetooth directamente.';
      } else {
        userMsg = 'El navegador denegó el acceso a Bluetooth por políticas de seguridad.';
      }
    } else if (err.message && (err.message.toLowerCase().includes('connection attempt failed') || err.message.toLowerCase().includes('failed to connect'))) {
      userMsg = 'Error de conexión Bluetooth: No se pudo enlazar el servidor GATT de la impresora.\n\nSugerencias:\n• Apaga y vuelve a encender la impresora térmica.\n• Verifica que no esté emparejada a otro celular o tablet en este momento.\n• Si es Bluetooth Clásica (2.0/3.0 SPP), usa la opción "Servidor/Plugin Local" o "Impresión Nativa".';
    } else if (err.name === 'NotFoundError' || (err.message && err.message.includes('User cancelled'))) {
      userMsg = 'Búsqueda de dispositivo Bluetooth cancelada.';
    } else if (err.name === 'SecurityError' || err.name === 'NotAllowedError') {
      userMsg = 'Acceso a Bluetooth restringido por el navegador. Abre la app en una nueva pestaña.';
    }

    return {
      success: false,
      deviceName: '',
      error: userMsg,
    };
  }
}

/**
 * Disconnect current Bluetooth printer
 */
export async function disconnectBluetoothPrinter(): Promise<void> {
  if (activeBtDevice && activeBtDevice.gatt && activeBtDevice.gatt.connected) {
    try {
      activeBtDevice.gatt.disconnect();
    } catch (e) {
      console.error('Error disconnecting BT:', e);
    }
  }
  activeBtDevice = null;
  activeBtCharacteristic = null;

  const posConfig = getPOSConfig();
  savePOSConfig({
    ...posConfig,
    printerEnabled: false,
  });

  notifyStatusChange();
}

/**
 * Connect USB Thermal Printer via WebUSB
 */
export async function connectUsbPrinter(): Promise<{ success: boolean; deviceName: string; error?: string }> {
  if (!(navigator as any).usb) {
    return { success: false, deviceName: '', error: 'Tu navegador no soporta WebUSB. Usa Chrome/Edge.' };
  }

  try {
    const device = await (navigator as any).usb.requestDevice({ filters: [] });
    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
    await device.claimInterface(0);

    activeUsbDevice = device;
    const deviceName = device.productName || 'Impresora USB Térmica';

    const posConfig = getPOSConfig();
    savePOSConfig({
      ...posConfig,
      printerEnabled: true,
      printerConnectionType: 'WEB_USB',
      printerName: deviceName,
    });

    notifyStatusChange();
    return { success: true, deviceName };
  } catch (err: any) {
    return { success: false, deviceName: '', error: err.message || 'Error conectando impresora USB' };
  }
}

/**
 * Test print function for verification in settings
 */
export async function testPrint(): Promise<{ success: boolean; message: string }> {
  const config = getPOSConfig();
  const testSale: Sale = {
    id: 'TEST-' + Math.floor(Math.random() * 10000),
    invoiceNumber: 'PRUEBA-001',
    cashierName: 'Caja 1 - Principal',
    paymentMethod: 'EFECTIVO_USD',
    subtotal: 10.00,
    tax: 0,
    total: 10.00,
    amountPaid: 10.00,
    changeDue: 0,
    status: 'COMPLETED',
    createdAt: new Date().toISOString(),
    items: [
      {
        id: 't1',
        productId: 'p1',
        productName: 'Harina P.A.N. Blanca 1kg (Ticket de Prueba)',
        productBarcode: '7591011000012',
        unitPrice: 1.40,
        quantity: 5,
        subtotal: 7.00,
      },
      {
        id: 't2',
        productId: 'p2',
        productName: 'Refresco Coca-Cola 2L',
        productBarcode: '7591011000050',
        unitPrice: 3.00,
        quantity: 1,
        subtotal: 3.00,
      },
    ],
    notes: 'TICKET DE PRUEBA DE IMPRESIÓN DIRECTA',
  };

  return await printSaleReceipt(testSale, 849.56, true);
}

/**
 * Generate plain formatted text ticket for thermal paper
 */
export function generateTicketText(sale: Sale, bcvRate = 849.56, is58mm = true): string {
  const activeRate = (sale as any).bcvRate || bcvRate;
  const config = getPOSConfig();
  const lineChar = is58mm ? '-' : '=';
  const width = is58mm ? 32 : 48;

  const center = (str: string) => {
    if (str.length >= width) return str.slice(0, width);
    const leftPad = Math.floor((width - str.length) / 2);
    return ' '.repeat(leftPad) + str;
  };

  const line = lineChar.repeat(width);

  const formatRow = (left: string, right: string) => {
    const maxLeft = width - right.length - 1;
    const truncatedLeft = left.length > maxLeft ? left.slice(0, maxLeft) : left;
    const spaces = width - truncatedLeft.length - right.length;
    return truncatedLeft + ' '.repeat(Math.max(1, spaces)) + right;
  };

  // Parse metadata if available
  let client: any = null;
  let discount: any = null;
  let charge: any = null;
  let adjustedTotalUsd: number | null = null;
  let adjustedTotalBs: number | null = null;
  let paymentReference: string = '';
  let pagoMovil: any = null;

  if (sale.notes && sale.notes.startsWith('METADATA_JSON:')) {
    try {
      const meta = JSON.parse(sale.notes.replace('METADATA_JSON:', ''));
      client = meta.client || null;
      discount = meta.discount || null;
      charge = meta.charge || null;
      adjustedTotalUsd = typeof meta.adjustedTotalUsd === 'number' ? meta.adjustedTotalUsd : null;
      adjustedTotalBs = typeof meta.adjustedTotalBs === 'number' ? meta.adjustedTotalBs : null;
      paymentReference = meta.paymentReference || '';
      pagoMovil = meta.pagoMovil || null;
    } catch (e) {
      console.error('Error parsing METADATA_JSON for ticket:', e);
    }
  }

  const finalTotalUsd = adjustedTotalUsd !== null ? adjustedTotalUsd : sale.total;
  const finalTotalBs = adjustedTotalBs !== null ? adjustedTotalBs : (sale.total * activeRate);
  const originalSubtotalUsd = sale.subtotal;
  const originalSubtotalBs = sale.subtotal * activeRate;
  const dateStr = new Date(sale.createdAt).toLocaleString('es-VE');

  const currencyMode = config.deliveryNotePriceCurrency || 'BS'; // 'BS' | 'USD' | 'BOTH'

  let t = '';

  // 1. Company Header
  if (config.deliveryNoteShowBusinessName && config.businessName) {
    t += center(`*** ${config.businessName.toUpperCase()} ***`) + '\n';
  }
  if (config.deliveryNoteShowBusinessRif && config.businessRif) {
    t += center(`RIF: ${config.businessRif}`) + '\n';
  }
  if (config.deliveryNoteShowBusinessPhone && config.businessPhone) {
    t += center(`Tel: ${config.businessPhone}`) + '\n';
  }

  t += center('NOTA DE ENTREGA') + '\n';
  t += center('Comprobante No Fiscal') + '\n';
  t += line + '\n';
  t += `Nota de Entrega: #${sale.invoiceNumber}\n`;
  t += `Fecha: ${dateStr}\n`;
  t += `Cajero: ${sale.cashierName}\n`;

  // Client info if present
  if (client && (client.name || client.docNumber)) {
    t += `Cliente: ${client.name || 'Contado'}\n`;
    if (client.docNumber) {
      t += `Doc: ${client.docType || 'V'}-${client.docNumber}\n`;
    }
    if (client.phone) {
      t += `Tel: ${client.phone}\n`;
    }
    if (client.notes) {
      t += `Dir: ${client.notes}\n`;
    }
  }

  t += line + '\n';
  t += center('DETALLE DE PRODUCTOS') + '\n';
  t += line + '\n';

  // 2. Product Items
  sale.items.forEach((item) => {
    t += `${item.productName}\n`;

    const itemUnitBs = item.unitPrice * activeRate;
    const itemSubBs = item.subtotal * activeRate;

    if (currencyMode === 'BS') {
      // 100% in Bs (Default)
      const qtyPrice = `  ${item.quantity} x Bs. ${itemUnitBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const sub = `Bs. ${itemSubBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      t += formatRow(qtyPrice, sub) + '\n';
    } else if (currencyMode === 'USD') {
      // In USD ($)
      const qtyPrice = `  ${item.quantity} x $${item.unitPrice.toFixed(2)}`;
      const sub = `$${item.subtotal.toFixed(2)}`;
      t += formatRow(qtyPrice, sub) + '\n';
    } else {
      // BOTH currencies
      const qtyPrice = `  ${item.quantity} x Bs. ${itemUnitBs.toFixed(2)} ($${item.unitPrice.toFixed(2)})`;
      const sub = `Bs. ${itemSubBs.toFixed(2)}`;
      t += formatRow(qtyPrice, sub) + '\n';
      t += formatRow('    Ref. Divisa:', `$${item.subtotal.toFixed(2)} USD`) + '\n';
    }
  });

  t += line + '\n';

  // 3. Subtotals & Discounts
  if (currencyMode === 'BS') {
    t += formatRow('SUBTOTAL:', `Bs. ${originalSubtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) + '\n';
  } else if (currencyMode === 'USD') {
    t += formatRow('SUBTOTAL:', `$${originalSubtotalUsd.toFixed(2)} USD`) + '\n';
  } else {
    t += formatRow('SUBTOTAL (Bs.):', `Bs. ${originalSubtotalBs.toFixed(2)}`) + '\n';
    t += formatRow('SUBTOTAL (USD):', `$${originalSubtotalUsd.toFixed(2)} USD`) + '\n';
  }

  // Display applied discount with motive/description
  if (discount && discount.amount > 0) {
    const discLabel = `DESC (${discount.description || 'General'}):`;
    if (discount.type === 'USD') {
      const discBs = discount.amount * activeRate;
      if (currencyMode === 'BS') {
        t += formatRow(discLabel, `-Bs. ${discBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) + '\n';
        t += formatRow('  (Valor Descuento):', `-$${discount.amount.toFixed(2)} USD`) + '\n';
      } else {
        t += formatRow(discLabel, `-$${discount.amount.toFixed(2)} USD`) + '\n';
      }
    } else {
      t += formatRow(discLabel, `-Bs. ${discount.amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) + '\n';
    }
  }

  // Display applied extra charge with motive/description
  if (charge && charge.amount > 0) {
    const chargeLabel = `CARGO (${charge.description || 'Extra'}):`;
    if (charge.type === 'USD') {
      const chgBs = charge.amount * activeRate;
      if (currencyMode === 'BS') {
        t += formatRow(chargeLabel, `+Bs. ${chgBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) + '\n';
        t += formatRow('  (Valor Cargo):', `+$${charge.amount.toFixed(2)} USD`) + '\n';
      } else {
        t += formatRow(chargeLabel, `+$${charge.amount.toFixed(2)} USD`) + '\n';
      }
    } else {
      t += formatRow(chargeLabel, `+Bs. ${charge.amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) + '\n';
    }
  }

  // 4. Totals
  t += line + '\n';
  if (currencyMode === 'BS') {
    t += formatRow('TOTAL A PAGAR:', `Bs. ${finalTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) + '\n';
  } else if (currencyMode === 'USD') {
    t += formatRow('TOTAL A PAGAR:', `$${finalTotalUsd.toFixed(2)} USD`) + '\n';
  } else {
    t += formatRow('TOTAL (Bs.):', `Bs. ${finalTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) + '\n';
    t += formatRow('TOTAL (USD):', `$${finalTotalUsd.toFixed(2)} USD`) + '\n';
  }

  // 5. BCV Rate if enabled
  if (config.deliveryNoteShowBcvRate) {
    t += formatRow('Tasa BCV Oficial:', `Bs. ${activeRate.toFixed(2)}`) + '\n';
  }

  // 6. Payment Methods & Specifics for USD / USDT received
  if (config.deliveryNoteShowPaymentMethod) {
    t += line + '\n';
    const methodNames: Record<string, string> = {
      DEBIT_CARD: 'Tarjeta Débito (POS)',
      PAGO_MOVIL: 'Pago Móvil (Bs)',
      CASH_BS: 'Efectivo Bolívares (Bs)',
      CASH_USD: 'Efectivo Dólares ($)',
      BINANCE: 'Binance Pay (USDT)',
      CREDIT: 'Venta a Crédito',
      SPLIT: 'Pago Mixto Combinado',
    };

    const methodDisplay = methodNames[sale.paymentMethod] || sale.paymentMethod;
    t += `Método de Pago: ${methodDisplay}\n`;

    // Rule: If paid in USD or USDT, explicitly state it was paid in $ or USDT with amount received
    if (sale.paymentMethod === 'CASH_USD') {
      t += `>>> PAGO EN DIVISA ($) <<<\n`;
      t += formatRow('Monto Recibido en $:', `$${finalTotalUsd.toFixed(2)} USD`) + '\n';
    } else if (sale.paymentMethod === 'BINANCE') {
      t += `>>> PAGO EN CRIPTOACTIVO USDT <<<\n`;
      t += formatRow('Monto Recibido en USDT:', `$${finalTotalUsd.toFixed(2)} USDT`) + '\n';
    } else if (sale.paymentMethod === 'PAGO_MOVIL' && pagoMovil) {
      if (pagoMovil.emisorBank) t += `Banco Emisor: ${pagoMovil.emisorBank}\n`;
      if (pagoMovil.accountType) t += `Tipo Cuenta: ${pagoMovil.accountType === 'PERSONAL' ? 'Personal' : 'Jurídica'}\n`;
    }

    if (paymentReference) {
      t += `Ref / Aprobación: ${paymentReference}\n`;
    }
  }

  t += line + '\n';
  t += center('¡Gracias por su compra!') + '\n';
  t += center('Conserve este comprobante') + '\n\n\n\n';

  return t;
}

/**
 * Main print dispatcher: Sends receipt to Bluetooth, Plugin HTTP, Epson ePOS, WebUSB or System Print.
 */
export async function printSaleReceipt(
  sale: Sale,
  bcvRate = 849.56,
  isTest = false
): Promise<{ success: boolean; message: string }> {
  const config = getPOSConfig();

  // 1. BLUETOOTH DIRECT PRINTING
  if (config.printerEnabled && config.printerConnectionType === 'BLUETOOTH') {
    if (activeBtDevice && activeBtDevice.gatt && !activeBtDevice.gatt.connected) {
      try {
        console.log('[PrinterService] Reintentando conexión GATT previa a la impresión...');
        await activeBtDevice.gatt.connect();
      } catch (e) {
        console.warn('[PrinterService] Intento de reconexión GATT falló:', e);
      }
    }

    if (!activeBtDevice || !activeBtDevice.gatt || !activeBtDevice.gatt.connected) {
      return {
        success: false,
        message: 'La impresora Bluetooth no está conectada o perdió la conexión. Por favor re-vincule en el menú de Impresora.',
      };
    }

    try {
      const ticketText = generateTicketText(sale, bcvRate, config.printerPaperWidth === '58mm');
      const encoder = new TextEncoder();
      const data = encoder.encode(ticketText);

      if (activeBtCharacteristic) {
        // Send in batches of 512 bytes
        const batchSize = 512;
        for (let i = 0; i < data.length; i += batchSize) {
          const chunk = data.slice(i, i + batchSize);
          await activeBtCharacteristic.writeValue(chunk);
        }
      } else {
        return { success: false, message: 'No se encontró canal de escritura GATT en la impresora Bluetooth.' };
      }

      return {
        success: true,
        message: isTest ? 'Ticket de prueba enviado a la impresora Bluetooth' : 'Ticket impreso en la impresora Bluetooth',
      };
    } catch (err: any) {
      console.error('[PrinterService] Error imprimiendo por Bluetooth:', err);
      return { success: false, message: `Error al enviar a Bluetooth: ${err.message || err}` };
    }
  }

  // 2. LOCAL HTTP PLUGIN (PARZIBYTE / NODE THERMAL PLUGIN)
  if (config.printerEnabled && config.printerConnectionType === 'PLUGIN_HTTP') {
    try {
      const ticketText = generateTicketText(sale, bcvRate, config.printerPaperWidth === '58mm');
      const pluginUrl = config.printerPluginUrl || 'http://localhost:8000';
      const printerName = config.printerName || 'PT210';

      const payload = {
        nombreImpresora: printerName,
        serial: '',
        operaciones: [
          { nombre: 'Iniciar', argumentos: [] },
          { nombre: 'EscribirTexto', argumentos: [ticketText] },
          { nombre: 'Feed', argumentos: [3] },
          ...(config.printerAutoCut ? [{ nombre: 'Corte', argumentos: [1] }] : []),
        ],
      };

      const response = await fetch(`${pluginUrl}/imprimir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`El servidor plugin respondió con estado ${response.status}`);
      }

      return {
        success: true,
        message: 'Ticket enviado con éxito al Plugin Térmico Local',
      };
    } catch (err: any) {
      console.error('[PrinterService] Error plugin local:', err);
      return {
        success: false,
        message: `No se pudo conectar al servidor plugin (${config.printerPluginUrl}). Asegúrese de ejecutar el conector local.`,
      };
    }
  }

  // 3. EPSON ePOS NETWORK IP PRINTING
  if (config.printerEnabled && config.printerConnectionType === 'EPSON_EPOS') {
    try {
      const ticketText = generateTicketText(sale, bcvRate, config.printerPaperWidth === '58mm');
      const ip = config.printerEpsonIp || '192.168.1.100';
      const port = config.printerEpsonPort || '8008';
      const devId = config.printerName || 'local_printer';

      const xmlPayload = `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><text>${ticketText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text><feed line="5"/><cut type="feed"/></epos-print></s:Body></s:Envelope>`;

      const eposUrl = `http://${ip}:${port}/cgi-bin/epos/service.cgi?devid=${devId}&timeout=10000`;

      await fetch(eposUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body: xmlPayload,
      });

      return {
        success: true,
        message: 'Ticket enviado a la Impresora Epson ePOS en red',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Error al comunicar con la impresora Epson en IP ${config.printerEpsonIp}:${config.printerEpsonPort}`,
      };
    }
  }

  // 4. WEB_USB DIRECT PRINTING
  if (config.printerEnabled && config.printerConnectionType === 'WEB_USB') {
    if (!activeUsbDevice || !activeUsbDevice.opened) {
      return { success: false, message: 'Impresora USB no conectada. Conéctela en Configuración.' };
    }
    try {
      const ticketText = generateTicketText(sale, bcvRate, config.printerPaperWidth === '58mm');
      const encoder = new TextEncoder();
      const data = encoder.encode(ticketText);
      await activeUsbDevice.transferOut(1, data);
      return { success: true, message: 'Ticket impreso por USB' };
    } catch (err: any) {
      return { success: false, message: `Error USB: ${err.message}` };
    }
  }

  // 5. DEFAULT SYSTEM PRINT (WINDOWS PRINT / BROWSER DIALOG)
  window.print();
  return {
    success: true,
    message: 'Abriendo ventana de impresión de Windows / Sistema',
  };
}
