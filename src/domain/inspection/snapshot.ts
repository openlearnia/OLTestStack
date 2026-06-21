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
} from '../elements/element-matcher.js';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';

const snapshotSchema = z
  .object({
    pageId: z.string().uuid(),
  })
  .strict();

export interface SnapshotResult {
  url: string;
  title: string;
  domSummary: {
    nodeCount: number;
    formCount: number;
    linkCount: number;
    imageCount: number;
  };
  elements: Omit<Element, 'selector'>[];
}

export async function captureSnapshot(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<SnapshotResult> | McpErrorResponse> {
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const cdpPage = toCdpPage(pageResult.page);

  try {
    const [url, title, domSummary, nodes] = await Promise.all([
      ctx.cdp.getUrl(cdpPage),
      ctx.cdp.getTitle(cdpPage),
      ctx.cdp.getDomStats(cdpPage),
      ctx.cdp.getAccessibilityTree(cdpPage),
    ]);

    await ctx.registry.updatePage(pageId, { url, title });

    const allElements = nodes.map((node: CdpNode) => cdpNodeToElement(node));
    const visibleElements = filterVisible(allElements, false).slice(0, MAX_ELEMENTS);

    const elementMap = new Map<string, Element>();
    for (const el of visibleElements) {
      elementMap.set(el.elementId, el);
    }
    await ctx.registry.setElements(pageId, elementMap);

    return success({
      url,
      title,
      domSummary,
      elements: toPublicElements(visibleElements),
    });
  } catch (error) {
    const mapped = mapCdpError(error, 'page.snapshot');
    return createError(mapped.code, mapped.message, { ...mapped.details, pageId });
  }
}

export { snapshotSchema };
