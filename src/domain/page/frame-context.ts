import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import type { FrameInfo } from '../../cdp/adapter.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';

const pageFrameSchema = z
  .object({
    pageId: z.string().uuid(),
    action: z.enum(['list', 'enter', 'exit']),
    frameIndex: z.number().int().min(0).optional(),
    frameQuery: z.string().min(1).optional(),
    frameUrl: z.string().min(1).optional(),
  })
  .strict()
  .refine((data) => data.action !== 'enter' || data.frameIndex !== undefined || data.frameQuery || data.frameUrl, {
    message: 'enter requires frameIndex, frameQuery, or frameUrl',
    path: ['frameIndex'],
  });

export interface PageFrameListResult {
  action: 'list';
  frames: FrameInfo[];
  activeFrameIndex: number;
}

export interface PageFrameEnterResult {
  action: 'enter';
  frame: FrameInfo;
  activeFrameIndex: number;
}

export interface PageFrameExitResult {
  action: 'exit';
  activeFrameIndex: number;
}

export async function manageFrameContext(
  ctx: AppContext,
  input: unknown,
): Promise<
  McpSuccessResponse<PageFrameListResult | PageFrameEnterResult | PageFrameExitResult> | McpErrorResponse
> {
  const parsed = pageFrameSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, action, frameIndex, frameQuery, frameUrl } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const { page } = pageResult;
  const cdpPage = toCdpPage(page);

  try {
    if (action === 'list') {
      const frames = await ctx.cdp.listFrames(cdpPage);
      const activeFrameIndex = page.activeFrameIndex ?? 0;
      return success({ action: 'list', frames, activeFrameIndex });
    }

    if (action === 'exit') {
      await ctx.cdp.exitFrame(cdpPage);
      await ctx.registry.invalidateElements(pageId);
      await ctx.registry.updatePage(pageId, { activeFrameIndex: 0, activeFrameUrl: undefined });
      return success({ action: 'exit', activeFrameIndex: 0 });
    }

    const frame = await ctx.cdp.enterFrame(cdpPage, { frameIndex, frameQuery, frameUrl });
    await ctx.registry.invalidateElements(pageId);
    await ctx.registry.updatePage(pageId, {
      activeFrameIndex: frame.index,
      activeFrameUrl: frame.url,
    });

    return success({
      action: 'enter',
      frame,
      activeFrameIndex: frame.index,
    });
  } catch (error) {
    const mapped = mapCdpError(error, 'page.frame');
    return createError(mapped.code, mapped.message, { ...mapped.details, pageId, action });
  }
}

export { pageFrameSchema };
