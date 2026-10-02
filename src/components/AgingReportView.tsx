import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  AlertTriangle, 
  AlertCircle, 
  Calendar, 
  Building2, 
  Coins, 
  FileText, 
  Search, 
  Printer, 
  ChevronRight, 
  DollarSign, 
  ShieldAlert,
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';
import { PurchaseReceipt, Supplier } from '../types';
import { evaluateReceiptAging, AgingBracket } from '../utils/cxpHelper';

interface AgingReportViewProps {
  bcvRate: number;
  receipts: PurchaseReceipt[];
  suppliers: Supplier[];
  onSelectSupplier: (supplierId: string) => void;
  onOpenPaymentForReceipt: (receipt: PurchaseReceipt) => void;
}

export function AgingReportView({
  bcvRate,
  receipts,
  suppliers,
  onSelectSupplier,
  onOpenPaymentForReceipt
}: AgingReportViewProps) {
  const [selectedBracket, setSelectedBracket] = useState<'ALL' | AgingBracket>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  // Evaluate all pending receipts with their aging status
  const pendingAgingList = useMemo(() => {
    return receipts
      .filter((r) => r.status === 'PENDIENTE' && r.remainingBalanceUsd > 0.001)
      .map((r) => evaluateReceiptAging(r));
  }, [receipts]);

  // Aggregate metrics by aging bracket
  const bracketMetrics = useMemo(() => {
    let porVencerUsd = 0;
    let porVencerCount = 0;

    let d1a30Usd = 0;
    let d1a30Count = 0;

    let d31a60Usd = 0;
    let d31a60Count = 0;

    let mas60Usd = 0;
    let mas60Count = 0;

    let totalDebtUsd = 0;

    for (const item of pendingAgingList) {
      const balance = item.receipt.remainingBalanceUsd;
      totalDebtUsd += balance;

      if (item.bracket === 'POR_VENCER') {
        porVencerUsd += balance;
        porVencerCount += 1;
      } else if (item.bracket === '1_A_30') {
        d1a30Usd += balance;
        d1a30Count += 1;
      } else if (item.bracket === '31_A_60') {
        d31a60Usd += balance;
        d31a60Count += 1;
      } else {
        mas60Usd += balance;
        mas60Count += 1;
      }
    }

    return {
      porVencerUsd,
      porVencerCount,
      d1a30Usd,
      d1a30Count,
      d31a60Usd,
      d31a60Count,
      mas60Usd,
      mas60Count,
      totalDebtUsd
    };
  }, [pendingAgingList]);

  // Filter list based on selected bracket and search query
  const filteredList = useMemo(() => {
    return pendingAgingList.filter((item) => {
      if (selectedBracket !== 'ALL' && item.bracket !== selectedBracket) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSupplier = item.receipt.supplierName.toLowerCase().includes(q);
        const matchesRif = item.receipt.supplierRif.toLowerCase().includes(q);
        const matchesNumber = item.receipt.receiptNumber.toLowerCase().includes(q);
        if (!matchesSupplier && !matchesRif && !matchesNumber) return false;
      }
      return true;
    }).sort((a, b) => b.daysDiff - a.daysDiff); // Most critical/overdue first
  }, [pendingAgingList, selectedBracket, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* EXECUTIVE HEADER & CASH FLOW CONTROL INTRO */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              Cash Flow & Tesorería
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Corte al {new Date().toLocaleDateString('es-VE', { dateStyle: 'full' })}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Reporte de Antigüedad de Saldos (Aging Report)</span>
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            Vista ejecutiva clave para el control del flujo de caja. Monitorea y prioriza los vencimientos de facturas de proveedores para evitar interrupciones en la cadena de suministros y cortes de despacho.
          </p>
        </div>

        {/* Total Debt Widget */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 px-6 shadow-md flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-purple-300">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
              Total Cartera por Pagar
            </span>
            <div className="text-2xl font-black font-mono text-white">
              ${bracketMetrics.totalDebtUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </div>
            <div className="text-xs text-purple-300 font-mono font-semibold">
              ≈ Bs. {(bracketMetrics.totalDebtUsd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* 4 AGING CARDS WITH EXACT CLASSIFICATIONS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. POR VENCER (Pagos programados dentro del crédito) */}
        <div 
          onClick={() => setSelectedBracket(selectedBracket === 'POR_VENCER' ? 'ALL' : 'POR_VENCER')}
          className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-xs transition-all relative overflow-hidden ${
            selectedBracket === 'POR_VENCER' 
              ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/30' 
              : 'border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {bracketMetrics.porVencerCount} {bracketMetrics.porVencerCount === 1 ? 'factura' : 'facturas'}
            </span>
          </div>
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Por Vencer
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Pagos programados dentro del crédito
          </p>
          <div className="mt-3">
            <div className="text-lg font-black font-mono text-emerald-700">
              ${bracketMetrics.porVencerUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              ≈ Bs. {(bracketMetrics.porVencerUsd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-2 text-[10px] font-bold text-emerald-800 flex items-center gap-1">
            <span>Plazo vigente</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* 2. 1 A 30 DÍAS DE VENCIDO (Alertas amarillas para priorizar saldos) */}
        <div 
          onClick={() => setSelectedBracket(selectedBracket === '1_A_30' ? 'ALL' : '1_A_30')}
          className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-xs transition-all relative overflow-hidden ${
            selectedBracket === '1_A_30' 
              ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/30' 
              : 'border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              {bracketMetrics.d1a30Count} {bracketMetrics.d1a30Count === 1 ? 'factura' : 'facturas'}
            </span>
          </div>
          <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
            <span>1 a 30 Días de Vencido</span>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Alertas amarillas para priorizar saldos
          </p>
          <div className="mt-3">
            <div className="text-lg font-black font-mono text-amber-800">
              ${bracketMetrics.d1a30Usd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              ≈ Bs. {(bracketMetrics.d1a30Usd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-2 text-[10px] font-bold text-amber-800 flex items-center gap-1">
            <span>Prioridad media</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* 3. 31 A 60 DÍAS DE VENCIDO (Alertas rojas para evitar cortes de despacho) */}
        <div 
          onClick={() => setSelectedBracket(selectedBracket === '31_A_60' ? 'ALL' : '31_A_60')}
          className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-xs transition-all relative overflow-hidden ${
            selectedBracket === '31_A_60' 
              ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/30' 
              : 'border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              {bracketMetrics.d31a60Count} {bracketMetrics.d31a60Count === 1 ? 'factura' : 'facturas'}
            </span>
          </div>
          <h3 className="text-xs font-black text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
            <span>31 a 60 Días de Vencido</span>
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Alertas rojas: riesgo corte despacho
          </p>
          <div className="mt-3">
            <div className="text-lg font-black font-mono text-rose-700">
              ${bracketMetrics.d31a60Usd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              ≈ Bs. {(bracketMetrics.d31a60Usd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-2 text-[10px] font-bold text-rose-800 flex items-center gap-1">
            <span>Riesgo de despacho</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* 4. MÁS DE 60 DÍAS (Deudas críticas) */}
        <div 
          onClick={() => setSelectedBracket(selectedBracket === 'MAS_60' ? 'ALL' : 'MAS_60')}
          className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-xs transition-all relative overflow-hidden ${
            selectedBracket === 'MAS_60' 
              ? 'ring-2 ring-purple-600 border-purple-600 bg-purple-50/40' 
              : 'border-slate-200 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-purple-900 text-white flex items-center justify-center font-bold">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 animate-pulse">
              {bracketMetrics.mas60Count} {bracketMetrics.mas60Count === 1 ? 'crítica' : 'críticas'}
            </span>
          </div>
          <h3 className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
            <span>Más de 60 Días</span>
            <span className="w-2 h-2 rounded-full bg-purple-700"></span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Deudas críticas / mora grave
          </p>
          <div className="mt-3">
            <div className="text-lg font-black font-mono text-purple-900">
              ${bracketMetrics.mas60Usd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              ≈ Bs. {(bracketMetrics.mas60Usd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-2 text-[10px] font-bold text-purple-800 flex items-center gap-1">
            <span>Acción inmediata requerida</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

      </div>

      {/* CASH FLOW EXPOSURE VISUAL BAR */}
      {bracketMetrics.totalDebtUsd > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-slate-800 uppercase tracking-wider">
              Distribución del Riesgo de Exposición de Caja:
            </span>
            <span className="text-slate-500 font-mono">
              100% = ${bracketMetrics.totalDebtUsd.toFixed(2)} USD
            </span>
          </div>

          <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            {bracketMetrics.porVencerUsd > 0 && (
              <div 
                style={{ width: `${(bracketMetrics.porVencerUsd / bracketMetrics.totalDebtUsd) * 100}%` }}
                className="bg-emerald-500 h-full transition-all"
                title={`Por Vencer: $${bracketMetrics.porVencerUsd.toFixed(2)} (${((bracketMetrics.porVencerUsd / bracketMetrics.totalDebtUsd) * 100).toFixed(1)}%)`}
              />
            )}
            {bracketMetrics.d1a30Usd > 0 && (
              <div 
                style={{ width: `${(bracketMetrics.d1a30Usd / bracketMetrics.totalDebtUsd) * 100}%` }}
                className="bg-amber-400 h-full transition-all"
                title={`1 a 30 Días: $${bracketMetrics.d1a30Usd.toFixed(2)} (${((bracketMetrics.d1a30Usd / bracketMetrics.totalDebtUsd) * 100).toFixed(1)}%)`}
              />
            )}
            {bracketMetrics.d31a60Usd > 0 && (
              <div 
                style={{ width: `${(bracketMetrics.d31a60Usd / bracketMetrics.totalDebtUsd) * 100}%` }}
                className="bg-rose-500 h-full transition-all"
                title={`31 a 60 Días: $${bracketMetrics.d31a60Usd.toFixed(2)} (${((bracketMetrics.d31a60Usd / bracketMetrics.totalDebtUsd) * 100).toFixed(1)}%)`}
              />
            )}
            {bracketMetrics.mas60Usd > 0 && (
              <div 
                style={{ width: `${(bracketMetrics.mas60Usd / bracketMetrics.totalDebtUsd) * 100}%` }}
                className="bg-purple-900 h-full transition-all"
                title={`Más de 60 Días: $${bracketMetrics.mas60Usd.toFixed(2)} (${((bracketMetrics.mas60Usd / bracketMetrics.totalDebtUsd) * 100).toFixed(1)}%)`}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 font-mono pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <span>Por Vencer: {((bracketMetrics.porVencerUsd / bracketMetrics.totalDebtUsd) * 100).toFixed(1)}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
              <span>1-30 Días: {((bracketMetrics.d1a30Usd / bracketMetrics.totalDebtUsd) * 100).toFixed(1)}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
              <span>31-60 Días: {((bracketMetrics.d31a60Usd / bracketMetrics.totalDebtUsd) * 100).toFixed(1)}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-900 inline-block"></span>
              <span>&gt;60 Días: {((bracketMetrics.mas60Usd / bracketMetrics.totalDebtUsd) * 100).toFixed(1)}%</span>
            </span>
          </div>
        </div>
      )}

      {/* FILTER CONTROLS & SEARCH */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por proveedor o recibo..."
            className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-900 focus:outline-none"
          />
        </div>

        {/* Bracket Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedBracket('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedBracket === 'ALL'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todas ({pendingAgingList.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedBracket('POR_VENCER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedBracket === 'POR_VENCER'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            Por Vencer ({bracketMetrics.porVencerCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedBracket('1_A_30')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedBracket === '1_A_30'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            1 a 30 Días ({bracketMetrics.d1a30Count})
          </button>
          <button
            type="button"
            onClick={() => setSelectedBracket('31_A_60')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedBracket === '31_A_60'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            31 a 60 Días ({bracketMetrics.d31a60Count})
          </button>
          <button
            type="button"
            onClick={() => setSelectedBracket('MAS_60')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedBracket === 'MAS_60'
                ? 'bg-purple-900 text-white'
                : 'bg-purple-100 text-purple-900 border border-purple-200'
            }`}
          >
            &gt; 60 Días ({bracketMetrics.mas60Count})
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="ml-auto px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Imprimir informe de antigüedad"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>
        </div>

      </div>

      {/* DETAILED AGING TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {filteredList.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">No hay facturas pendientes en este rango.</p>
            <p className="text-[11px] text-slate-400">Todos los pagos de este criterio se encuentran al día.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Proveedor</th>
                  <th className="py-3 px-4">Recibo / Factura #</th>
                  <th className="py-3 px-4">Emisión</th>
                  <th className="py-3 px-4">Vencimiento</th>
                  <th className="py-3 px-4 text-center">Rango Antigüedad</th>
                  <th className="py-3 px-4 text-right">Total Factura</th>
                  <th className="py-3 px-4 text-right">Saldo Deuda ($)</th>
                  <th className="py-3 px-4 text-right">Saldo Deuda (Bs.)</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((item) => {
                  const receipt = item.receipt;
                  const balanceBs = receipt.remainingBalanceUsd * bcvRate;

                  return (
                    <tr key={receipt.id} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* Proveedor */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onSelectSupplier(receipt.supplierId)}
                          className="text-left font-black text-slate-900 hover:text-purple-700 hover:underline block flex items-center gap-1 cursor-pointer"
                        >
                          <span>{receipt.supplierName}</span>
                          <ArrowUpRight className="w-3 h-3 text-slate-400 inline" />
                        </button>
                        <span className="text-[10px] font-mono text-slate-500 block">{receipt.supplierRif}</span>
                      </td>

                      {/* Recibo # */}
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-900">
                        {receipt.receiptNumber}
                      </td>

                      {/* Fecha Emisión */}
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {new Date(receipt.receivedAt || receipt.createdAt).toLocaleDateString('es-VE')}
                      </td>

                      {/* Fecha Vencimiento */}
                      <td className="py-3.5 px-4 font-mono text-[11px] font-semibold text-slate-800">
                        {receipt.dueDate 
                          ? new Date(receipt.dueDate + 'T23:59:59').toLocaleDateString('es-VE')
                          : 'A convenir'}
                      </td>

                      {/* Rango Antigüedad Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block ${item.badgeClass}`}>
                          {item.bracketLabel}
                        </span>
                      </td>

                      {/* Total Factura */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                        ${receipt.totalCost.toFixed(2)}
                      </td>

                      {/* Saldo Deuda USD */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-rose-700 text-sm">
                        ${receipt.remainingBalanceUsd.toFixed(2)}
                      </td>

                      {/* Saldo Deuda Bs */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                        Bs. {balanceBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectSupplier(receipt.supplierId)}
                            className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition-colors cursor-pointer"
                            title="Ver Estado de Cuenta del Proveedor"
                          >
                            Ver Perfil
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenPaymentForReceipt(receipt)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                            title="Abonar a esta deuda"
                          >
                            <Coins className="w-3 h-3" />
                            <span>Abonar</span>
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
