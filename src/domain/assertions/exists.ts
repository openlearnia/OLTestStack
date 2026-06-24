import type { AppContext } from '../../core/context.js';
import { createError } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import type { CdpNode } from '../../cdp/adapter.js';
import { z } from 'zod';
import {
  cdpNodeToElement,
  filterVisible,
  matchesQuery,
} from '../elements/element-matcher.js';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';
import { assertionFail, assertionPass } from './result.js';

const existsSchema = z
  .object({
    pageId: z.string().uuid(),
    query: z.string().min(1).optional(),
    elementId: z.string().uuid().optional(),
    negate: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.query !== undefined || data.elementId !== undefined, {
    message: 'Either query or elementId is required',
    path: ['query'],
  });

export interface AssertExistsPassResult {
  passed: true;
  assertion: 'exists';
  message: string;
  elementId?: string;
  query?: string;
  negate?: boolean;
}

export async function assertExists(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<AssertExistsPassResult> | McpErrorResponse> {
  const parsed = existsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, query, elementId, negate = false } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const { page } = pageResult;
  const cdpPage = toCdpPage(page);

  try {
    if (elementId) {
      const element = await ctx.registry.getElement(pageId, elementId);
      if (!element || !element.visible) {
        if (negate) {
          const message = element
            ? `Element '${elementId}' is not visible`
            : `Element '${elementId}' does not exist`;
          return assertionPass(ctx, page.browserId, pageId, 'exists', message, {
            elementId,
            negate: true,
          });
        }
        if (!element) {
          return assertionFail(
            ctx,
            page.browserId,
            pageId,
            'exists',
            `Element '${elementId}' not found on page`,
            { query: elementId, visible: true },
            { found: false },
          );
        }
        return assertionFail(
          ctx,
          page.browserId,
          pageId,
          'exists',
          `Element '${elementId}' exists but is not visible`,
          { query: elementId, visible: true },
          { found: true, visible: false },
        );
      }

      if (negate) {
        return assertionFail(
          ctx,
          page.browserId,
          pageId,
          'exists',
          `Element '${elementId}' exists and is visible`,
          { query: elementId, visible: false },
          { found: true, visible: true },
        );
      }

      const message = `Element '${elementId}' exists and is visible`;
      return assertionPass(ctx, page.browserId, pageId, 'exists', message, { elementId });
    }

    const nodes: CdpNode[] = await ctx.cdp.getAccessibilityTree(cdpPage);
    const allElements = nodes.map((node) => cdpNodeToElement(node, undefined));
    const matches = allElements.filter((el) => {
      const node = nodes.find((n) => n.nodeId === el.selector);
      return matchesQuery(el, query!, node?.ariaLabel);
    });
    const visibleMatches = filterVisible(matches, false);

    if (visibleMatches.length === 0) {
      const domOnly = matches.length > 0;
      if (negate) {
        const message = domOnly
          ? `Element matching '${query}' is not visible`
          : `No visible element matches query '${query}'`;
        return assertionPass(ctx, page.browserId, pageId, 'exists', message, {
          query,
          negate: true,
        });
      }
      return assertionFail(
        ctx,
        page.browserId,
        pageId,
        'exists',
        domOnly
          ? `Element matching '${query}' found but not visible`
          : `No visible element matches query '${query}'`,
        { query: query!, visible: true },
        domOnly ? { found: true, visible: false } : { found: false },
      );
    }

    if (negate) {
      return assertionFail(
        ctx,
        page.browserId,
        pageId,
        'exists',
        `Element matching '${query}' exists and is visible`,
        { query: query!, visible: false },
        { found: true, visible: true, elementId: visibleMatches[0]!.elementId },
      );
    }

    const best = visibleMatches[0]!;
    await ctx.registry.registerElement(pageId, { ...best, discoveredQuery: query });

      const message = `Element matching '${query}' exists and is visible`;
      return assertionPass(ctx, page.browserId, pageId, 'exists', message, {
        query,
        elementId: best.elementId,
      });
  } catch (error) {
    const mapped = mapCdpError(error, 'assert.exists');
    return createError(mapped.code, mapped.message, { ...mapped.details, pageId, query, elementId });
  }
}

export { existsSchema };
