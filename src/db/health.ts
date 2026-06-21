import { sql } from 'drizzle-orm';
import type { ResolvedConfig } from '../core/config/load-config.js';
import { getDb } from './client.js';

const DB_PROBE_TIMEOUT_MS = 5_000;

export async function validateDatabaseConnection(config: ResolvedConfig): Promise<void> {
  if (!config.persistRecording) return;

  const databaseUrl = config.databaseUrl;
  if (!databaseUrl) {
    throw new Error(
      'PERSIST_RECORDING=true requires DATABASE_URL (e.g. postgresql://oltest:oltest@localhost:5433/olteststack)',
    );
  }

  const db = getDb(config);
  if (!db) {
    throw new Error('Failed to initialize database client');
  }

  const probe = db.execute(sql`select 1 as ok`);
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Database probe timed out after ${DB_PROBE_TIMEOUT_MS}ms`)), DB_PROBE_TIMEOUT_MS);
  });

  await Promise.race([probe, timeout]);
}
