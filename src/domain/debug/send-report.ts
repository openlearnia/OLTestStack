import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import type { BrowserSession, Element, PageSession, RecordedEvent } from '../../core/types/sessions.js';
import { toPublicElement } from '../../core/types/sessions.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';
import { z } from 'zod';

const sendReportSchema = z
  .object({
    browserId: z.string().uuid(),
    includeScreenshots: z.boolean().optional(),
    note: z.string().optional(),
  })
  .strict();

export interface RegistryPageSnapshot {
  page: PageSession;
  elements: Array<Omit<Element, 'selector'>>;
}

export interface DebugReportPayload {
  browserSession: BrowserSession;
  pages: PageSession[];
  events: RecordedEvent[];
  eventCount: number;
  registrySnapshot: {
    pages: RegistryPageSnapshot[];
  };
  note?: string;
  screenshots?: Array<{ pageId: string; file: string }>;
}

export interface SendReportResult {
  debugId: string;
  browserId: string;
  recordedAt: string;
  report: DebugReportPayload;
  reportFile?: string;
}

function createDebugId(): string {
  return `dbg_${randomUUID()}`;
}

async function buildRegistrySnapshot(
  ctx: AppContext,
  pageIds: string[],
): Promise<RegistryPageSnapshot[]> {
  const snapshots: RegistryPageSnapshot[] = [];
  for (const pageId of pageIds) {
    const page = await ctx.registry.getPage(pageId);
    if (!page) continue;
    const elements = await ctx.registry.getElementsForPage(pageId);
    snapshots.push({
      page,
      elements: [...elements.values()].map((element) => toPublicElement(element)),
    });
  }
  return snapshots;
}

async function capturePageScreenshots(
  ctx: AppContext,
  pageIds: string[],
): Promise<Array<{ pageId: string; file: string }>> {
  const screenshots: Array<{ pageId: string; file: string }> = [];
  const screenshotDir = join(ctx.config.screenshotDir, 'debug');
  await mkdir(screenshotDir, { recursive: true });

  for (const pageId of pageIds) {
    const pageResult = await resolvePageSession(ctx, pageId);
    if ('error' in pageResult) continue;

    try {
      const cdpPage = toCdpPage(pageResult.page);
      const { buffer } = await ctx.cdp.captureScreenshot(cdpPage, false);
      const filename = `${pageId}.png`;
      const filePath = join(screenshotDir, filename);
      await writeFile(filePath, buffer);
      screenshots.push({ pageId, file: filePath });
    } catch {
      // Best-effort — omit pages that fail to capture
    }
  }

  return screenshots;
}

export async function sendReport(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<SendReportResult> | McpErrorResponse> {
  const parsed = sendReportSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { browserId, includeScreenshots = false, note } = parsed.data;
  const browser = await ctx.registry.getBrowser(browserId);
  if (!browser) {
    return createError(
      'SESSION_NOT_FOUND',
      `Browser session '${browserId}' not found. Call browser_launch first.`,
      { browserId },
    );
  }

  const pages: PageSession[] = [];
  for (const pageId of browser.pageIds) {
    const page = await ctx.registry.getPage(pageId);
    if (page) pages.push(page);
  }

  const events = ctx.recording.getEvents(browserId);
  const registrySnapshot = await buildRegistrySnapshot(ctx, browser.pageIds);
  const recordedAt = new Date().toISOString();

  const report: DebugReportPayload = {
    browserSession: browser,
    pages,
    events,
    eventCount: events.length,
    registrySnapshot: { pages: registrySnapshot },
    ...(note !== undefined ? { note } : {}),
  };

  if (includeScreenshots) {
    if (!ctx.cdp.isConnected({ id: browserId, connected: true })) {
      return createError(
        'BROWSER_CRASHED',
        `Browser session '${browserId}' is not connected. Cannot capture screenshots.`,
        { browserId },
      );
    }

    try {
      const screenshots = await capturePageScreenshots(ctx, browser.pageIds);
      if (screenshots.length > 0) {
        report.screenshots = screenshots;
      }
    } catch (error) {
      const mapped = mapCdpError(error, 'send_report');
      return createError(mapped.code, mapped.message, { ...mapped.details, browserId });
    }
  }

  const debugId = createDebugId();
  const debugDir = join(ctx.config.screenshotDir, 'debug');
  await mkdir(debugDir, { recursive: true });
  const reportFile = join(debugDir, `${debugId}.json`);
  await writeFile(reportFile, JSON.stringify({ debugId, browserId, recordedAt, report }, null, 2));

  const stderrPayload = {
    debugId,
    browserId,
    recordedAt,
    eventCount: events.length,
    pageCount: pages.length,
    reportFile,
    ...(note !== undefined ? { note } : {}),
  };
  console.error(`[olteststack:debug] ${JSON.stringify(stderrPayload)}`);

  return success({
    debugId,
    browserId,
    recordedAt,
    report,
    reportFile,
  });
}

export { sendReportSchema };
