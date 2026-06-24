import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';
import type { Element } from '../../core/types/sessions.js';
import { resolveRecordingQuery } from '../elements/element-query.js';
import {
  emitActionRecording,
  resolveElement,
  resolvePageSession,
  toCdpPage,
} from '../shared/resolve-page.js';

const pressSchema = z
  .object({
    pageId: z.string().uuid(),
    key: z.string().min(1),
    elementId: z.string().uuid().optional(),
    query: z.string().min(1).optional(),
  })
  .strict();

export interface PressResult {
  pressed: true;
  key: string;
}

export async function pressKey(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<PressResult> | McpErrorResponse> {
  const parsed = pressSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, key, elementId, query } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  let pressTarget: { nodeId: string; tag?: string } | undefined;
  let element: Element | undefined;
  if (elementId) {
    const elementResult = await resolveElement(ctx, pageId, elementId);
    if ('error' in elementResult) return elementResult.error;
    element = elementResult.element;
    pressTarget = { nodeId: element.selector!, tag: element.tag };
  }

  const cdpPage = toCdpPage(pageResult.page);

  try {
    const pressedKey = await ctx.cdp.pressKey(cdpPage, key, {
      nodeId: pressTarget?.nodeId,
      tag: pressTarget?.tag,
    });

    emitActionRecording(ctx, pageResult.page.browserId, pageId, {
      action: 'press',
      key: pressedKey,
      ...(elementId ? { elementId } : {}),
      ...(element ? { query: resolveRecordingQuery(element, query) } : {}),
    });

    return success({ pressed: true as const, key: pressedKey });
  } catch (error) {
    const mapped = mapCdpError(error, 'page.press');
    const code =
      mapped.code === 'INTERNAL_ERROR' && mapped.message.includes('Unrecognized key')
        ? 'INVALID_INPUT'
        : mapped.code;

    return createError(code, mapped.message, { ...mapped.details, pageId, key });
  }
}

export { pressSchema };
