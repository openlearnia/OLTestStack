import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';

const createSchema = z
  .object({
    browserId: z.string().uuid(),
  })
  .strict();

export interface PageCreateResult {
  pageId: string;
  browserId: string;
}

async function checkBrowser(
  ctx: AppContext,
  browserId: string,
): Promise<McpErrorResponse | null> {
  const browser = await ctx.registry.getBrowser(browserId);
  if (!browser) {
    return createError(
      'SESSION_NOT_FOUND',
      `Browser session '${browserId}' not found. Call browser_launch to start a new browser.`,
      { browserId },
    );
  }
  if (browser.crashed || !ctx.cdp.isConnected({ id: browserId, connected: true })) {
    return createError(
      'BROWSER_CRASHED',
      `Browser session '${browserId}' has crashed. Call browser_launch to start a new browser.`,
      { browserId },
    );
  }
  return null;
}

export async function createPage(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<PageCreateResult> | McpErrorResponse> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'browserId',
    });
  }

  const { browserId } = parsed.data;
  const browserError = await checkBrowser(ctx, browserId);
  if (browserError) return browserError;

  try {
    const cdpPage = await ctx.cdp.createPage({ id: browserId, connected: true });
    const createdAt = new Date().toISOString();

    await ctx.registry.createPage({
      pageId: cdpPage.id,
      browserId,
      url: cdpPage.url,
      title: cdpPage.title,
      createdAt,
    });

    ctx.cdp.startPageMonitoring(cdpPage, {
      onNetworkError: (entry) => {
        if (ctx.recording.isEnabled(browserId)) {
          ctx.recording.emit(browserId, {
            type: 'network',
            pageId: cdpPage.id,
            payload: { ...entry },
          });
        }
      },
      onConsoleError: (entry) => {
        if (ctx.recording.isEnabled(browserId)) {
          ctx.recording.emit(browserId, {
            type: 'console',
            pageId: cdpPage.id,
            payload: { ...entry },
          });
        }
      },
    });

    return success({ pageId: cdpPage.id, browserId });
  } catch (error) {
    const mapped = mapCdpError(error, 'page_create');
    return createError(mapped.code, mapped.message, { ...mapped.details, browserId });
  }
}

export { createSchema };
