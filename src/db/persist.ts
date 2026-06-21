import type { RecordedEvent } from '../core/types/sessions.js';
import type { Database } from './client.js';
import { recordedEvents, testReports } from './schema.js';

export interface PersistableTestReport {
  browserId?: string;
  testName: string;
  status: 'passed' | 'failed' | 'error';
  actionsPerformed: unknown[];
  assertionsPassed: unknown[];
  assertionsFailed: unknown[];
  screenshots: string[];
  networkErrors: unknown[];
  consoleErrors: unknown[];
  errors?: unknown[];
  executionTimeMs: number;
  startedAt: string;
  completedAt: string;
}

function eventAction(event: RecordedEvent): string {
  if (event.type === 'action' && typeof event.payload.action === 'string') {
    return event.payload.action;
  }
  return event.type;
}

function eventTarget(event: RecordedEvent): string | undefined {
  const { elementId, url, query } = event.payload;
  if (typeof elementId === 'string') return elementId;
  if (typeof url === 'string') return url;
  if (typeof query === 'string') return query;
  return undefined;
}

export async function persistTestReport(
  db: Database,
  report: PersistableTestReport,
  events: RecordedEvent[] = [],
): Promise<string> {
  const [inserted] = await db
    .insert(testReports)
    .values({
      browserId: report.browserId,
      testName: report.testName,
      status: report.status,
      actionsPerformed: report.actionsPerformed,
      assertionsPassed: report.assertionsPassed,
      assertionsFailed: report.assertionsFailed,
      screenshots: report.screenshots,
      networkErrors: report.networkErrors,
      consoleErrors: report.consoleErrors,
      errors: report.errors ?? [],
      executionTimeMs: report.executionTimeMs,
      startedAt: new Date(report.startedAt),
      completedAt: new Date(report.completedAt),
    })
    .returning({ id: testReports.id });

  const reportId = inserted.id;

  if (events.length > 0) {
    await db.insert(recordedEvents).values(
      events.map((event) => ({
        reportId,
        browserId: report.browserId ?? 'unknown',
        timestamp: new Date(event.timestamp),
        action: eventAction(event),
        target: eventTarget(event),
        pageId: event.pageId,
        metadata: { type: event.type, ...event.payload },
      })),
    );
  }

  return reportId;
}

export async function persistRecordedEvents(
  db: Database,
  browserId: string,
  events: RecordedEvent[],
  reportId?: string,
): Promise<void> {
  if (events.length === 0) return;

  await db.insert(recordedEvents).values(
    events.map((event) => ({
      reportId,
      browserId,
      timestamp: new Date(event.timestamp),
      action: eventAction(event),
      target: eventTarget(event),
      pageId: event.pageId,
      metadata: { type: event.type, ...event.payload },
    })),
  );
}
