import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import type { ResolvedConfig } from '../core/config/load-config.js';
import { getDb } from './client.js';
import { testReports } from './schema.js';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const SESSION_TTL_MIGRATION_WARNING =
  '[olteststack] Session TTL columns missing — run bun run db:migrate';

/** PostgreSQL undefined_column (42703) when session TTL migration was not applied. */
export function isSessionTtlMigrationMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const err = error as { code?: string; message?: string };
  if (err.code === '42703') return true;

  const message = err.message ?? '';
  return (
    message.includes('does not exist') &&
    (message.includes('"saved"') ||
      message.includes('"expires_at"') ||
      message.includes('"saved_at"'))
  );
}

function screenshotBasename(path: string): string | null {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.includes('..')) return null;
  const parts = normalized.split('/');
  const name = parts[parts.length - 1];
  return name || null;
}

async function deleteScreenshotFiles(screenshotDir: string, paths: string[]): Promise<number> {
  const root = resolve(screenshotDir);
  let deleted = 0;

  for (const path of paths) {
    const name = screenshotBasename(path);
    if (!name) continue;

    const filePath = resolve(root, name);
    if (!filePath.startsWith(root)) continue;

    try {
      await unlink(filePath);
      deleted += 1;
    } catch {
      // File may already be gone — not fatal.
    }
  }

  return deleted;
}

export interface CleanupResult {
  deletedReports: number;
  deletedScreenshots: number;
}

export async function cleanupExpiredSessions(config: ResolvedConfig): Promise<CleanupResult> {
  if (!config.databaseUrl) {
    return { deletedReports: 0, deletedScreenshots: 0 };
  }

  const db = getDb(config);
  if (!db) {
    return { deletedReports: 0, deletedScreenshots: 0 };
  }

  const now = new Date();
  const expired = await db
    .select()
    .from(testReports)
    .where(
      and(
        eq(testReports.saved, false),
        isNotNull(testReports.expiresAt),
        lt(testReports.expiresAt, now),
      ),
    );

  if (expired.length === 0) {
    return { deletedReports: 0, deletedScreenshots: 0 };
  }

  const screenshotPaths = expired.flatMap((row) =>
    Array.isArray(row.screenshots) ? (row.screenshots as string[]) : [],
  );

  await db
    .delete(testReports)
    .where(
      and(
        eq(testReports.saved, false),
        isNotNull(testReports.expiresAt),
        lt(testReports.expiresAt, now),
      ),
    );

  const deletedScreenshots = await deleteScreenshotFiles(config.screenshotDir, screenshotPaths);

  return { deletedReports: expired.length, deletedScreenshots };
}

export async function runCleanupOnce(config: ResolvedConfig): Promise<CleanupResult> {
  try {
    const result = await cleanupExpiredSessions(config);
    if (result.deletedReports > 0) {
      console.error(
        `[olteststack] Cleaned up ${result.deletedReports} expired session(s), ${result.deletedScreenshots} screenshot file(s)`,
      );
    }
    return result;
  } catch (error) {
    if (isSessionTtlMigrationMissingError(error)) {
      console.error(SESSION_TTL_MIGRATION_WARNING);
      return { deletedReports: 0, deletedScreenshots: 0 };
    }
    throw error;
  }
}

let cleanupTimer: ReturnType<typeof setInterval> | undefined;

export function scheduleSessionCleanup(config: ResolvedConfig): void {
  if (!config.databaseUrl) return;

  void runCleanupOnce(config);

  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }

  cleanupTimer = setInterval(() => {
    void runCleanupOnce(config);
  }, CLEANUP_INTERVAL_MS);

  cleanupTimer.unref?.();
}

async function main(): Promise<void> {
  const { loadConfig } = await import('../core/config/load-config.js');
  const config = loadConfig();
  const result = await runCleanupOnce(config);
  console.log(
    JSON.stringify({
      ok: true,
      deletedReports: result.deletedReports,
      deletedScreenshots: result.deletedScreenshots,
    }),
  );
}

if (import.meta.main) {
  main().catch((error) => {
    if (isSessionTtlMigrationMissingError(error)) {
      console.error(SESSION_TTL_MIGRATION_WARNING);
      process.exit(1);
    }
    console.error('[olteststack] Cleanup failed:', error);
    process.exit(1);
  });
}
