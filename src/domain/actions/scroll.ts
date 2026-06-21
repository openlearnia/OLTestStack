import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import type { ScrollDirection } from '../../cdp/adapter.js';
import { z } from 'zod';
import { emitActionRecording, resolvePageSession, toCdpPage } from '../shared/resolve-page.js';

const scrollSchema = z
  .object({
    pageId: z.string().uuid(),
    direction: z.enum(['up', 'down', 'left', 'right']),
    amount: z.number().int().min(1).optional(),
  })
  .strict();

export interface ScrollActionResult {
  scrolled: true;
  direction: ScrollDirection;
  amount: number;
}

export async function scrollPage(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<ScrollActionResult> | McpErrorResponse> {
  const parsed = scrollSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, direction, amount } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const cdpPage = toCdpPage(pageResult.page);

  try {
    const result = await ctx.cdp.scroll(cdpPage, direction, amount);

    emitActionRecording(ctx, pageResult.page.browserId, pageId, {
      action: 'scroll',
      direction: result.direction,
      amount: result.amount,
    });

    return success({ scrolled: true as const, direction: result.direction, amount: result.amount });
  } catch (error) {
    const mapped = mapCdpError(error, 'page.scroll');
    return createError(mapped.code, mapped.message, { ...mapped.details, pageId });
  }
}

export { scrollSchema };
