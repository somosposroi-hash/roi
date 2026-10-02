import { Client, Sale } from '../types';

export interface ClientDebtSummary {
  client: Client;
  creditSales: Sale[];
  payments: Sale[];
  totalCreditUsd: number;
  totalPaidUsd: number;
  currentDebtUsd: number;
  currentDebtBs: number;
  statusDetails: {
    status: 'SOLVENTE' | 'A_TIEMPO' | 'PRONTO_A_VENCER' | 'VENCIDO';
    label: string;
    colorClass: string;
    daysDiff: number;
  };
  isLimitExceeded: boolean;
  creditLimit: number;
}

export interface CxcOverallStats {
  totalCreditSalesUsd: number;
  totalRemainingDebtUsd: number;
  totalOverdueDebtUsd: number;
  moraPercentage: number;
  activeDebtorsCount: number;
  overdueDebtorsCount: number;
  limitExceededCount: number;
  limitExceededClients: ClientDebtSummary[];
  overdueClients: ClientDebtSummary[];
}

/**
 * Helper to parse notes METADATA_JSON or legacy notes
 */
export function parseSaleMeta(notes?: string) {
  let clientName = 'Contado / Cliente General';
  let docType = '';
  let docNumber = '';
  let clientPhone = '';
  let clientNotes = '';
  let discount: { amount: number; type: 'USD' | 'BS'; description: string } | null = null;
  let charge: { amount: number; type: 'USD' | 'BS'; description: string } | null = null;
  let reference = notes || '';
  let type: string | null = null;
  let paymentDetails: any = null;

  if (notes) {
    if (notes.startsWith('METADATA_JSON:')) {
      try {
        const jsonStr = notes.replace('METADATA_JSON:', '');
        const meta = JSON.parse(jsonStr);
        if (meta.client) {
          clientName = meta.client.name;
          docType = meta.client.docType;
          docNumber = meta.client.docNumber;
          clientPhone = meta.client.phone || '';
          clientNotes = meta.client.notes || '';
        }
        discount = meta.discount || null;
        charge = meta.charge || null;
        reference = meta.paymentReference || '';
        type = meta.type || null;
        paymentDetails = meta.paymentDetails || null;
      } catch (e) {
        console.error('Error parsing METADATA_JSON:', e);
      }
    } else if (notes.startsWith('CLIENT_DATA_JSON:')) {
      try {
        const parts = notes.split(' | REFERENCE: ');
        const jsonStr = parts[0].replace('CLIENT_DATA_JSON:', '');
        const clientData = JSON.parse(jsonStr);
        clientName = clientData.name;
        docType = clientData.docType;
        docNumber = clientData.docNumber;
        clientPhone = clientData.phone || '';
        clientNotes = clientData.notes || '';
        reference = parts[1] || '';
      } catch (e) {
        console.error('Error parsing client data from notes:', e);
      }
    }
  }

  return {
    clientName,
    docType,
    docNumber,
    clientPhone,
    clientNotes,
    discount,
    charge,
    reference,
    type,
    paymentDetails,
  };
}

/**
 * Extract credit amount for a specific sale (and specific client)
 */
export function getCreditAmountForSale(sale: Sale, clientDocNumber?: string): number {
  if (sale.status === 'VOIDED') {
    return 0;
  }

  const meta = parseSaleMeta(sale.notes);

  if (clientDocNumber && meta.docNumber !== clientDocNumber) {
    return 0;
  }

  if (sale.paymentMethod === 'CREDIT') {
    return sale.total;
  }

  if (meta.paymentDetails) {
    const creditPart = meta.paymentDetails.creditAmountUsd || 0;
    if (creditPart > 0) return creditPart;
  }

  if (meta.reference && meta.reference.includes('Crédito / Fiado: $')) {
    const creditMatch = meta.reference.match(/Crédito \/ Fiado: \$([0-9.]+)/);
    if (creditMatch && creditMatch[1]) {
      return parseFloat(creditMatch[1]);
    }
  }

  return 0;
}

/**
 * Extract payment/abono amount for a specific sale / client
 */
export function getPaymentAmountForSale(sale: Sale, clientDocNumber?: string): number {
  if (sale.status === 'VOIDED') {
    return 0;
  }

  const meta = parseSaleMeta(sale.notes);

  if (!sale.invoiceNumber.startsWith('ABO-') && meta.type !== 'cxc_payment') {
    return 0;
  }

  if (clientDocNumber && meta.docNumber !== clientDocNumber) {
    return 0;
  }

  if (meta.paymentDetails) {
    return meta.paymentDetails.amountPaidUsd || 0;
  }

  return sale.total;
}

/**
 * Helper to compute a client's debt status and aging
 */
