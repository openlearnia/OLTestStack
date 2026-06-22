import type { ResolvedConfig } from '../core/config/load-config.js';
import { DEFAULT_SESSION_TTL_HOURS } from '../core/config/load-config.js';

/** Persist to Postgres when DATABASE_URL is set unless explicitly opted out. */
export function shouldPersistRecording(config: ResolvedConfig): boolean {
  if (!config.databaseUrl) return false;
  return config.persistRecording !== false;
}

export function computeSessionExpiresAt(
  ttlHours: number = DEFAULT_SESSION_TTL_HOURS,
  now: Date = new Date(),
): Date {
  const hours = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : DEFAULT_SESSION_TTL_HOURS;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

export function hoursUntilExpiry(expiresAt: Date | null | undefined, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (60 * 60 * 1000));
}
