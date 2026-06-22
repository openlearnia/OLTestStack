import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { z } from 'zod';
import { eventsToScript } from './events-to-script.js';
import type { SessionExportResult } from './script-types.js';

const sessionExportSchema = z
  .object({
    browserId: z.string().uuid(),
    name: z.string().optional(),
    goal: z.string().optional(),
  })
  .strict();

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

  const { browserId, name, goal } = parsed.data;
  const browser = await ctx.registry.getBrowser(browserId);
  if (!browser) {
    return createError(
      'SESSION_NOT_FOUND',
      `Browser session '${browserId}' not found. Call browser_launch first.`,
      { browserId },
    );
  }

  if (!ctx.recording.isEnabled(browserId)) {
    return createError(
      'INVALID_INPUT',
      'Recording is disabled for this browser session. Launch with recordingEnabled: true.',
      { browserId },
    );
  }

  const events = ctx.recording.getEvents(browserId);
  const script = await eventsToScript(ctx, events, {
    name: name ?? `session-${browserId.slice(0, 8)}`,
    goal,
    browserId,
  });

  return success({
    script,
    eventCount: events.length,
    stepCount: script.steps.length,
    skippedCount: script.exportWarnings?.length ?? 0,
  });
}

export { sessionExportSchema };
