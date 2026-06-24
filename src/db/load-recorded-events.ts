import { asc, eq } from 'drizzle-orm';
import type { RecordedEvent, RecordedEventType } from '../core/types/sessions.js';
import type { Database } from './client.js';
import { recordedEvents, testReports, type RecordedEventRow, type TestReportRow } from './schema.js';

export function recordedEventRowToEvent(row: RecordedEventRow): RecordedEvent {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const eventType =
    typeof metadata.type === 'string'
      ? (metadata.type as RecordedEventType)
      : (row.action as RecordedEventType);
  const { type: _type, ...payload } = metadata;

  return {
    timestamp: row.timestamp.toISOString(),
    type: eventType,
    pageId: row.pageId ?? undefined,
    payload,
  };
}

export async function loadRecordedEventsForReport(
  db: Database,
  reportId: string,
): Promise<RecordedEvent[]> {
  const rows = await db
    .select()
    .from(recordedEvents)
    .where(eq(recordedEvents.reportId, reportId))
    .orderBy(asc(recordedEvents.timestamp));

  return rows.map(recordedEventRowToEvent);
}

export async function loadTestReportById(
  db: Database,
  reportId: string,
): Promise<TestReportRow | undefined> {
  const [row] = await db.select().from(testReports).where(eq(testReports.id, reportId)).limit(1);
  return row;
}
