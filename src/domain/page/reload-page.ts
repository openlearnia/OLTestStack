import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';

const reloadSchema = z
  .object({
    pageId: z.string().uuid(),
    waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
    timeoutMs: z.number().int().min(1000).optional(),
  })
  .strict();

export interface PageReloadResult {
  url: string;
  title: string;
}

export async function reloadPage(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<PageReloadResult> | McpErrorResponse> {
  const parsed = reloadSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'pageId',
    });
  }

  const { pageId, waitUntil, timeoutMs } = parsed.data;
  const page = await ctx.registry.getPage(pageId);
  if (!page) {
    return createError(
      'SESSION_NOT_FOUND',
      `Page session '${pageId}' not found. Call page.create to open a new page.`,
      { pageId },
    );
  }

  const timeout = timeoutMs ?? ctx.config.defaultNavigationTimeoutMs;

  try {
    const cdpPage = {
      id: pageId,
      browserId: page.browserId,
      targetId: pageId,
      url: page.url,
      title: page.title,
    };

    await ctx.cdp.reload(cdpPage, { waitUntil, timeoutMs: timeout });

    const url = await ctx.cdp.getUrl(cdpPage);
    const title = await ctx.cdp.getTitle(cdpPage);

    await ctx.registry.invalidateElements(pageId);
    await ctx.registry.updatePage(pageId, { url, title });

    if (ctx.recording.isEnabled(page.browserId)) {
      ctx.recording.emit(page.browserId, {
        type: 'navigation',
        pageId,
        payload: { url, title, action: 'reload' },
      });
    }

    return success({ url, title });
  } catch (error) {
    const mapped = mapCdpError(error, 'page.reload');
    const code = mapped.message.includes('timed out') ? 'TIMEOUT' : mapped.code;

    return createError(code, mapped.message, {
      ...mapped.details,
      pageId,
      ...(code === 'TIMEOUT' ? { elapsedMs: timeout } : {}),
    });
  }
}

export { reloadSchema };
