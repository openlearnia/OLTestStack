import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { z } from 'zod';
import { exportSessionFromDatabase } from './export-from-db.js';
import { eventsToScript } from './events-to-script.js';
import type { SessionExportResult } from './script-types.js';

const sessionExportSchema = z
  .object({
    browserId: z.string().uuid().optional(),
    reportId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    name: z.string().optional(),
    goal: z.string().optional(),
  })
  .strict()
  .refine((data) => data.browserId ?? data.reportId ?? data.sessionId, {
    message: 'browserId, reportId, or sessionId is required',
  })
  .refine((data) => !(data.browserId && (data.reportId || data.sessionId)), {
    message: 'Provide browserId (live session) or reportId/sessionId (database), not both',
  });

export async function exportSession(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<SessionExportResult> | McpErrorResponse> {
  const parsed = sessionExportSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { browserId, reportId, sessionId, name, goal } = parsed.data;
  const persistedReportId = reportId ?? sessionId;

  if (persistedReportId) {
    return exportSessionFromDatabase(ctx, persistedReportId, { name, goal });
  }

  const liveBrowserId = browserId!;
  const browser = await ctx.registry.getBrowser(liveBrowserId);
  if (!browser) {
    return createError(
      'SESSION_NOT_FOUND',
      `Browser session '${liveBrowserId}' not found. Call browser_launch first, or pass reportId after browser_close.`,
      { browserId: liveBrowserId },
    );
  }

  if (!ctx.recording.isEnabled(liveBrowserId)) {
    return createError(
      'INVALID_INPUT',
      'Recording is disabled for this browser session. Launch with recordingEnabled: true.',
      { browserId: liveBrowserId },
    );
  }

  const events = ctx.recording.getEvents(liveBrowserId);
  const script = await eventsToScript(ctx, events, {
    name: name ?? `session-${liveBrowserId.slice(0, 8)}`,
    goal,
    browserId: liveBrowserId,
  });

  return success({
    script,
    eventCount: events.length,
    stepCount: script.steps.length,
    skippedCount: script.exportWarnings?.length ?? 0,
  });
}

export { sessionExportSchema };
