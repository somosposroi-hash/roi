import { useState, useEffect } from 'react';
import { Printer, CheckCircle2, AlertCircle, RefreshCw, Bluetooth, Usb, Wifi, Sliders, X, Play, ExternalLink } from 'lucide-react';
import { getPOSConfig, savePOSConfig } from '../utils/configHelper';
import { 
  getPrinterStatus, 
  connectBluetoothPrinter, 
  disconnectBluetoothPrinter, 
  testPrint, 
  PrinterStatus 
} from '../utils/printerService';

interface PrinterStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullSettings: () => void;
}

export function PrinterStatusModal({ isOpen, onClose, onOpenFullSettings }: PrinterStatusModalProps) {
  const [status, setStatus] = useState<PrinterStatus>(getPrinterStatus());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStatus(getPrinterStatus());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnectBt = async () => {
    setIsConnecting(true);
    setFeedback(null);
    const result = await connectBluetoothPrinter();
    setIsConnecting(false);

    if (result.success) {
      setFeedback({ type: 'success', msg: `Impresora Bluetooth "${result.deviceName}" conectada exitosamente.` });
      setStatus(getPrinterStatus());
    } else {
      setFeedback({ type: 'error', msg: result.error || 'No se pudo conectar la impresora Bluetooth.' });
    }
  };

  const handleDisconnect = async () => {
    await disconnectBluetoothPrinter();
    setStatus(getPrinterStatus());
    setFeedback({ type: 'success', msg: 'Impresora desconectada.' });
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    setFeedback(null);
    const result = await testPrint();
    setIsTesting(false);

    if (result.success) {
      setFeedback({ type: 'success', msg: result.message });
    } else {
      setFeedback({ type: 'error', msg: result.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
            <img src="/images/impresora.svg" alt="Impresora" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Estado de la Impresora POS</h3>
            <p className="text-xs text-slate-500">Gestión rápida e impresión directa en punto de venta</p>
          </div>
        </div>

        {/* Current Connection Status Box */}
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
          status.isConnected 
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${
              status.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`} />
            <div>
              <div className="text-sm font-black flex items-center gap-1.5">
                <span>{status.printerName}</span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{status.statusText}</p>
            </div>
          </div>

          <span className="text-[10px] font-bold font-mono px-2 py-1 rounded bg-white border border-slate-200 shadow-2xs">
            {status.paperWidth}
          </span>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`p-3 rounded-xl text-xs font-semibold space-y-2 ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            <div className="flex items-start gap-2">
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
              <span className="leading-relaxed">{feedback.msg}</span>
            </div>
            {feedback.type === 'error' && (feedback.msg.includes('iframe') || feedback.msg.includes('pestaña') || feedback.msg.includes('seguridad')) && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700 transition-colors cursor-pointer mt-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir App en Nueva Pestaña</span>
              </a>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          {/* Quick Connect Bluetooth */}
          <button
            onClick={handleConnectBt}
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors disabled:opacity-50"
          >
            <Bluetooth className="w-4 h-4" />
            <span>{isConnecting ? 'Buscando Bluetooth...' : 'Conectar Impresora Bluetooth'}</span>
          </button>

          {/* Test Print */}
          <button
            onClick={handleTestPrint}
            disabled={isTesting}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
            <span>{isTesting ? 'Imprimiendo Ticket...' : 'Imprimir Ticket de Prueba'}</span>
          </button>

          {status.isConnected && (
            <button
              onClick={handleDisconnect}
              className="w-full py-2 text-center text-xs text-rose-600 font-semibold hover:underline cursor-pointer"
            >
              Desconectar impresora activa
            </button>
          )}
        </div>

        {/* Footer Link to Settings */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>¿Necesita configurar Epson / Red / Plugin?</span>
          <button
            onClick={() => {
              onClose();
              onOpenFullSettings();
            }}
            className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Abrir Ajustes</span>
          </button>
        </div>

      </div>
    </div>
  );
}
