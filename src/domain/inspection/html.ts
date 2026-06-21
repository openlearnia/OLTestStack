import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';

const htmlSchema = z
  .object({
    pageId: z.string().uuid(),
  })
  .strict();

export interface HtmlResult {
  html: string;
  length: number;
  truncated?: boolean;
}

export const HTML_MAX_LENGTH = 500_000;

export async function extractHtml(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<HtmlResult> | McpErrorResponse> {
  const parsed = htmlSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const cdpPage = toCdpPage(pageResult.page);

  try {
    const rawHtml = await ctx.cdp.getOuterHtml(cdpPage);
    const truncated = rawHtml.length > HTML_MAX_LENGTH;
    const html = truncated ? `${rawHtml.slice(0, HTML_MAX_LENGTH - 3)}...` : rawHtml;

    return success({
      html,
      length: html.length,
      ...(truncated ? { truncated: true } : {}),
    });
  } catch (error) {
    const mapped = mapCdpError(error, 'page.html');
    return createError(mapped.code, mapped.message, { ...mapped.details, pageId });
  }
}

export { htmlSchema };
