import type { AppContext } from '../../core/context.js';
import type { CdpPage } from '../../cdp/adapter.js';
import { createError } from '../../core/errors/envelope.js';
import type { McpErrorResponse } from '../../core/types/responses.js';
import type { Element, PageSession } from '../../core/types/sessions.js';

export async function resolvePageSession(
  ctx: AppContext,
  pageId: string,
): Promise<{ page: PageSession } | { error: McpErrorResponse }> {
  const page = await ctx.registry.getPage(pageId);
  if (!page) {
    return {
      error: createError(
        'SESSION_NOT_FOUND',
        `Page session '${pageId}' not found. Call page.create to open a new page.`,
        { pageId },
      ),
    };
  }
  return { page };
}

export function toCdpPage(page: PageSession): CdpPage {
  return {
    id: page.pageId,
    browserId: page.browserId,
    targetId: page.pageId,
    url: page.url,
    title: page.title,
  };
}

export async function resolveElement(
  ctx: AppContext,
  pageId: string,
  elementId: string,
): Promise<{ element: Element } | { error: McpErrorResponse }> {
  const element = await ctx.registry.getElement(pageId, elementId);
  if (!element || !element.selector) {
    return {
      error: createError(
        'ELEMENT_NOT_FOUND',
        `Element '${elementId}' not found or stale. Call page.elements or page.find to refresh.`,
        { pageId, elementId },
      ),
    };
  }
  return { element };
}

export function emitActionRecording(
  ctx: AppContext,
  browserId: string,
  pageId: string,
  payload: Record<string, unknown>,
): void {
  if (ctx.recording.isEnabled(browserId)) {
    ctx.recording.emit(browserId, {
      type: 'action',
      pageId,
      payload,
    });
  }
}
