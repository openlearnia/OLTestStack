import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';
import { resolveRecordingQuery } from '../elements/element-query.js';
import { findDisambiguationSchema } from '../elements/resolve-find-match.js';
import { resolveActionTarget } from '../shared/resolve-action-target.js';
import {
  emitActionRecording,
  resolvePageSession,
  toCdpPage,
} from '../shared/resolve-page.js';

const SELECTABLE_ROLES = new Set(['combobox', 'listbox']);
const SELECTABLE_TAGS = new Set(['select']);

const pageSelectSchema = z
  .object({
    pageId: z.string().uuid(),
    elementId: z.string().uuid().optional(),
    query: z.string().min(1).optional(),
    preferRegion: findDisambiguationSchema.shape.preferRegion,
    preferRole: findDisambiguationSchema.shape.preferRole,
    candidateIndex: findDisambiguationSchema.shape.candidateIndex,
    value: z.string().optional(),
    label: z.string().optional(),
    by: z.enum(['value', 'label']).optional(),
    match: z.enum(['equals', 'contains']).default('equals'),
  })
  .strict()
  .refine((data) => data.elementId ?? data.query, {
    message: 'elementId or query is required',
  })
  .refine((data) => !(data.elementId && data.query), {
    message: 'Provide elementId or query, not both',
  })
  .refine((data) => data.value !== undefined || data.label !== undefined, {
    message: 'value or label is required',
  });

export interface SelectResult {
  selected: true;
  elementId: string;
  value: string;
  query?: string;
  matchCount?: number;
  selectedReason?: string;
}

function isSelectable(role: string, tag?: string): boolean {
  return SELECTABLE_ROLES.has(role.toLowerCase()) || (tag !== undefined && SELECTABLE_TAGS.has(tag.toLowerCase()));
}

function resolveSelectBy(data: z.infer<typeof pageSelectSchema>): 'value' | 'label' {
  if (data.by) return data.by;
  if (data.value !== undefined) return 'value';
  return 'label';
}

export async function selectOption(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<SelectResult> | McpErrorResponse> {
  const parsed = pageSelectSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, value, label, match, ...targetInput } = parsed.data;
  const by = resolveSelectBy(parsed.data);

  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const targetResult = await resolveActionTarget(ctx, pageId, targetInput);
  if ('error' in targetResult) return targetResult.error;

  const { element, query: findQuery, matchCount, selectedReason } = targetResult.target;

  if (!isSelectable(element.role, element.tag)) {
    return createError(
      'INVALID_INPUT',
      `Element '${element.elementId}' with role '${element.role}' is not selectable. Use page_select on select or combobox elements.`,
      { pageId, elementId: element.elementId, role: element.role },
    );
  }

  const cdpPage = toCdpPage(pageResult.page);
  const recordingQuery = resolveRecordingQuery(element, findQuery);

  try {
    const selectedValue = await ctx.cdp.selectOption(cdpPage, element.selector!, {
      by,
      value,
      label,
      match,
      tag: element.tag,
    });

    emitActionRecording(ctx, pageResult.page.browserId, pageId, {
      action: 'select',
      elementId: element.elementId,
      value: selectedValue,
      query: recordingQuery,
      by,
      ...(label !== undefined ? { label } : {}),
    });

    return success({
      selected: true as const,
      elementId: element.elementId,
      value: selectedValue,
      ...(findQuery !== undefined ? { query: findQuery } : {}),
      ...(matchCount !== undefined ? { matchCount } : {}),
      ...(selectedReason !== undefined ? { selectedReason } : {}),
    });
  } catch (error) {
    const mapped = mapCdpError(error, 'page.select');
    const code =
      mapped.code === 'INTERNAL_ERROR' && mapped.message.includes('not found')
        ? 'ELEMENT_NOT_FOUND'
        : mapped.code === 'INTERNAL_ERROR' && mapped.message.includes('No option')
          ? 'INVALID_INPUT'
          : mapped.code;

    return createError(code, mapped.message, {
      ...mapped.details,
      pageId,
      elementId: element.elementId,
    });
  }
}

export { pageSelectSchema };
