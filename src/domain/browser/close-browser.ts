import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { flushRecordingToDatabase } from '../recording/flush-recording.js';
import { z } from 'zod';

const closeSchema = z
  .object({
    browserId: z.string().uuid(),
    testName: z.string().optional(),
  })
  .strict();

export interface BrowserCloseResult {
  closed: true;
}

export async function closeBrowser(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<BrowserCloseResult> | McpErrorResponse> {
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'browserId',
    });
  }

  const { browserId, testName } = parsed.data;
  const browser = await ctx.registry.getBrowser(browserId);
  if (!browser) {
    return createError(
      'SESSION_NOT_FOUND',
      `Browser session '${browserId}' not found. It may have already been closed.`,
      { browserId },
    );
  }

  try {
    await ctx.cdp.closeBrowser({ id: browserId, connected: !browser.crashed });
    await flushRecordingToDatabase(ctx, browserId, testName);
    await ctx.registry.deleteBrowser(browserId);
    ctx.recording.releaseBrowser(browserId);
    return success({ closed: true as const });
  } catch (error) {
    const mapped = mapCdpError(error, 'browser.close');
    return createError(mapped.code, mapped.message, { ...mapped.details, browserId });
  }
}

export { closeSchema };
