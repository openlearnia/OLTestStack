import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import type { Element } from '../../core/types/sessions.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import type { CdpNode } from '../../cdp/adapter.js';
import { z } from 'zod';
import {
  cdpNodeToElement,
  filterVisible,
  matchesQuery,
  rankFindMatches,
  toPublicElements,
} from './element-matcher.js';

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
  const page = await ctx.registry.getPage(pageId);
  if (!page) {
    return createError(
      'SESSION_NOT_FOUND',
      `Page session '${pageId}' not found. Call page_create to open a new page.`,
      { pageId },
    );
  }

  try {
    const cdpPage = {
      id: pageId,
      browserId: page.browserId,
      targetId: pageId,
      url: page.url,
      title: page.title,
    };

    const nodes: CdpNode[] = await ctx.cdp.getAccessibilityTree(cdpPage);
    const regionHints = new Map(
      nodes
        .filter((node) => node.regionHint)
        .map((node) => [node.nodeId, node.regionHint!] as const),
    );
    const allElements = nodes.map((node: CdpNode) =>
      cdpNodeToElement(node, undefined),
    );

    const matches = allElements.filter((el) => {
      const node = nodes.find((n: CdpNode) => n.nodeId === el.selector);
      return matchesQuery(el, query, node?.ariaLabel);
    });

    const visibleMatches = filterVisible(matches, false);

    if (visibleMatches.length === 0) {
      return createError(
        'ELEMENT_NOT_FOUND',
        `No interactive element matches query '${query}'. Call page_elements to refresh element list.`,
        { pageId, query },
      );
    }

    const ranked = rankFindMatches(visibleMatches, query, regionHints);
    const best = ranked[0]!.element;
    await ctx.registry.registerElement(pageId, best);

    const publicElements = toPublicElements([best]);
    const result: FindResult = {
      element: publicElements[0]!,
      matchCount: visibleMatches.length,
      selectedReason: ranked[0]!.reason,
    };

    if (visibleMatches.length > 1) {
      result.candidates = ranked.slice(0, 5).map((match) => ({
        element: toPublicElements([match.element])[0]!,
        reason: match.reason,
      }));
    }

    return success(result);
  } catch (error) {
    const mapped = mapCdpError(error, 'page_find');
    return createError(mapped.code, mapped.message, { ...mapped.details, pageId, query });
  }
}

export { findSchema };
