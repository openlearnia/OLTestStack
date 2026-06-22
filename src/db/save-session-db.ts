import { eq } from 'drizzle-orm';
import type { Database } from './client.js';
import { hoursUntilExpiry } from './session-lifecycle.js';
import { testReports, type TestReportRow } from './schema.js';

export interface SavedSessionMetadata {
  reportId: string;
  testName: string;
  saved: true;
  savedAt: string;
  expiresAt: null;
  expiresInHours: null;
}

export async function promoteSessionToSaved(
  db: Database,
  reportId: string,
  name?: string,
): Promise<SavedSessionMetadata | null> {
  const now = new Date();

  const [updated] = await db
    .update(testReports)
    .set({
      saved: true,
      expiresAt: null,
      savedAt: now,
      ...(name ? { testName: name } : {}),
    })
    .where(eq(testReports.id, reportId))
    .returning();

  if (!updated) return null;

  return mapSavedMetadata(updated);
}

export function mapSavedMetadata(row: TestReportRow): SavedSessionMetadata {
  return {
    reportId: row.id,
    testName: row.testName,
    saved: true,
    savedAt: row.savedAt?.toISOString() ?? new Date().toISOString(),
    expiresAt: null,
    expiresInHours: null,
  };
}

export function mapSessionPersistence(row: TestReportRow, now: Date = new Date()) {
  return {
    saved: row.saved,
    savedAt: row.savedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    expiresInHours: row.saved ? null : hoursUntilExpiry(row.expiresAt, now),
  };
}
