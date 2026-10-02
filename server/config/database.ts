import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Global singleton pattern for PrismaClient in development & production
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

function recoverCorruptedDatabase() {
  console.warn('[Database] Corrupted or malformed SQLite schema detected. Rebuilding database schema...');
  const filesToRemove = [
    path.join(process.cwd(), 'prisma', 'dev.db'),
    path.join(process.cwd(), 'prisma', 'dev.db-journal'),
    path.join(process.cwd(), 'prisma', 'dev.db-wal'),
    path.join(process.cwd(), 'prisma', 'dev.db-shm'),
    path.join(process.cwd(), 'dev.db'),
    path.join(process.cwd(), 'dev.db-journal'),
    path.join(process.cwd(), 'dev.db-wal'),
    path.join(process.cwd(), 'dev.db-shm'),
  ];

  for (const file of filesToRemove) {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        console.log(`[Database] Removed corrupted database file: ${file}`);
      } catch (err) {
        console.warn(`[Database] Could not remove file ${file}:`, err);
      }
    }
  }

  try {
    console.log('[Database] Running prisma db push to rebuild database structure...');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    console.log('[Database] Seeding fresh database with initial data...');
    execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
    console.log('[Database] Database self-healing recovery completed successfully.');
  } catch (err) {
    console.error('[Database] Failed to rebuild database automatically:', err);
  }
}

/**
 * Configure SQLite for high-throughput local POS execution:
 * 1. WAL mode (Write-Ahead Logging): allows simultaneous non-blocking reads during writes.
 * 2. NORMAL synchronous: balances durability with disk I/O speed.
 * 3. busy_timeout: prevents immediate locks under sudden concurrency spikes.
 * 4. cache_size: keeps frequent hot data and indexes in memory.
 */
export async function initializeDatabasePragmas(): Promise<void> {
  try {
    // PRAGMA journal_mode returns a result set in SQLite, so queryRawUnsafe is required
    const journalModeResult = await prisma.$queryRawUnsafe<Array<{ journal_mode: string }>>('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
    await prisma.$queryRawUnsafe('PRAGMA cache_size = -20000;'); // 20MB cache
    
    // Test basic query to ensure tables exist and indexes are clean
    await prisma.product.count();
    
    console.log('[Database] SQLite WAL mode enabled:', journalModeResult?.[0]?.journal_mode || 'WAL');
  } catch (error: any) {
    const errorStr = String(error?.message || error || '');
    if (
      errorStr.includes('malformed') ||
      errorStr.includes('orphan index') ||
      errorStr.includes('code 11') ||
      errorStr.includes('disk image is malformed') ||
      errorStr.includes('no such table')
    ) {
      console.warn('[Database] Database error caught during pragma initialization:', errorStr);
      try {
        await prisma.$disconnect();
      } catch (_) {}
      recoverCorruptedDatabase();
      try {
        await prisma.$connect();
        const journalModeResult = await prisma.$queryRawUnsafe<Array<{ journal_mode: string }>>('PRAGMA journal_mode = WAL;');
        await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
        await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
        await prisma.$queryRawUnsafe('PRAGMA cache_size = -20000;');
        console.log('[Database] SQLite WAL mode enabled after recovery:', journalModeResult?.[0]?.journal_mode || 'WAL');
      } catch (retryError) {
        console.error('[Database] Error re-enabling pragmas after recovery:', retryError);
      }
    } else {
      console.warn('[Database] Pragmas could not be executed (may not be SQLite):', error);
    }
  }
}

