import type { AppContext } from '../../core/context.js';
import { createError } from '../../core/errors/envelope.js';
import type { McpErrorResponse } from '../../core/types/responses.js';
import type { Element } from '../../core/types/sessions.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import type { CdpNode } from '../../cdp/adapter.js';
import { z } from 'zod';
import {
  cdpNodeToElement,
  filterVisible,
  matchesQuery,
  rankFindMatches,
  type RankedMatch,
} from './element-matcher.js';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';

export const findDisambiguationSchema = z
  .object({
    preferRegion: z.string().min(1).optional(),
    preferRole: z.string().min(1).optional(),
    candidateIndex: z.number().int().min(0).optional(),
  })
  .strict();

export type FindDisambiguation = z.infer<typeof findDisambiguationSchema>;

export interface ResolvedFindMatch {
  element: Element;
  matchCount: number;
  selectedReason: string;
  selectedIndex: number;
  candidates?: Array<{ element: Element; reason: string }>;
}

function applyDisambiguation(
  ranked: RankedMatch[],
  prefs: FindDisambiguation,
  regionHints: Map<string, string>,
): RankedMatch[] {
  if (!prefs.preferRegion && !prefs.preferRole) {
    return ranked;
  }

  const preferRegion = prefs.preferRegion?.toLowerCase();
  const preferRole = prefs.preferRole?.toLowerCase();

  return [...ranked]
    .map((match) => {
      const regionHint = match.element.selector
        ? regionHints.get(match.element.selector)
        : undefined;
      let bonus = 0;

      if (preferRegion && regionHint?.toLowerCase() === preferRegion) {
        bonus += 200;
      }
      if (preferRole && match.element.role.toLowerCase() === preferRole) {
        bonus += 200;
      }

      return bonus > 0 ? { ...match, score: match.score + bonus } : match;
    })
    .sort((a, b) => b.score - a.score);
}

export async function resolveFindMatch(
  ctx: AppContext,
  pageId: string,
  query: string,
  disambiguation: FindDisambiguation = {},
): Promise<{ match: ResolvedFindMatch } | { error: McpErrorResponse }> {
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult;

  const cdpPage = toCdpPage(pageResult.page);

  try {
    const nodes: CdpNode[] = await ctx.cdp.getAccessibilityTree(cdpPage);
    const regionHints = new Map(
      nodes
        .filter((node) => node.regionHint)
        .map((node) => [node.nodeId, node.regionHint!] as const),
    );
    const allElements = nodes.map((node) => cdpNodeToElement(node, undefined));

    const matches = allElements.filter((el) => {
      const node = nodes.find((n) => n.nodeId === el.selector);
      return matchesQuery(el, query, node?.ariaLabel);
    });

    const visibleMatches = filterVisible(matches, false);

    if (visibleMatches.length === 0) {
      return {
        error: createError(
          'ELEMENT_NOT_FOUND',
          `No interactive element matches query '${query}'. Call page_elements to refresh element list.`,
          { pageId, query },
        ),
      };
    }

    const ranked = applyDisambiguation(
      rankFindMatches(visibleMatches, query, regionHints),
      disambiguation,
      regionHints,
    );

    const selectedIndex = disambiguation.candidateIndex ?? 0;
    if (selectedIndex >= ranked.length) {
      return {
        error: createError(
          'INVALID_INPUT',
          `candidateIndex ${selectedIndex} is out of range (${ranked.length} matches for '${query}')`,
          { field: 'candidateIndex', pageId, query, matchCount: ranked.length },
        ),
      };
    }

    const selected = ranked[selectedIndex]!;
    const element = { ...selected.element, discoveredQuery: query };
    await ctx.registry.registerElement(pageId, element);

    const result: ResolvedFindMatch = {
      element,
      matchCount: visibleMatches.length,
      selectedReason: selected.reason,
      selectedIndex,
    };

    if (visibleMatches.length > 1) {
      result.candidates = ranked.slice(0, 5).map((match) => ({
        element: match.element,
        reason: match.reason,
      }));
    }

    return { match: result };
  } catch (error) {
    const mapped = mapCdpError(error, 'page_find');
    return { error: createError(mapped.code, mapped.message, { ...mapped.details, pageId, query }) };
  }
}
