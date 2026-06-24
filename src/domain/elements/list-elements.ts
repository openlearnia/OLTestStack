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
  MAX_ELEMENTS,
  toPublicElements,
} from './element-matcher.js';

const elementsSchema = z
  .object({
    pageId: z.string().uuid(),
    includeHidden: z.boolean().optional(),
  })
  .strict();

export interface ElementsResult {
  elements: Omit<Element, 'selector'>[];
  count: number;
  truncated?: boolean;
}

export async function listElements(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<ElementsResult> | McpErrorResponse> {
  const parsed = elementsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'pageId',
    });
  }

  const { pageId, includeHidden = false } = parsed.data;
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
    const allElements = nodes.map((node: CdpNode) => cdpNodeToElement(node));
    const visibleElements = filterVisible(allElements, includeHidden);

    const truncated = visibleElements.length > MAX_ELEMENTS;
    const limited = visibleElements.slice(0, MAX_ELEMENTS);

    const elementMap = new Map<string, Element>();
    for (const el of limited) {
      elementMap.set(el.elementId, el);
    }
    await ctx.registry.setElements(pageId, elementMap);

    return success({
      elements: toPublicElements(limited),
      count: limited.length,
      ...(truncated ? { truncated: true } : {}),
    });
  } catch (error) {
    const mapped = mapCdpError(error, 'page_elements');
    return createError(mapped.code, mapped.message, { ...mapped.details, pageId });
  }
}

export { elementsSchema };
