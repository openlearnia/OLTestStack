import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { z } from 'zod';

const sessionStatusSchema = z
  .object({
    browserId: z.string().uuid(),
  })
  .strict();

export interface SessionStatusPage {
  pageId: string;
  url: string;
  title: string;
}

export interface SessionStatusResult {
  browserId: string;
  alive: boolean;
  crashed: boolean;
  recording: boolean;
  eventCount: number;
  pages: SessionStatusPage[];
}

export async function getSessionStatus(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<SessionStatusResult> | McpErrorResponse> {
  const parsed = sessionStatusSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'browserId',
    });
  }

  const { browserId } = parsed.data;
  const browser = await ctx.registry.getBrowser(browserId);
  if (!browser) {
    return createError(
      'SESSION_NOT_FOUND',
      `Browser session '${browserId}' not found. It may have already been closed.`,
      { browserId },
    );
  }

  const pages: SessionStatusPage[] = [];
  for (const pageId of browser.pageIds) {
    const page = await ctx.registry.getPage(pageId);
    if (page) {
      pages.push({ pageId: page.pageId, url: page.url, title: page.title });
    }
  }

  const recording = ctx.recording.isEnabled(browserId);
  const eventCount = recording ? ctx.recording.getEvents(browserId).length : 0;

  return success({
    browserId,
    alive: !browser.crashed,
    crashed: browser.crashed ?? false,
    recording,
    eventCount,
    pages,
  });
}

export { sessionStatusSchema };
