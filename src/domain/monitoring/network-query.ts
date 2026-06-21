import type { NetworkEntry } from '../../cdp/adapter.js';
import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { z } from 'zod';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';

const networkSchema = z
  .object({
    pageId: z.string().uuid(),
    filter: z.string().optional(),
    since: z.string().datetime().optional(),
  })
  .strict();

export interface NetworkResult {
  requests: NetworkEntry[];
  count: number;
  errorCount: number;
}

export function filterNetworkEntries(
  entries: NetworkEntry[],
  options: { filter?: string; since?: string },
): NetworkEntry[] {
  let filtered = entries;

  if (options.since) {
    const sinceMs = Date.parse(options.since);
    filtered = filtered.filter((entry) => Date.parse(entry.timestamp) > sinceMs);
  }

  if (options.filter) {
    const needle = options.filter.toLowerCase();
    filtered = filtered.filter((entry) => entry.url.toLowerCase().includes(needle));
  }

  return filtered;
}

export async function queryNetwork(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<NetworkResult> | McpErrorResponse> {
  const parsed = networkSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, filter, since } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const cdpPage = toCdpPage(pageResult.page);
  const allEntries = ctx.cdp.getNetworkEntries(cdpPage);
  const requests = filterNetworkEntries(allEntries, { filter, since });
  const errorCount = requests.filter((entry) => entry.failed).length;

  return success({ requests, count: requests.length, errorCount });
}

export { networkSchema };
