import React, { useState } from 'react';
import { CreditCard, Smartphone, Banknote, DollarSign, QrCode, FileText, Shuffle } from 'lucide-react';

export type PaymentMethodId = 
  | 'DEBIT_CARD' 
  | 'PAGO_MOVIL' 
  | 'CASH_BS' 
  | 'CASH_USD' 
  | 'BINANCE' 
  | 'CREDIT' 
  | 'SPLIT';

interface PaymentMethodLogoProps {
  method: PaymentMethodId;
  size?: 'sm' | 'md' | 'lg';
}

const methodIconMap: Record<PaymentMethodId, string> = {
  DEBIT_CARD: '/images/payments/debito.svg',
  PAGO_MOVIL: '/images/payments/pagomovil.svg',
  CASH_BS: '/images/payments/bs.svg',
  CASH_USD: '/images/payments/usd.svg',
  BINANCE: '/images/payments/binance.svg',
  CREDIT: '/images/payments/credito.svg',
  SPLIT: '/images/payments/mixto.svg',
};

export const PaymentMethodLogo: React.FC<PaymentMethodLogoProps> = ({ method, size = 'md' }) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: 'w-7 h-7 rounded-lg text-xs',
    md: 'w-10 h-10 rounded-xl text-base',
    lg: 'w-12 h-12 rounded-2xl text-xl',
  }[size];

  const imagePath = methodIconMap[method];

  if (imagePath && !imgError) {
    return (
      <div className={`${sizeClasses} bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs`}>
        <img
          src={imagePath}
          alt={method}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  switch (method) {
    case 'DEBIT_CARD':
      return (
        <div className={`${sizeClasses} bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0`}>
          <CreditCard className="w-1/2 h-1/2" />
        </div>
      );
    case 'PAGO_MOVIL':
      return (
        <div className={`${sizeClasses} bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0`}>
          <Smartphone className="w-1/2 h-1/2" />
        </div>
      );
    case 'CASH_BS':
      return (
        <div className={`${sizeClasses} bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0`}>
          <Banknote className="w-1/2 h-1/2" />
        </div>
      );
    case 'CASH_USD':
      return (
        <div className={`${sizeClasses} bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0`}>
          <DollarSign className="w-1/2 h-1/2" />
        </div>
      );
    case 'BINANCE':
      return (
        <div className={`${sizeClasses} bg-yellow-50 text-yellow-700 border border-yellow-200 flex items-center justify-center shrink-0`}>
          <QrCode className="w-1/2 h-1/2" />
        </div>
      );
    case 'CREDIT':
      return (
        <div className={`${sizeClasses} bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0`}>
          <FileText className="w-1/2 h-1/2" />
        </div>
      );
    case 'SPLIT':
      return (
        <div className={`${sizeClasses} bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0`}>
          <Shuffle className="w-1/2 h-1/2" />
        </div>
      );
    default:
      return (
        <div className={`${sizeClasses} bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0`}>
          <CreditCard className="w-1/2 h-1/2" />
        </div>
      );
  }
};

