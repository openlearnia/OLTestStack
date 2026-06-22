import { sql } from 'drizzle-orm';
import type { ResolvedConfig } from '../core/config/load-config.js';
import { getDb, type Database } from './client.js';
import { shouldPersistRecording } from './session-lifecycle.js';

const DB_PROBE_TIMEOUT_MS = 5_000;

export async function probeDatabase(db: Database): Promise<void> {
  const probe = db.execute(sql`select 1 as ok`);
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`Database probe timed out after ${DB_PROBE_TIMEOUT_MS}ms`)),
      DB_PROBE_TIMEOUT_MS,
    );
  });

  await Promise.race([probe, timeout]);
}

export async function validateDatabaseConnection(config: ResolvedConfig): Promise<void> {
  if (!config.databaseUrl) return;

  const db = getDb(config);
  if (!db) {
    throw new Error('Failed to initialize database client');
  }

  await probeDatabase(db);
}

export function databaseRequiredMessage(config: ResolvedConfig): string {
  if (!config.databaseUrl) {
    return 'DATABASE_URL is not configured (e.g. postgresql://oltest:oltest@localhost:5433/olteststack)';
  }
  if (!shouldPersistRecording(config)) {
    return 'PERSIST_RECORDING=false — persistence is opted out';
  }
  return 'Database connection required';
}
