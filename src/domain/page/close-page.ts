import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';

const closeSchema = z
  .object({
    pageId: z.string().uuid(),
  })
  .strict();

export interface PageCloseResult {
  closed: true;
}

export async function closePage(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<PageCloseResult> | McpErrorResponse> {
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'pageId',
    });
  }

  const { pageId } = parsed.data;
  const page = await ctx.registry.getPage(pageId);
  if (!page) {
    return createError(
      'SESSION_NOT_FOUND',
      `Page session '${pageId}' not found. It may have been closed. Call page_create to open a new page.`,
      { pageId },
    );
  }

  try {
    await ctx.cdp.closePage({
      id: pageId,
      browserId: page.browserId,
      targetId: pageId,
      url: page.url,
      title: page.title,
    });
    await ctx.registry.deletePage(pageId);
    return success({ closed: true as const });
  } catch (error) {
    const mapped = mapCdpError(error, 'page.close');
    return createError(mapped.code, mapped.message, { ...mapped.details, pageId });
  }
}

export { closeSchema };
