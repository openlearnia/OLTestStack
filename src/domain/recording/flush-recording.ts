import type { AppContext } from '../../core/context.js';
import { getDb, persistTestReport } from '../../db/index.js';
import type { RecordedEvent } from '../../core/types/sessions.js';

function deriveStatus(events: RecordedEvent[]): 'passed' | 'failed' | 'error' {
  if (events.some((event) => event.type === 'error')) return 'error';
  const failedAssertion = events.find(
    (event) => event.type === 'assertion' && event.payload.passed === false,
  );
  if (failedAssertion) return 'failed';
  return 'passed';
}

export async function flushRecordingToDatabase(
  ctx: AppContext,
  browserId: string,
): Promise<void> {
  if (!ctx.config.persistRecording) return;

  const db = getDb(ctx.config);
  if (!db) return;

  const events = ctx.recording.getEvents(browserId);
  if (events.length === 0) return;

  const startedAt = events[0]?.timestamp ?? new Date().toISOString();
  const completedAt = events.at(-1)?.timestamp ?? startedAt;
  const executionTimeMs = Math.max(
    0,
    new Date(completedAt).getTime() - new Date(startedAt).getTime(),
  );

  await persistTestReport(
    db,
    {
      browserId,
      testName: `browser-session-${browserId.slice(0, 8)}`,
      status: deriveStatus(events),
      actionsPerformed: events.filter(
        (event) => event.type === 'action' || event.type === 'navigation',
      ),
      assertionsPassed: events.filter(
        (event) => event.type === 'assertion' && event.payload.passed === true,
      ),
      assertionsFailed: events.filter(
        (event) => event.type === 'assertion' && event.payload.passed === false,
      ),
      screenshots: events
        .filter((event) => event.type === 'screenshot')
        .map((event) => String(event.payload.path ?? ''))
        .filter(Boolean),
      networkErrors: events.filter((event) => event.type === 'network'),
      consoleErrors: events.filter((event) => event.type === 'console'),
      errors: events.filter((event) => event.type === 'error'),
      executionTimeMs,
      startedAt,
      completedAt,
    },
    events,
  );
}
