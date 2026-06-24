import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import type { Element } from '../../core/types/sessions.js';
import { z } from 'zod';
import { toPublicElements } from './element-matcher.js';
import { resolveFindMatch } from './resolve-find-match.js';

const findSchema = z
  .object({
    pageId: z.string().uuid(),
    query: z.string().min(1),
  })
  .strict();

export interface FindCandidate {
  element: Omit<Element, 'selector'>;
  reason: string;
}

export interface FindResult {
  element: Omit<Element, 'selector'>;
  matchCount: number;
  selectedReason?: string;
  candidates?: FindCandidate[];
}

export async function findElement(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<FindResult> | McpErrorResponse> {
  const parsed = findSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'query',
    });
  }

  const { pageId, query } = parsed.data;
  const found = await resolveFindMatch(ctx, pageId, query);
  if ('error' in found) return found.error;

  const { element, matchCount, selectedReason, candidates } = found.match;
  const publicElement = toPublicElements([element])[0]!;
  const result: FindResult = {
    element: publicElement,
    matchCount,
    selectedReason,
  };

  if (candidates && candidates.length > 0) {
    result.candidates = candidates.map((candidate) => ({
      element: toPublicElements([candidate.element])[0]!,
      reason: candidate.reason,
    }));
  }

  return success(result);
}

export { findSchema };
