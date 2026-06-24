import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { getDb } from '../../db/client.js';
import { loadRecordedEventsForReport, loadTestReportById } from '../../db/load-recorded-events.js';
import { shouldPersistRecording } from '../../db/session-lifecycle.js';
import { eventsToScript } from './events-to-script.js';
import type { SessionExportResult } from './script-types.js';

export async function exportSessionFromDatabase(
  ctx: AppContext,
  reportId: string,
  options: { name?: string; goal?: string },
): Promise<McpSuccessResponse<SessionExportResult> | McpErrorResponse> {
  if (!shouldPersistRecording(ctx.config)) {
    return createError(
      'INTERNAL_ERROR',
      'Recording persistence is disabled. Set DATABASE_URL and PERSIST_RECORDING=true to export from the database.',
    );
  }

  if (!ctx.config.databaseUrl) {
    return createError(
      'INTERNAL_ERROR',
      'DATABASE_URL is not configured. Export from database requires PostgreSQL.',
    );
  }

  const db = getDb(ctx.config);
  if (!db) {
    return createError('INTERNAL_ERROR', 'Failed to initialize database client');
  }

  const report = await loadTestReportById(db, reportId);
  if (!report) {
    return createError('SESSION_NOT_FOUND', `Session '${reportId}' not found`, { reportId });
  }

  const events = await loadRecordedEventsForReport(db, reportId);
  if (events.length === 0) {
    return createError(
      'INVALID_INPUT',
      `No recorded events found for session '${reportId}'. The session may predate event persistence.`,
      { reportId },
    );
  }

  const script = await eventsToScript(ctx, events, {
    name: options.name ?? report.testName,
    goal: options.goal,
    browserId: report.browserId ?? undefined,
  });

  return success({
    script,
    eventCount: events.length,
    stepCount: script.steps.length,
    skippedCount: script.exportWarnings?.length ?? 0,
  });
}
