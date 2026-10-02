import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  taxRate: 0.16, // IVA 16% standard
  cronSchedule: process.env.CRON_SCHEDULE || '* * * * *', // Every 60 seconds
  cacheTtlMs: 300000, // 5 minutes in-memory cache for ultra-fast barcode queries
  appUrl: process.env.APP_URL || 'http://localhost:3000',
};