export function calculateClientStatus(client: Client, currentDebtUsd: number, creditSales: Sale[]) {
  if (currentDebtUsd <= 0.01) {
    return {
      status: 'SOLVENTE' as const,
      label: 'Solvente',
      colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      daysDiff: 0,
    };
  }

  const creditDaysLimit = client.creditDays || 15;
  let oldestDate = new Date();
  if (creditSales.length > 0) {
    const dates = creditSales.map((s) => new Date(s.createdAt).getTime()).filter((t) => !isNaN(t));
    if (dates.length > 0) {
      oldestDate = new Date(Math.min(...dates));
    }
  }

  const dueDate = new Date(oldestDate);
  dueDate.setDate(dueDate.getDate() + creditDaysLimit);

  const now = new Date();
  const diffTime = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'VENCIDO' as const,
      label: `Vencido (${Math.abs(diffDays)}d)`,
      colorClass: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
      daysDiff: diffDays,
    };
  } else if (diffDays <= 3) {
    return {
      status: 'PRONTO_A_VENCER' as const,
      label: diffDays === 0 ? 'Vence hoy' : `Pronto a vencer (${diffDays}d)`,
      colorClass: 'bg-amber-50 text-amber-700 border-amber-200 font-bold',
      daysDiff: diffDays,
    };
  } else {
    return {
      status: 'A_TIEMPO' as const,
      label: `Al día (${diffDays}d restantes)`,
      colorClass: 'bg-sky-50 text-sky-700 border-sky-200',
      daysDiff: diffDays,
    };
  }
}

/**
 * Calculate full CXC metrics for a client
 */
export function getClientDebtDetails(client: Client, sales: Sale[], bcvRate = 1): ClientDebtSummary {
  const clientCreditSales = sales.filter((s) => {
    const meta = parseSaleMeta(s.notes);
    return meta.docNumber === client.docNumber && getCreditAmountForSale(s, client.docNumber) > 0;
  });

  const clientPayments = sales.filter((s) => {
    const meta = parseSaleMeta(s.notes);
    return meta.docNumber === client.docNumber && (s.invoiceNumber.startsWith('ABO-') || meta.type === 'cxc_payment');
  });

  const totalCreditUsd = clientCreditSales.reduce((acc, s) => acc + getCreditAmountForSale(s, client.docNumber), 0);
  const totalPaidUsd = clientPayments.reduce((acc, s) => acc + getPaymentAmountForSale(s, client.docNumber), 0);
  const currentDebtUsd = Math.max(0, totalCreditUsd - totalPaidUsd);
  const statusDetails = calculateClientStatus(client, currentDebtUsd, clientCreditSales);

  const creditLimit = client.creditLimit || 0;
  const isLimitExceeded = creditLimit > 0 && currentDebtUsd > creditLimit;

  return {
    client,
    creditSales: clientCreditSales,
    payments: clientPayments,
    totalCreditUsd,
    totalPaidUsd,
    currentDebtUsd,
    currentDebtBs: currentDebtUsd * bcvRate,
    statusDetails,
    isLimitExceeded,
    creditLimit,
  };
}

/**
 * Calculate aggregated statistics for all clients
 */
export function calculateOverallCxcStats(clients: Client[], sales: Sale[], bcvRate = 1): CxcOverallStats {
  const summaries = clients.map((c) => getClientDebtDetails(c, sales, bcvRate));

  let totalCreditSalesUsd = 0;
  let totalRemainingDebtUsd = 0;
  let totalOverdueDebtUsd = 0;
  let activeDebtorsCount = 0;
  let overdueDebtorsCount = 0;
  const limitExceededClients: ClientDebtSummary[] = [];
  const overdueClients: ClientDebtSummary[] = [];

  for (const s of summaries) {
    totalCreditSalesUsd += s.totalCreditUsd;
    totalRemainingDebtUsd += s.currentDebtUsd;

    if (s.currentDebtUsd > 0.01) {
      activeDebtorsCount++;

      if (s.statusDetails.status === 'VENCIDO') {
        totalOverdueDebtUsd += s.currentDebtUsd;
        overdueDebtorsCount++;
        overdueClients.push(s);
      }

      if (s.isLimitExceeded) {
        limitExceededClients.push(s);
      }
    }
  }

  const moraPercentage = totalRemainingDebtUsd > 0 
    ? Math.round((totalOverdueDebtUsd / totalRemainingDebtUsd) * 1000) / 10 
    : 0;

  return {
    totalCreditSalesUsd,
    totalRemainingDebtUsd,
    totalOverdueDebtUsd,
    moraPercentage,
    activeDebtorsCount,
    overdueDebtorsCount,
    limitExceededCount: limitExceededClients.length,
    limitExceededClients,
    overdueClients,
  };
}
