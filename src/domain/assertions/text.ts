import type { AppContext } from '../../core/context.js';
import { createError } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';
import { matchesText, textSnippet } from './match-utils.js';
import { assertionFail, assertionPass } from './result.js';

const textSchema = z
  .object({
    pageId: z.string().uuid(),
    contains: z.string().min(1),
    match: z.enum(['contains', 'equals']).optional(),
    negate: z.boolean().optional(),
  })
  .strict();

export interface AssertTextPassResult {
  passed: true;
  assertion: 'text';
  message: string;
}

export async function assertText(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<AssertTextPassResult> | McpErrorResponse> {
  const parsed = textSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, contains, match = 'contains', negate = false } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const cdpPage = toCdpPage(pageResult.page);

  try {
    const pageText = await ctx.cdp.getVisibleText(cdpPage);

    const didMatch = matchesText(pageText, contains, match);

    if (negate) {
      if (didMatch) {
        const message =
          match === 'equals'
            ? `Page text equals '${contains}'`
            : `Page text contains '${contains}'`;
        return assertionFail(ctx, pageResult.page.browserId, pageId, 'text', message, {
          text: contains,
          match,
          negate: true,
        }, {
          textSnippet: textSnippet(pageText),
        });
      }
      const message =
        match === 'equals'
          ? `Page text does not equal '${contains}'`
          : `Page text does not contain '${contains}'`;
      return assertionPass(ctx, pageResult.page.browserId, pageId, 'text', message, {
        contains,
        match,
        negate: true,
      });
    }

    if (didMatch) {
      const message =
        match === 'equals'
          ? `Page text equals '${contains}'`
          : `Page text contains '${contains}'`;
      return assertionPass(ctx, pageResult.page.browserId, pageId, 'text', message, {
        contains,
        match,
      });
    }

    const message =
      match === 'equals'
        ? `Page text does not equal '${contains}'`
        : `Page text does not contain '${contains}'`;

    return assertionFail(ctx, pageResult.page.browserId, pageId, 'text', message, {
      text: contains,
      match,
    }, {
      textSnippet: textSnippet(pageText),
    });
  } catch (error) {
    const mapped = mapCdpError(error, 'assert.text');
    return createError(mapped.code, mapped.message, { ...mapped.details, pageId });
  }
}

export { textSchema };
