import type { AppContext } from '../../core/context.js';
import { createError } from '../../core/errors/envelope.js';
import type { McpErrorResponse } from '../../core/types/responses.js';
import type { Element } from '../../core/types/sessions.js';
import {
  findDisambiguationSchema,
  resolveFindMatch,
  type FindDisambiguation,
} from '../elements/resolve-find-match.js';
import { resolveElement } from './resolve-page.js';
import { z } from 'zod';

export const actionTargetSchema = z
  .object({
    elementId: z.string().uuid().optional(),
    query: z.string().min(1).optional(),
    preferRegion: findDisambiguationSchema.shape.preferRegion,
    preferRole: findDisambiguationSchema.shape.preferRole,
    candidateIndex: findDisambiguationSchema.shape.candidateIndex,
  })
  .strict()
  .refine((data) => data.elementId ?? data.query, {
    message: 'elementId or query is required',
  })
  .refine((data) => !(data.elementId && data.query), {
    message: 'Provide elementId or query, not both',
  });

export type ActionTargetInput = z.infer<typeof actionTargetSchema>;

export interface ResolvedActionTarget {
  element: Element;
  query?: string;
  matchCount?: number;
  selectedReason?: string;
}

export async function resolveActionTarget(
  ctx: AppContext,
  pageId: string,
  input: unknown,
): Promise<{ target: ResolvedActionTarget } | { error: McpErrorResponse }> {
  const parsed = actionTargetSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
        field: issue?.path.join('.') ?? 'input',
      }),
    };
  }

  const { elementId, query, preferRegion, preferRole, candidateIndex } = parsed.data;

  if (elementId) {
    const elementResult = await resolveElement(ctx, pageId, elementId);
    if ('error' in elementResult) return elementResult;
    return { target: { element: elementResult.element } };
  }

  const disambiguation: FindDisambiguation = { preferRegion, preferRole, candidateIndex };
  const found = await resolveFindMatch(ctx, pageId, query!, disambiguation);
  if ('error' in found) return found;

  return {
    target: {
      element: found.match.element,
      query,
      matchCount: found.match.matchCount,
      selectedReason: found.match.selectedReason,
    },
  };
}
