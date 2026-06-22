import type { AppContext } from '../../core/context.js';
import { createError } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';
import { matchesUrl } from './match-utils.js';
import { assertionFail, assertionPass } from './result.js';

const urlSchema = z
  .object({
    pageId: z.string().uuid(),
    url: z.string().min(1),
    match: z.enum(['equals', 'contains']).optional(),
  })
  .strict();

export interface AssertUrlPassResult {
  passed: true;
  assertion: 'url';
  message: string;
}

export async function assertUrl(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<AssertUrlPassResult> | McpErrorResponse> {
  const parsed = urlSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, url, match = 'contains' } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const cdpPage = toCdpPage(pageResult.page);

  try {
    const currentUrl = await ctx.cdp.getUrl(cdpPage);
    await ctx.registry.updatePage(pageId, { url: currentUrl });

    if (matchesUrl(currentUrl, url, match)) {
      const message =
        match === 'equals'
          ? `URL equals '${url}'`
          : `URL contains '${url}'`;
      return assertionPass(ctx, pageResult.page.browserId, pageId, 'url', message, {
        url,
        match,
      });
    }

    const message =
      match === 'equals'
        ? `URL '${currentUrl}' does not equal '${url}'`
        : `URL '${currentUrl}' does not contain '${url}'`;

    return assertionFail(
      ctx,
      pageResult.page.browserId,
      pageId,
      'url',
      message,
      { url, match },
      { url: currentUrl },
    );
  } catch (error) {
    const mapped = mapCdpError(error, 'assert.url');
    return createError(mapped.code, mapped.message, { ...mapped.details, pageId });
  }
}

export { urlSchema };
