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
  matchesQuery,
} from '../elements/element-matcher.js';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';
import { isNetworkIdle, matchesUrl, WAIT_POLL_MS } from './conditions.js';

const waitSchema = z
  .object({
    pageId: z.string().uuid(),
    condition: z.enum(['element', 'url', 'networkIdle', 'timeout']),
    query: z.string().min(1).optional(),
    value: z.string().min(1).optional(),
    match: z.enum(['equals', 'contains']).optional(),
    durationMs: z.number().int().min(100).optional(),
    timeoutMs: z.number().int().min(1000).optional(),
  })
  .strict();

export interface WaitResult {
  satisfied: true;
  condition: string;
  elapsedMs: number;
  elementId?: string;
  url?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForCondition(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<WaitResult> | McpErrorResponse> {
  const parsed = waitSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, condition, query, value, match, durationMs, timeoutMs } = parsed.data;

  if (condition === 'element' && !query) {
    return createError('INVALID_INPUT', 'query is required when condition is element', {
      field: 'query',
      condition,
    });
  }
  if (condition === 'url' && !value) {
    return createError('INVALID_INPUT', 'value is required when condition is url', {
      field: 'value',
      condition,
    });
  }
  if (condition === 'timeout' && durationMs === undefined) {
    return createError('INVALID_INPUT', 'durationMs is required when condition is timeout', {
      field: 'durationMs',
      condition,
    });
  }

  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const deadline = Date.now() + (timeoutMs ?? ctx.config.defaultWaitTimeoutMs);
  const startMs = Date.now();
  const cdpPage = toCdpPage(pageResult.page);

  if (condition === 'timeout') {
    const waitMs = Math.min(durationMs!, deadline - Date.now());
    if (waitMs > 0) await sleep(waitMs);
    return success({
      satisfied: true as const,
      condition,
      elapsedMs: Date.now() - startMs,
    });
  }

  while (Date.now() < deadline) {
    try {
      if (condition === 'element') {
        const matched = await findMatchingElement(ctx, cdpPage, query!);
        if (matched) {
          await ctx.registry.registerElement(pageId, matched);
          return success({
            satisfied: true as const,
            condition,
            elapsedMs: Date.now() - startMs,
            elementId: matched.elementId,
          });
        }
      }

      if (condition === 'url') {
        const currentUrl = await ctx.cdp.getUrl(cdpPage);
        if (matchesUrl(currentUrl, value!, match ?? 'contains')) {
          await ctx.registry.updatePage(pageId, { url: currentUrl });
          return success({
            satisfied: true as const,
            condition,
            elapsedMs: Date.now() - startMs,
            url: currentUrl,
          });
        }
      }

      if (condition === 'networkIdle') {
        const inFlight = ctx.cdp.getInFlightNetworkCount(cdpPage);
        const lastActivity = ctx.cdp.getLastNetworkActivityMs(cdpPage);
        if (isNetworkIdle(inFlight, lastActivity)) {
          return success({
            satisfied: true as const,
            condition,
            elapsedMs: Date.now() - startMs,
          });
        }
      }
    } catch (error) {
      const mapped = mapCdpError(error, 'page.wait');
      return createError(mapped.code, mapped.message, { ...mapped.details, pageId, condition });
    }

    await sleep(WAIT_POLL_MS);
  }

  const elapsedMs = Date.now() - startMs;
  const timeoutMessage =
    condition === 'element'
      ? `Element matching '${query}' did not appear within ${timeoutMs ?? ctx.config.defaultWaitTimeoutMs}ms.`
      : condition === 'url'
        ? `URL did not match '${value}' within ${timeoutMs ?? ctx.config.defaultWaitTimeoutMs}ms.`
        : `Network did not become idle within ${timeoutMs ?? ctx.config.defaultWaitTimeoutMs}ms.`;

  return createError('TIMEOUT', timeoutMessage, { pageId, condition, elapsedMs });
}

async function findMatchingElement(
  ctx: AppContext,
  cdpPage: ReturnType<typeof toCdpPage>,
  query: string,
): Promise<Element | null> {
  const nodes: CdpNode[] = await ctx.cdp.getAccessibilityTree(cdpPage);
  const allElements = nodes.map((node) => cdpNodeToElement(node));
  const matches = allElements.filter((el) => {
    const node = nodes.find((n) => n.nodeId === el.selector);
    return matchesQuery(el, query, node?.ariaLabel);
  });
  const visible = filterVisible(matches, false);
  return visible[0] ?? null;
}

export { waitSchema };
