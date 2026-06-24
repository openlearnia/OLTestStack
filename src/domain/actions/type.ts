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

const TYPEABLE_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton', 'spinbox']);
const TYPEABLE_TAGS = new Set(['input', 'textarea']);

const typeSchema = z
  .object({
    pageId: z.string().uuid(),
    elementId: z.string().uuid(),
    value: z.string(),
    append: z.boolean().optional(),
    delay: z.number().int().min(0).optional(),
  })
  .strict();

export interface TypeResult {
  typed: true;
  elementId: string;
  value: string;
}

function isTypeable(role: string, tag?: string): boolean {
  return TYPEABLE_ROLES.has(role.toLowerCase()) || (tag !== undefined && TYPEABLE_TAGS.has(tag.toLowerCase()));
}

export async function typeIntoElement(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<TypeResult> | McpErrorResponse> {
  const parsed = typeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, elementId, value, append, delay } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const elementResult = await resolveElement(ctx, pageId, elementId);
  if ('error' in elementResult) return elementResult.error;

  const { element } = elementResult;
  if (!isTypeable(element.role, element.tag)) {
    return createError(
      'INVALID_INPUT',
      `Element '${elementId}' with role '${element.role}' is not typeable. Use page.type only on input or textarea elements.`,
      { pageId, elementId, role: element.role },
    );
  }

  const cdpPage = toCdpPage(pageResult.page);

  try {
    const finalValue = await ctx.cdp.typeElement(cdpPage, element.selector!, value, {
      append,
      delay,
      tag: element.tag,
    });

    emitActionRecording(ctx, pageResult.page.browserId, pageId, {
      action: 'type',
      elementId,
      value: finalValue,
    });

    return success({ typed: true as const, elementId, value: finalValue });
  } catch (error) {
    const mapped = mapCdpError(error, 'page.type');
    const code =
      mapped.code === 'INTERNAL_ERROR' && mapped.message.includes('not found')
        ? 'ELEMENT_NOT_FOUND'
        : mapped.code;

    return createError(code, mapped.message, {
      ...mapped.details,
      pageId,
      elementId,
    });
  }
}

export { typeSchema };
