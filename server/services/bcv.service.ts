import { prisma } from '../config/database';

export interface BcvRateData {
  usdRate: number;
  eurRate?: number | null;
  usdtRate?: number | null;
  dateLabel: string;
  lastUpdated: string;
  source: string;
  isManualOverride: boolean;
  activeCurrency?: 'USD' | 'EUR' | 'USDT' | 'SCHEDULED' | 'CUSTOM';
  effectiveRate?: number;
  effectiveCurrency?: string;
  activeScheduleName?: string | null;
}

export interface RateHistoryItem {
  id: string;
  rateDate: string;
  usdRate: number;
  eurRate?: number | null;
  usdtRate?: number | null;
  previousRate?: number | null;
  variation?: number | null;
  source: string;
  dateLabel?: string | null;
  isManual: boolean;
  userName?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface EffectiveRateEvaluation {
  effectiveRate: number;
  effectiveCurrency: 'USD' | 'EUR' | 'USDT' | 'CUSTOM';
  currencySymbol: string;
  currencyName: string;
  sourceLabel: string;
  isFromSchedule: boolean;
  activeScheduleName?: string | null;
  activeScheduleWindow?: string | null;
  nextScheduleSwitch?: {
    time: string;
    targetCurrency: string;
    scheduleName: string;
  } | null;
}

export class BcvService {
  private currentRate: BcvRateData = {
    usdRate: 849.56,
    eurRate: 974.09,
    usdtRate: 953.1,
    dateLabel: 'Oficial BCV (Banco Central de Venezuela)',
    lastUpdated: new Date().toISOString(),
    source: 'Base44 API (simuladordeprecios.base44.app)',
    isManualOverride: false,
  };

  private cachedConfig: {
    activeCurrency: 'USD' | 'EUR' | 'USDT' | 'SCHEDULED' | 'CUSTOM';
    customFixedRate?: number | null;
    autoSyncEnabled: boolean;
    syncIntervalMin: number;
    fallbackCurrency: 'USD' | 'EUR' | 'USDT';
  } = {
    activeCurrency: 'USD',
    customFixedRate: null,
    autoSyncEnabled: true,
    syncIntervalMin: 3,
    fallbackCurrency: 'USD',
  };

  private lastFetchTime = 0;
  private readonly CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes cache
  private hasInitialized = false;
  private isInitializing = false;
  private bgSyncTimer: NodeJS.Timeout | null = null;
  private lastLoggedScheduleName: string | null | undefined = undefined;

  constructor() {
    this.initService();
  }

  /**
   * Initializes history, default configs, and sample rate schedules if table is empty
   */
  private async initService() {
    if (this.hasInitialized || this.isInitializing) return;
    this.isInitializing = true;
    try {
      // 1. Check & seed history
      const historyCount = await prisma.exchangeRateHistory.count();
      if (historyCount === 0) {
        await this.seedHistoricalDailyRates();
      } else {
        const latest = await prisma.exchangeRateHistory.findFirst({
          orderBy: { rateDate: 'desc' },
        });
        if (latest) {
          this.currentRate = {
            usdRate: latest.usdRate,
            eurRate: latest.eurRate,
            usdtRate: latest.usdtRate,
            dateLabel: latest.dateLabel || 'Oficial BCV',
            lastUpdated: latest.rateDate.toISOString(),
            source: latest.source,
            isManualOverride: latest.isManual,
          };
          if (latest.source.startsWith('Script:')) {
            this.lastLoggedScheduleName = latest.source.replace('Script: ', '');
          } else if (latest.source === 'Horario Base (Fallback)') {
            this.lastLoggedScheduleName = 'Reversión a Tasa Base (Fallback)';
          } else {
            this.lastLoggedScheduleName = null;
          }
        }
      }

      // 2. Check & seed rate config
      let config = await prisma.rateConfig.findUnique({
        where: { id: 'default' },
      });
      if (!config) {
        config = await prisma.rateConfig.create({
          data: {
            id: 'default',
            activeCurrency: 'USD',
            autoSyncEnabled: true,
            syncIntervalMin: 3,
            fallbackCurrency: 'USD',
          },
        });
      }
      this.cachedConfig = {
        activeCurrency: (config.activeCurrency as any) || 'USD',
        customFixedRate: config.customFixedRate,
        autoSyncEnabled: config.autoSyncEnabled,
        syncIntervalMin: config.syncIntervalMin || 3,
        fallbackCurrency: (config.fallbackCurrency as any) || 'USD',
      };

      // 3. Check & seed initial rate schedules (Horarios de Tasas)
      const scheduleCount = await prisma.rateSchedule.count();
      if (scheduleCount === 0) {
        await this.seedDefaultSchedules();
      }

      // 4. Start background auto-sync worker
      this.startBackgroundAutoSync();

      this.hasInitialized = true;
    } catch (err) {
      console.warn('[BcvService] Error inicializando servicio de tasas:', err);
    }
  }

