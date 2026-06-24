import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { z } from 'zod';
import { findDisambiguationSchema, resolveFindMatch } from '../elements/resolve-find-match.js';
import { typeIntoElement } from './type.js';

const typeQuerySchema = z
  .object({
    pageId: z.string().uuid(),
    query: z.string().min(1),
    value: z.string(),
    preferRegion: findDisambiguationSchema.shape.preferRegion,
    preferRole: findDisambiguationSchema.shape.preferRole,
    candidateIndex: findDisambiguationSchema.shape.candidateIndex,
    append: z.boolean().optional(),
    delay: z.number().int().min(0).optional(),
  })
  .strict();

export interface TypeQueryResult {
  typed: true;
  elementId: string;
  value: string;
  query: string;
  matchCount: number;
  selectedReason?: string;
}

export async function typeByQuery(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<TypeQueryResult> | McpErrorResponse> {
  const parsed = typeQuerySchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, query, value, preferRegion, preferRole, candidateIndex, append, delay } =
    parsed.data;
  const found = await resolveFindMatch(ctx, pageId, query, {
    preferRegion,
    preferRole,
    candidateIndex,
  });
  if ('error' in found) return found.error;

  const { element, matchCount, selectedReason } = found.match;
  const typeResult = await typeIntoElement(ctx, {
    pageId,
    elementId: element.elementId,
    value,
    query,
    append,
    delay,
  });
  if (!typeResult.ok) return typeResult;

  return success({
    typed: true as const,
    elementId: element.elementId,
    value: typeResult.data.value,
    query,
    matchCount,
    selectedReason,
  });
}

export { typeQuerySchema };
