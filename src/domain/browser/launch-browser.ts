import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';

const viewportSchema = z.object({
  width: z.number().int().min(320).default(1280),
  height: z.number().int().min(240).default(720),
});

const launchSchema = z
  .object({
    headless: z.boolean().optional(),
    recordingEnabled: z.boolean().optional(),
    viewport: viewportSchema.optional(),
    userAgent: z.string().optional(),
  })
  .strict();

export type BrowserLaunchInput = z.infer<typeof launchSchema>;

export interface BrowserLaunchResult {
  browserId: string;
  createdAt: string;
}

export async function launchBrowser(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<BrowserLaunchResult> | McpErrorResponse> {
  const parsed = launchSchema.safeParse(input ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') || 'input';
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field,
      value: issue?.path.length ? undefined : input,
    });
  }

  const options = parsed.data;
  const headless = options.headless ?? ctx.config.headless;
  const recordingEnabled = options.recordingEnabled ?? true;

  try {
    const cdpBrowser = await ctx.cdp.launchBrowser({
      headless,
      viewport: options.viewport ?? { width: 1280, height: 720 },
      userAgent: options.userAgent,
      executablePath: ctx.config.chromiumExecutablePath,
    });

    const browserId = cdpBrowser.id;
    const createdAt = new Date().toISOString();

    await ctx.registry.createBrowser({
      browserId,
      createdAt,
      headless,
      recordingEnabled,
      pageIds: [],
    });

    ctx.recording.initBrowser(browserId, recordingEnabled);

    ctx.cdp.onBrowserDisconnect(browserId, () => {
      void ctx.registry.markBrowserCrashed(browserId);
    });

    return success({ browserId, createdAt });
  } catch (error) {
    const mapped = mapCdpError(error, 'browser.launch');
    return createError(mapped.code, mapped.message, mapped.details);
  }
}

export { launchSchema };
