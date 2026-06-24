import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppContext } from '../../core/context.js';
import { screenshotUrlForPath } from '../../core/screenshot-url.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';

const screenshotSchema = z
  .object({
    pageId: z.string().uuid(),
    fullPage: z.boolean().optional(),
    returnInline: z.boolean().optional(),
  })
  .strict();

export interface ScreenshotResult {
  file: string;
  url?: string;
  width: number;
  height: number;
  fullPage: boolean;
}

export async function captureScreenshot(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<ScreenshotResult> | McpErrorResponse> {
  const parsed = screenshotSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, fullPage = false } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const cdpPage = toCdpPage(pageResult.page);

  try {
    const { buffer, width, height } = await ctx.cdp.captureScreenshot(cdpPage, fullPage);
    const screenshotDir = ctx.config.screenshotDir;
    await mkdir(screenshotDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${pageId}.png`;
    const filePath = join(screenshotDir, filename);
    await writeFile(filePath, buffer);

    if (ctx.recording.isEnabled(pageResult.page.browserId)) {
      ctx.recording.emit(pageResult.page.browserId, {
        type: 'screenshot',
        pageId,
        payload: { file: filePath, fullPage },
      });
    }

    const url = screenshotUrlForPath(filePath, ctx.config);
    const payload: ScreenshotResult = { file: filePath, width, height, fullPage };
    if (url) payload.url = url;

    return success(payload);
  } catch (error) {
    const mapped = mapCdpError(error, 'page.screenshot');
    return createError(mapped.code, mapped.message, { ...mapped.details, pageId });
  }
}

export { screenshotSchema };
