import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { z } from 'zod';
import { findDisambiguationSchema, resolveFindMatch } from '../elements/resolve-find-match.js';
import { clickElement } from './click.js';

const clickQuerySchema = z
  .object({
    pageId: z.string().uuid(),
    query: z.string().min(1),
    preferRegion: findDisambiguationSchema.shape.preferRegion,
    preferRole: findDisambiguationSchema.shape.preferRole,
    candidateIndex: findDisambiguationSchema.shape.candidateIndex,
  })
  .strict();

export interface ClickQueryResult {
  clicked: true;
  elementId: string;
  query: string;
  matchCount: number;
  selectedReason?: string;
}

export async function clickByQuery(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<ClickQueryResult> | McpErrorResponse> {
  const parsed = clickQuerySchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, query, preferRegion, preferRole, candidateIndex } = parsed.data;
  const found = await resolveFindMatch(ctx, pageId, query, {
    preferRegion,
    preferRole,
    candidateIndex,
  });
  if ('error' in found) return found.error;

  const { element, matchCount, selectedReason } = found.match;
  const clickResult = await clickElement(ctx, {
    pageId,
    elementId: element.elementId,
    query,
  });
  if (!clickResult.ok) return clickResult;

  return success({
    clicked: true as const,
    elementId: element.elementId,
    query,
    matchCount,
    selectedReason,
  });
}

export { clickQuerySchema };
