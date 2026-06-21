import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';

const TEXT_MAX_LENGTH = 50_000;

const textSchema = z
  .object({
    pageId: z.string().uuid(),
  })
  .strict();

export interface TextResult {
  text: string;
  length: number;
  truncated?: boolean;
}

export async function extractText(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<TextResult> | McpErrorResponse> {
  const parsed = textSchema.safeParse(input);
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
    const rawText = await ctx.cdp.getVisibleText(cdpPage);
    const truncated = rawText.length > TEXT_MAX_LENGTH;
    const text = truncated ? `${rawText.slice(0, TEXT_MAX_LENGTH - 3)}...` : rawText;

    return success({
      text,
      length: text.length,
      ...(truncated ? { truncated: true } : {}),
    });
  } catch (error) {
    const mapped = mapCdpError(error, 'page.text');
    return createError(mapped.code, mapped.message, { ...mapped.details, pageId });
  }
}

export { textSchema, TEXT_MAX_LENGTH };