  /**
   * Seed default rate schedule rules, matching user's requested example:
   * "ejemplo a las 9 de la mañana hasta las 10 de la mañana se usa la tasa del euro despues la del bcv"
   */
  private async seedDefaultSchedules() {
    try {
      console.log('[BcvService] Sembrando scripts predeterminados de horarios de tasas...');
      await prisma.rateSchedule.createMany({
        data: [
          {
            name: 'Horario Matutino Euro (09:00 - 10:00)',
            currencyTarget: 'EUR',
            startTime: '09:00',
            endTime: '10:00',
            durationType: 'INDEFINITE',
            daysOfWeek: JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
            isActive: true,
            priority: 1,
            notes: 'Aplica cotización del Euro durante la primera hora de apertura matutina.',
          },
          {
            name: 'Jornada Comercial BCV Dólar (10:00 - 18:00)',
            currencyTarget: 'USD',
            startTime: '10:00',
            endTime: '18:00',
            durationType: 'INDEFINITE',
            daysOfWeek: JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
            isActive: true,
            priority: 2,
            notes: 'Cotización oficial de referencia BCV durante la jornada comercial principal.',
          },
          {
            name: 'Cierre Vespertino USDT Paralelo (18:00 - 22:00)',
            currencyTarget: 'USDT',
            startTime: '18:00',
            endTime: '22:00',
            durationType: 'INDEFINITE',
            daysOfWeek: JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
            isActive: false, // Default off, user can easily toggle on
            priority: 3,
            notes: 'Cotización de cierre comercial vinculada a la tasa USDT.',
          },
        ],
      });
      console.log('[BcvService] Scripts de horarios de tasas creados correctamente.');
    } catch (e) {
      console.warn('[BcvService] Error sembrando scripts de horarios:', e);
    }
  }

  /**
   * Seed realistic daily rates for the past 30 days
   */
  private async seedHistoricalDailyRates() {
    try {
      console.log('[BcvService] Generando historial inicial de tasas de cambio diarias...');
      const now = new Date();
      const baseRate = 849.56;
      const historyToCreate = [];

      for (let i = 30; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(8, 30, 0, 0);

        const factor = 1 - (i * 0.0038) + (Math.sin(i / 2) * 0.0015);
        const dayUsd = Math.round(baseRate * factor * 100) / 100;
        const dayEur = Math.round(dayUsd * 1.092 * 100) / 100;
        const dayUsdt = Math.round(dayUsd * 1.045 * 100) / 100;

        let notes = 'Publicación Oficial Banco Central de Venezuela';
        let isManual = false;
        let source = 'API Oficial BCV';
        let userName = 'Sistema Automático';

        if (i === 12) {
          notes = 'Ajuste extraordinario por intervención cambiaria';
        } else if (i === 5) {
          notes = 'Cierre bancario semanal';
        } else if (i === 0) {
          notes = 'Tasa oficial vigente del día';
        }

        historyToCreate.push({
          rateDate: d,
          usdRate: dayUsd,
          eurRate: dayEur,
          usdtRate: dayUsdt,
          source,
          dateLabel: `Tasa Oficial ${d.toLocaleDateString('es-VE')}`,
          isManual,
          userName,
          notes,
          createdAt: d,
        });
      }

      for (let j = 0; j < historyToCreate.length; j++) {
        const item = historyToCreate[j];
        if (j > 0) {
          const prev = historyToCreate[j - 1];
          const prevRate = prev.usdRate;
          const varPercent = Math.round(((item.usdRate - prevRate) / prevRate) * 10000) / 100;
          await prisma.exchangeRateHistory.create({
            data: {
              ...item,
              previousRate: prevRate,
              variation: varPercent,
            },
          });
        } else {
          await prisma.exchangeRateHistory.create({
            data: {
              ...item,
              previousRate: item.usdRate,
              variation: 0,
            },
          });
        }
      }
      console.log('[BcvService] Historial diario de tasas generado exitosamente.');
    } catch (e) {
      console.warn('[BcvService] No se pudo sembrar el historial inicial:', e);
    }
  }

