import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';

const navigateSchema = z
  .object({
    pageId: z.string().uuid(),
    url: z.string().min(1),
    waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
    timeoutMs: z.number().int().min(1000).optional(),
  })
  .strict();

export interface PageNavigateResult {
  url: string;
  title: string;
  statusCode?: number;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'file:';
  } catch {
    return false;
  }
}

export async function navigatePage(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<PageNavigateResult> | McpErrorResponse> {
  const parsed = navigateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, url, waitUntil, timeoutMs } = parsed.data;

  if (!isValidUrl(url)) {
    return createError(
      'INVALID_INPUT',
      `Invalid URL '${url}'. Provide a fully qualified URL including scheme (https://).`,
      { field: 'url', value: url },
    );
  }

  const page = await ctx.registry.getPage(pageId);
  if (!page) {
    return createError(
      'SESSION_NOT_FOUND',
      `Page session '${pageId}' not found. Call page_create to open a new page.`,
      { pageId },
    );
  }

  const browser = await ctx.registry.getBrowser(page.browserId);
  if (!browser || browser.crashed) {
    return createError(
      browser?.crashed ? 'BROWSER_CRASHED' : 'SESSION_NOT_FOUND',
      `Browser for page '${pageId}' is not available.`,
      { pageId, browserId: page.browserId },
    );
  }

  const timeout = timeoutMs ?? ctx.config.defaultNavigationTimeoutMs;

  try {
    const cdpPage = {
      id: pageId,
      browserId: page.browserId,
      targetId: pageId,
      url: page.url,
      title: page.title,
    };

    const { statusCode } = await ctx.cdp.navigate(cdpPage, url, {
      waitUntil,
      timeoutMs: timeout,
    });

    const finalUrl = await ctx.cdp.getUrl(cdpPage);
    const title = await ctx.cdp.getTitle(cdpPage);

    await ctx.registry.invalidateElements(pageId);
    await ctx.registry.updatePage(pageId, { url: finalUrl, title });

    if (ctx.recording.isEnabled(page.browserId)) {
      ctx.recording.emit(page.browserId, {
        type: 'navigation',
        pageId,
        payload: { url: finalUrl, title, action: 'navigate' },
      });
    }

    return success({ url: finalUrl, title, ...(statusCode !== undefined ? { statusCode } : {}) });
  } catch (error) {
    const mapped = mapCdpError(error, 'page.navigate');
    const code = mapped.code === 'INTERNAL_ERROR' && mapped.message.includes('timed out')
      ? 'TIMEOUT'
      : mapped.code === 'INTERNAL_ERROR' && mapped.message.includes('Navigation')
        ? 'NAVIGATION_FAILED'
        : mapped.code;

    return createError(code, mapped.message, {
      ...mapped.details,
      pageId,
      url,
      ...(code === 'TIMEOUT' ? { elapsedMs: timeout } : {}),
    });
  }
}

export { navigateSchema };
