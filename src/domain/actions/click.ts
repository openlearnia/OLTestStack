import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';
import {
  emitActionRecording,
  resolveElement,
  resolvePageSession,
  toCdpPage,
} from '../shared/resolve-page.js';

const clickSchema = z
  .object({
    pageId: z.string().uuid(),
    elementId: z.string().uuid(),
  })
  .strict();

export interface ClickResult {
  clicked: true;
  elementId: string;
}

export async function clickElement(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<ClickResult> | McpErrorResponse> {
  const parsed = clickSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, elementId } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const elementResult = await resolveElement(ctx, pageId, elementId);
  if ('error' in elementResult) return elementResult.error;

  const { element } = elementResult;
  const cdpPage = toCdpPage(pageResult.page);

  try {
    await ctx.cdp.clickElement(cdpPage, element.selector!);

    emitActionRecording(ctx, pageResult.page.browserId, pageId, {
      action: 'click',
      elementId,
    });

    return success({ clicked: true as const, elementId });
  } catch (error) {
    const mapped = mapCdpError(error, 'page.click');
    const code =
      mapped.code === 'INTERNAL_ERROR' && mapped.message.includes('not actionable')
        ? 'TIMEOUT'
        : mapped.code === 'INTERNAL_ERROR' && mapped.message.includes('not found')
          ? 'ELEMENT_NOT_FOUND'
          : mapped.code;

    return createError(code, mapped.message, {
      ...mapped.details,
      pageId,
      elementId,
    });
  }
}

export { clickSchema };
