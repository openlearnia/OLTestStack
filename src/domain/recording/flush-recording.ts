import type { AppContext } from '../../core/context.js';
import { getDb, persistTestReport } from '../../db/index.js';
import { promoteSessionToSaved } from '../../db/save-session-db.js';
import { shouldPersistRecording, shouldAutoSaveFailedSession } from '../../db/session-lifecycle.js';
import { generateReport } from './generate-report.js';

export async function flushRecordingToDatabase(
  ctx: AppContext,
  browserId: string,
  testName?: string,
): Promise<string | undefined> {
  if (!shouldPersistRecording(ctx.config)) return undefined;

  const db = getDb(ctx.config);
  if (!db) return undefined;

  const events = ctx.recording.getEvents(browserId);
  if (events.length === 0) return undefined;

  const report = generateReport(
    events,
    testName ?? `browser-session-${browserId.slice(0, 8)}`,
  );

  const reportId = await persistTestReport(
    db,
    {
      browserId,
      testName: report.testName,
      status: report.status,
      actionsPerformed: report.actionsPerformed,
      assertionsPassed: report.assertionsPassed,
      assertionsFailed: report.assertionsFailed,
      screenshots: report.screenshots,
      networkErrors: report.networkErrors,
      consoleErrors: report.consoleErrors,
      executionTimeMs: report.executionTimeMs,
      startedAt: report.startedAt,
      completedAt: report.completedAt,
    },
    events,
    ctx.config,
  );

  if (shouldAutoSaveFailedSession(ctx.config, report.status)) {
    await promoteSessionToSaved(db, reportId);
  }

  return reportId;
}