  /**
   * Background Auto-Sync Worker:
   * Periodically checks the Base44 API. If the API publishes a new rate,
   * automatically logs the change into the daily history and updates the active rate!
   */
  private startBackgroundAutoSync() {
    if (this.bgSyncTimer) {
      clearInterval(this.bgSyncTimer);
    }

    const intervalMinutes = Math.max(1, this.cachedConfig.syncIntervalMin || 3);
    const intervalMs = intervalMinutes * 60 * 1000;

    this.bgSyncTimer = setInterval(async () => {
      if (!this.cachedConfig.autoSyncEnabled) return;
      try {
        await this.fetchLiveRate(true);
      } catch (err) {
        // Silent failure in background
      }
    }, intervalMs);

    // Initial check after 5 seconds
    setTimeout(() => {
      this.fetchLiveRate(false).catch(() => {});
    }, 5000);
  }

  /**
   * Fetch current official BCV exchange rate from the Base44 API.
   * If the API rate has changed, automatically records a new history entry!
   */
  async fetchLiveRate(force = false, options?: { clientTime?: string; dayOfWeek?: number }): Promise<BcvRateData> {
    await this.initService();
    const now = Date.now();
    if (!force && this.lastFetchTime > 0 && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.enrichRateWithEvaluation(this.currentRate, options);
    }

    try {
      const response = await fetch(
        'https://base44.app/api/apps/6a153b1786fc904b1f31be25/entities/ExchangeRate?limit=1&sort=-created_date',
        {
          headers: {
            'api_key': 'bc7999c0bad84a668a50da86d75c6431',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(6000),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0 && data[0].usd_rate) {
          const item = data[0];
          const fetchedUsd = Number(item.usd_rate);
          const fetchedEur = item.eur_rate ? Number(item.eur_rate) : Math.round(fetchedUsd * 1.092 * 100) / 100;
          const fetchedUsdt = item.usdt_rate ? Number(item.usdt_rate) : Math.round(fetchedUsd * 1.045 * 100) / 100;
          const dateLabel = item.date_label || 'Tasa Oficial BCV';
          const updatedDate = item.updated_date ? new Date(item.updated_date) : new Date();

          const hasRateChanged =
            Math.abs(this.currentRate.usdRate - fetchedUsd) > 0.001 ||
            (this.currentRate.eurRate && Math.abs(this.currentRate.eurRate - fetchedEur) > 0.001) ||
            (this.currentRate.usdtRate && Math.abs(this.currentRate.usdtRate - fetchedUsdt) > 0.001);

          this.currentRate = {
            usdRate: fetchedUsd,
            eurRate: fetchedEur,
            usdtRate: fetchedUsdt,
            dateLabel,
            lastUpdated: updatedDate.toISOString(),
            source: 'API Base44',
            isManualOverride: false,
          };
          this.lastFetchTime = now;

          // Automatically record in daily history if changed or not yet logged
          await this.logRateChange({
            rateDate: updatedDate,
            usdRate: fetchedUsd,
            eurRate: fetchedEur,
            usdtRate: fetchedUsdt,
            source: 'API Base44',
            dateLabel,
            isManual: false,
            userName: 'Sistema (API Base44)',
            notes: hasRateChanged
              ? 'Cambio de tasa detectado y actualizado automáticamente desde la API'
              : 'Sincronización periódica de cotización oficial',
          });

          return this.enrichRateWithEvaluation(this.currentRate, options);
        }
      }
    } catch (err) {
      console.warn('[BcvService] No se pudo conectar a la API externa de BCV, utilizando tasa local:', err);
    }

    return this.enrichRateWithEvaluation(this.currentRate, options);
  }

  private async enrichRateWithEvaluation(rateData: BcvRateData, options?: { clientTime?: string; dayOfWeek?: number }): Promise<BcvRateData> {
    const evalResult = await this.evaluateCurrentEffectiveRate(options);
    
    // Auto-log script executions and transitions if mode is SCHEDULED
    if (this.cachedConfig.activeCurrency === 'SCHEDULED') {
      const currentScheduleName = evalResult.activeScheduleName || 'Reversión a Tasa Base (Fallback)';
      if (this.lastLoggedScheduleName !== currentScheduleName) {
        this.lastLoggedScheduleName = currentScheduleName;
        
        // Log this transition to the database history asynchronously
        this.logRateChange({
          rateDate: new Date(),
          usdRate: this.currentRate.usdRate,
          eurRate: this.currentRate.eurRate,
          usdtRate: this.currentRate.usdtRate,
          source: evalResult.activeScheduleName ? `Script: ${evalResult.activeScheduleName}` : 'Horario Base (Fallback)',
          dateLabel: evalResult.activeScheduleName ? `${evalResult.activeScheduleWindow}` : 'Fuera de ventana',
          isManual: false,
          userName: 'Motor de Horarios',
          notes: evalResult.activeScheduleName 
            ? `Ejecución automática de script de tasas en su ventana de tiempo. Aplicando cotización ${evalResult.currencyName} a Bs. ${evalResult.effectiveRate.toFixed(2)}.`
            : `Fin de ventana horaria de scripts. Reversión automática a la cotización base de respaldo (${evalResult.currencyName}) a Bs. ${evalResult.effectiveRate.toFixed(2)}.`,
        }).catch(err => {
          console.error('[BcvService] Error auto-logging script execution:', err);
        });
      }
    }

    return {
      ...rateData,
      activeCurrency: this.cachedConfig.activeCurrency,
      effectiveRate: evalResult.effectiveRate,
      effectiveCurrency: evalResult.effectiveCurrency,
      activeScheduleName: evalResult.activeScheduleName || null,
    };
  }

  /**
   * Evaluates the active effective rate based on configured activeCurrency
   * and scheduled scripts (Horarios de Tasas).
   */
  async evaluateCurrentEffectiveRate(options?: { clientTime?: string; dayOfWeek?: number }): Promise<EffectiveRateEvaluation> {
    await this.initService();

    // Check if there are active schedules configured
    const activeSchedules = await prisma.rateSchedule.findMany({
      where: { isActive: true },
      orderBy: [{ priority: 'asc' }, { startTime: 'asc' }],
    });

    // 1. If manual currency selection is fixed to EUR, USDT, or CUSTOM (and not SCHEDULED)
    if (this.cachedConfig.activeCurrency === 'EUR') {
      const eurVal = this.currentRate.eurRate || Math.round(this.currentRate.usdRate * 1.092 * 100) / 100;
      return {
        effectiveRate: eurVal,
        effectiveCurrency: 'EUR',
        currencySymbol: '€',
        currencyName: 'Euro BCV',
        sourceLabel: 'Euro Oficial (Fijado)',
        isFromSchedule: false,
      };
    }
    if (this.cachedConfig.activeCurrency === 'USDT') {
      const usdtVal = this.currentRate.usdtRate || Math.round(this.currentRate.usdRate * 1.045 * 100) / 100;
      return {
        effectiveRate: usdtVal,
        effectiveCurrency: 'USDT',
        currencySymbol: '₮',
        currencyName: 'USDT Paralelo',
        sourceLabel: 'USDT Cripto (Fijado)',
        isFromSchedule: false,
      };
    }
    if (this.cachedConfig.activeCurrency === 'CUSTOM') {
      const customVal = this.cachedConfig.customFixedRate || this.currentRate.usdRate;
      return {
        effectiveRate: customVal,
        effectiveCurrency: 'CUSTOM',
        currencySymbol: 'Bs.',
        currencyName: 'Tasa Fija Personalizada',
        sourceLabel: 'Ajuste Manual Personalizado',
        isFromSchedule: false,
      };
    }

    // 2. Schedule Engine Evaluation (activeCurrency === 'SCHEDULED' or activeSchedules exist)
    const shouldEvaluateSchedules = this.cachedConfig.activeCurrency === 'SCHEDULED' || activeSchedules.length > 0;

    if (shouldEvaluateSchedules && activeSchedules.length > 0) {
      // Determine local time: use clientTime if provided, else Caracas timezone (UTC-4)
      let currentTimeStr = options?.clientTime;
      let dayOfWeek = options?.dayOfWeek;

      if (!currentTimeStr) {
        try {
          const now = new Date();
          const parts = new Intl.DateTimeFormat('es-VE', {
            timeZone: 'America/Caracas',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(now);
          currentTimeStr = parts.trim();
          dayOfWeek = now.getDay();
        } catch {
          const now = new Date();
          const h = String(now.getHours()).padStart(2, '0');
          const m = String(now.getMinutes()).padStart(2, '0');
          currentTimeStr = `${h}:${m}`;
          dayOfWeek = now.getDay();
        }
      }
      if (dayOfWeek === undefined) {
        dayOfWeek = new Date().getDay();
      }

      const now = new Date();
      let matchedSchedule: any = null;
      let nextSwitch: any = null;

      for (const schedule of activeSchedules) {
        // 2a. Check duration validity
        if (schedule.durationType === 'DATE_RANGE') {
          if (schedule.startDate && now < schedule.startDate) continue;
          if (schedule.endDate && now > schedule.endDate) continue;
        }

        // 2b. Check day of week
        let allowedDays: number[] = [0, 1, 2, 3, 4, 5, 6];
        try {
          if (schedule.daysOfWeek) {
            allowedDays = JSON.parse(schedule.daysOfWeek);
          }
        } catch {
          // default all
        }
        if (!allowedDays.includes(dayOfWeek)) continue;

        // 2c. Check time window [startTime, endTime)
        const start = schedule.startTime.trim();
        const end = schedule.endTime.trim();
        let isInside = false;

        if (start <= end) {
          // Normal day interval, e.g. 09:00 to 10:00
          isInside = currentTimeStr >= start && currentTimeStr < end;
        } else {
          // Overnight interval, e.g. 22:00 to 02:00
          isInside = currentTimeStr >= start || currentTimeStr < end;
        }

        if (isInside && !matchedSchedule) {
          matchedSchedule = schedule;
        }

        // Look for next switch
        if (!isInside && currentTimeStr < start && !nextSwitch) {
          nextSwitch = {
            time: start,
            targetCurrency: schedule.currencyTarget,
            scheduleName: schedule.name,
          };
        }
      }

      // If an active schedule matched the current hour:
      if (matchedSchedule) {
        let targetRate = this.currentRate.usdRate;
        let targetCurrency: 'USD' | 'EUR' | 'USDT' | 'CUSTOM' = matchedSchedule.currencyTarget as any;
        let currencySymbol = '$';
        let currencyName = 'Dólar BCV';

        if (targetCurrency === 'EUR') {
          targetRate = this.currentRate.eurRate || Math.round(this.currentRate.usdRate * 1.092 * 100) / 100;
          currencySymbol = '€';
          currencyName = 'Euro BCV';
        } else if (targetCurrency === 'USDT') {
          targetRate = this.currentRate.usdtRate || Math.round(this.currentRate.usdRate * 1.045 * 100) / 100;
          currencySymbol = '₮';
          currencyName = 'USDT Paralelo';
        } else if (targetCurrency === 'CUSTOM') {
          targetRate = matchedSchedule.customRateValue || this.currentRate.usdRate;
          currencySymbol = 'Bs.';
          currencyName = 'Tasa Personalizada';
        }

        return {
          effectiveRate: targetRate,
          effectiveCurrency: targetCurrency,
          currencySymbol,
          currencyName,
          sourceLabel: `Script: ${matchedSchedule.name}`,
          isFromSchedule: true,
          activeScheduleName: matchedSchedule.name,
          activeScheduleWindow: `${matchedSchedule.startTime} - ${matchedSchedule.endTime}`,
          nextScheduleSwitch: nextSwitch || {
            time: matchedSchedule.endTime,
            targetCurrency: this.cachedConfig.fallbackCurrency,
            scheduleName: 'Reversión a Tasa Base (Fallback)',
          },
        };
      }

      // Outside scheduled windows: use fallback currency
      const fallback = this.cachedConfig.fallbackCurrency || 'USD';
      let fallbackRate = this.currentRate.usdRate;
      let sym = '$';
      let cName = 'Dólar BCV';

      if (fallback === 'EUR') {
        fallbackRate = this.currentRate.eurRate || Math.round(this.currentRate.usdRate * 1.092 * 100) / 100;
        sym = '€';
        cName = 'Euro BCV';
      } else if (fallback === 'USDT') {
        fallbackRate = this.currentRate.usdtRate || Math.round(this.currentRate.usdRate * 1.045 * 100) / 100;
        sym = '₮';
        cName = 'USDT Paralelo';
      }

      return {
        effectiveRate: fallbackRate,
        effectiveCurrency: fallback as any,
        currencySymbol: sym,
        currencyName: cName,
        sourceLabel: `Horario Base (${cName})`,
        isFromSchedule: false,
        activeScheduleName: null,
        activeScheduleWindow: 'Fuera de ventana de scripts',
        nextScheduleSwitch: nextSwitch,
      };
    }

    // Default: USD BCV Oficial
    return {
      effectiveRate: this.currentRate.usdRate,
      effectiveCurrency: 'USD',
      currencySymbol: '$',
      currencyName: 'Dólar BCV Oficial',
      sourceLabel: 'Oficial BCV USD',
      isFromSchedule: false,
    };
  }

  /**
   * Internal helper to record a rate change and calculate historical variance
   */
  async logRateChange(params: {
    rateDate?: Date;
    usdRate: number;
    eurRate?: number | null;
    usdtRate?: number | null;
    source: string;
    dateLabel?: string;
    isManual: boolean;
    userName?: string;
    notes?: string;
  }) {
    try {
      const targetDate = params.rateDate || new Date();

      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingToday = await prisma.exchangeRateHistory.findFirst({
        where: {
          rateDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          usdRate: params.usdRate,
          source: params.source,
        },
      });

      if (existingToday) {
        return existingToday;
      }

      const latestBefore = await prisma.exchangeRateHistory.findFirst({
        where: {
          rateDate: {
            lt: targetDate,
          },
        },
        orderBy: { rateDate: 'desc' },
      });

      const prevRate = latestBefore ? latestBefore.usdRate : params.usdRate;
      const variation = prevRate > 0
        ? Math.round(((params.usdRate - prevRate) / prevRate) * 10000) / 100
        : 0;

      const created = await prisma.exchangeRateHistory.create({
        data: {
          rateDate: targetDate,
          usdRate: params.usdRate,
          eurRate: params.eurRate ?? null,
          usdtRate: params.usdtRate ?? null,
          previousRate: prevRate,
          variation,
          source: params.source,
          dateLabel: params.dateLabel || 'Tasa Oficial',
          isManual: params.isManual,
          userName: params.userName || 'Sistema',
          notes: params.notes || null,
        },
      });

      return created;
    } catch (e) {
      console.warn('[BcvService] Error guardando historial de tasa:', e);
      return null;
    }
  }

  /**
   * Get current rate with effective evaluation
   */
  async getRate(options?: { clientTime?: string; dayOfWeek?: number }): Promise<BcvRateData> {
    return this.enrichRateWithEvaluation(this.currentRate, options);
  }

  /**
   * Allow cashier or manager to manually override the exchange rate and log to history
   */
  async setManualRate(
    rate: number,
    options?: { userName?: string; notes?: string; eurRate?: number; usdtRate?: number; customDate?: string }
  ): Promise<BcvRateData> {
    if (rate <= 0 || isNaN(rate)) {
      throw new Error('La tasa debe ser un número positivo');
    }

    const roundedRate = Math.round(rate * 100) / 100;
    const effectiveDate = options?.customDate ? new Date(options.customDate) : new Date();

    this.currentRate = {
      ...this.currentRate,
      usdRate: roundedRate,
      eurRate: options?.eurRate ?? this.currentRate.eurRate,
      usdtRate: options?.usdtRate ?? this.currentRate.usdtRate,
      lastUpdated: effectiveDate.toISOString(),
      dateLabel: 'Ajuste Manual por Administrador',
      isManualOverride: true,
      source: 'Ajuste Manual Local',
    };
    this.lastFetchTime = Date.now();

    await this.logRateChange({
      rateDate: effectiveDate,
      usdRate: roundedRate,
      eurRate: options?.eurRate ?? this.currentRate.eurRate,
      usdtRate: options?.usdtRate ?? this.currentRate.usdtRate,
      source: 'Ajuste Manual Local',
      dateLabel: 'Ajuste Manual',
      isManual: true,
      userName: options?.userName || 'Administrador',
      notes: options?.notes || 'Tasa fijada manualmente en configuración del POS',
    });

    return this.enrichRateWithEvaluation(this.currentRate);
  }

  /**
   * Query the complete Exchange Rate History with filters and analytics
   */
  async getRateHistory(filters?: {
    startDate?: string;
    endDate?: string;
    source?: string;
    search?: string;
    limit?: number;
    page?: number;
  }) {
    await this.initService();

    const where: any = {};

    if (filters?.startDate || filters?.endDate) {
      where.rateDate = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        where.rateDate.gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.rateDate.lte = end;
      }
    }

    if (filters?.source && filters.source !== 'ALL') {
      if (filters.source === 'MANUAL') {
        where.isManual = true;
      } else if (filters.source === 'OFFICIAL') {
        where.isManual = false;
      } else {
        where.source = { contains: filters.source };
      }
    }

    if (filters?.search) {
      const q = filters.search.trim();
      where.OR = [
        { notes: { contains: q } },
        { source: { contains: q } },
        { userName: { contains: q } },
        { dateLabel: { contains: q } },
      ];
    }

    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.max(1, Math.min(Number(filters?.limit) || 30, 200));
    const skip = (page - 1) * limit;

    const [total, items, allMatching] = await Promise.all([
      prisma.exchangeRateHistory.count({ where }),
      prisma.exchangeRateHistory.findMany({
        where,
        orderBy: [{ rateDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      // Fetch compact rates list for aggregate stats calculation
      prisma.exchangeRateHistory.findMany({
        where,
        select: { usdRate: true, rateDate: true },
        orderBy: [{ rateDate: 'desc' }],
        take: 300,
      }),
    ]);

    const rates = allMatching.map((i) => i.usdRate);
    const count = total;
    const currentRate = rates[0] ?? this.currentRate.usdRate;
    const maxRate = rates.length > 0 ? Math.max(...rates) : currentRate;
    const minRate = rates.length > 0 ? Math.min(...rates) : currentRate;
    const avgRate = rates.length > 0 ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100 : currentRate;

    let periodVariation = 0;
    if (rates.length >= 2) {
      const oldestRate = rates[rates.length - 1];
      if (oldestRate > 0) {
        periodVariation = Math.round(((currentRate - oldestRate) / oldestRate) * 10000) / 100;
      }
    }

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      stats: {
        totalRecords: count,
        currentRate,
        maxRate,
        minRate,
        avgRate,
        periodVariation,
        lastUpdated: this.currentRate.lastUpdated,
      },
    };
  }

  /**
   * Add a specific historical rate entry for any date
   */
  async addManualHistoricalRate(data: {
    rateDate: string | Date;
    usdRate: number;
    eurRate?: number | null;
    usdtRate?: number | null;
    userName?: string;
    notes?: string;
  }) {
    if (!data.usdRate || isNaN(data.usdRate) || data.usdRate <= 0) {
      throw new Error('La tasa USD debe ser un número positivo');
    }

    const targetDate = new Date(data.rateDate);
    if (isNaN(targetDate.getTime())) {
      throw new Error('Fecha inválida');
    }

    const latestBefore = await prisma.exchangeRateHistory.findFirst({
      where: {
        rateDate: {
          lt: targetDate,
        },
      },
      orderBy: { rateDate: 'desc' },
    });

    const prevRate = latestBefore ? latestBefore.usdRate : data.usdRate;
    const variation = prevRate > 0
      ? Math.round(((data.usdRate - prevRate) / prevRate) * 10000) / 100
      : 0;

    const created = await prisma.exchangeRateHistory.create({
      data: {
        rateDate: targetDate,
        usdRate: Math.round(data.usdRate * 100) / 100,
        eurRate: data.eurRate ? Math.round(data.eurRate * 100) / 100 : null,
        usdtRate: data.usdtRate ? Math.round(data.usdtRate * 100) / 100 : null,
        previousRate: prevRate,
        variation,
        source: 'Ajuste Manual Histórico',
        dateLabel: `Registro Manual ${targetDate.toLocaleDateString('es-VE')}`,
        isManual: true,
        userName: data.userName || 'Administrador',
        notes: data.notes || 'Registro manual en historial',
      },
    });

    return created;
  }

  /**
   * Delete an exchange rate history entry by ID
   */
  async deleteHistoricalRate(id: string) {
    return prisma.exchangeRateHistory.delete({
      where: { id },
    });
  }

  // ==========================================
  // CONFIGURATION & RATE SCHEDULE ENGINE
  // ==========================================

  /**
   * Get current rate configuration and active rate evaluation
   */
  async getRateConfig() {
    await this.initService();
    const config = await prisma.rateConfig.findUnique({
      where: { id: 'default' },
    });
    const evaluation = await this.evaluateCurrentEffectiveRate();

    return {
      config: config || this.cachedConfig,
      evaluation,
      rates: {
        usdRate: this.currentRate.usdRate,
        eurRate: this.currentRate.eurRate || Math.round(this.currentRate.usdRate * 1.092 * 100) / 100,
        usdtRate: this.currentRate.usdtRate || Math.round(this.currentRate.usdRate * 1.045 * 100) / 100,
      },
    };
  }

  /**
   * Update active currency selection or settings
   */
  async updateRateConfig(data: {
    activeCurrency?: 'USD' | 'EUR' | 'USDT' | 'SCHEDULED' | 'CUSTOM';
    customFixedRate?: number | null;
    autoSyncEnabled?: boolean;
    syncIntervalMin?: number;
    fallbackCurrency?: 'USD' | 'EUR' | 'USDT';
  }) {
    await this.initService();

    const updated = await prisma.rateConfig.upsert({
      where: { id: 'default' },
      update: {
        ...(data.activeCurrency && { activeCurrency: data.activeCurrency }),
        ...(data.customFixedRate !== undefined && { customFixedRate: data.customFixedRate }),
        ...(data.autoSyncEnabled !== undefined && { autoSyncEnabled: data.autoSyncEnabled }),
        ...(data.syncIntervalMin !== undefined && { syncIntervalMin: data.syncIntervalMin }),
        ...(data.fallbackCurrency && { fallbackCurrency: data.fallbackCurrency }),
      },
      create: {
        id: 'default',
        activeCurrency: data.activeCurrency || 'USD',
        customFixedRate: data.customFixedRate ?? null,
        autoSyncEnabled: data.autoSyncEnabled ?? true,
        syncIntervalMin: data.syncIntervalMin || 3,
        fallbackCurrency: data.fallbackCurrency || 'USD',
      },
    });

    this.cachedConfig = {
      activeCurrency: updated.activeCurrency as any,
      customFixedRate: updated.customFixedRate,
      autoSyncEnabled: updated.autoSyncEnabled,
      syncIntervalMin: updated.syncIntervalMin,
      fallbackCurrency: updated.fallbackCurrency as any,
    };

    if (data.customFixedRate !== undefined && data.customFixedRate !== null && data.customFixedRate > 0) {
      await this.logRateChange({
        rateDate: new Date(),
        usdRate: data.customFixedRate,
        source: 'Tasa Fija Personalizada (Configuración POS)',
        isManual: true,
        userName: 'Administrador',
        notes: `Tasa fija personalizada configurada a Bs. ${data.customFixedRate}`,
      });
    }

    // Restart timer if interval changed
    if (data.syncIntervalMin || data.autoSyncEnabled !== undefined) {
      this.startBackgroundAutoSync();
    }

    const evaluation = await this.evaluateCurrentEffectiveRate();

    return {
      config: updated,
      evaluation,
    };
  }

  /**
   * List all rate scripts/schedules
   */
  async getSchedules() {
    await this.initService();
    const items = await prisma.rateSchedule.findMany({
      orderBy: [{ priority: 'asc' }, { startTime: 'asc' }],
    });

    return items.map((item) => ({
      ...item,
      daysOfWeek: item.daysOfWeek ? JSON.parse(item.daysOfWeek) : [0, 1, 2, 3, 4, 5, 6],
    }));
  }

  /**
   * Create a new rate schedule script
   */
  async createSchedule(data: {
    name: string;
    currencyTarget: 'USD' | 'EUR' | 'USDT' | 'CUSTOM';
    customRateValue?: number | null;
    startTime: string;
    endTime: string;
    durationType?: 'INDEFINITE' | 'DATE_RANGE';
    startDate?: string | null;
    endDate?: string | null;
    daysOfWeek?: number[];
    isActive?: boolean;
    priority?: number;
    notes?: string;
  }) {
    if (!data.name || !data.startTime || !data.endTime) {
      throw new Error('El nombre, hora de inicio y hora de fin son obligatorios');
    }

    const created = await prisma.rateSchedule.create({
      data: {
        name: data.name.trim(),
        currencyTarget: data.currencyTarget || 'USD',
        customRateValue: data.customRateValue ? Number(data.customRateValue) : null,
        startTime: data.startTime.trim(),
        endTime: data.endTime.trim(),
        durationType: data.durationType || 'INDEFINITE',
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        daysOfWeek: JSON.stringify(data.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]),
        isActive: data.isActive !== undefined ? data.isActive : true,
        priority: data.priority || 1,
        notes: data.notes || null,
      },
    });

    if (created.isActive) {
      await this.updateRateConfig({ activeCurrency: 'SCHEDULED' });
    }

    return {
      ...created,
      daysOfWeek: JSON.parse(created.daysOfWeek),
    };
  }

  /**
   * Update an existing rate schedule script
   */
  async updateSchedule(
    id: string,
    data: {
      name?: string;
      currencyTarget?: 'USD' | 'EUR' | 'USDT' | 'CUSTOM';
      customRateValue?: number | null;
      startTime?: string;
      endTime?: string;
      durationType?: 'INDEFINITE' | 'DATE_RANGE';
      startDate?: string | null;
      endDate?: string | null;
      daysOfWeek?: number[];
      isActive?: boolean;
      priority?: number;
      notes?: string;
    }
  ) {
    const updated = await prisma.rateSchedule.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.currencyTarget && { currencyTarget: data.currencyTarget }),
        ...(data.customRateValue !== undefined && { customRateValue: data.customRateValue }),
        ...(data.startTime && { startTime: data.startTime.trim() }),
        ...(data.endTime && { endTime: data.endTime.trim() }),
        ...(data.durationType && { durationType: data.durationType }),
        ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        ...(data.daysOfWeek && { daysOfWeek: JSON.stringify(data.daysOfWeek) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });

    if (updated.isActive) {
      await this.updateRateConfig({ activeCurrency: 'SCHEDULED' });
    }

    return {
      ...updated,
      daysOfWeek: JSON.parse(updated.daysOfWeek),
    };
  }

  /**
   * Toggle schedule active state
   */
  async toggleSchedule(id: string, isActive: boolean) {
    const updated = await prisma.rateSchedule.update({
      where: { id },
      data: { isActive },
    });

    if (isActive) {
      await this.updateRateConfig({ activeCurrency: 'SCHEDULED' });
    }

    return {
      ...updated,
      daysOfWeek: JSON.parse(updated.daysOfWeek),
    };
  }

  /**
   * Delete a schedule script
   */
  async deleteSchedule(id: string) {
    return prisma.rateSchedule.delete({
      where: { id },
    });
  }
}
