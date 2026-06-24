import type { AppContext } from '../../core/context.js';
import { createError } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { z } from 'zod';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';
import {
  countPartialUrlMatches,
  findMatchingNetworkRequest,
  isValidNetworkStatusInput,
} from './match-utils.js';
import { assertionFail, assertionPass, type AssertSoftFailResult } from './result.js';

const networkSchema = z
  .object({
    pageId: z.string().uuid(),
    url: z.string().min(1),
    status: z.union([z.number().int(), z.string()]),
    negate: z.boolean().optional(),
    soft: z.boolean().optional(),
  })
  .strict()
  .refine((data) => isValidNetworkStatusInput(data.status), {
    message: 'status must be an integer 100–599 or a range like 2xx',
    path: ['status'],
  });

export interface AssertNetworkPassResult {
  passed: true;
  assertion: 'network';
  message: string;
  url?: string;
  status?: number | string;
  negate?: boolean;
  matchingRequests?: number;
  matchedRequest?: {
    url: string;
    status: number;
    method: string;
  };
}

export async function assertNetwork(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<AssertNetworkPassResult> | McpSuccessResponse<AssertSoftFailResult> | McpErrorResponse> {
  const parsed = networkSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, url, status, negate = false, soft = false } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const cdpPage = toCdpPage(pageResult.page);
  const entries = ctx.cdp.getNetworkEntries(cdpPage);
  const networkMatch = findMatchingNetworkRequest(entries, url, status);

  if (negate) {
    if (networkMatch) {
      const message = `Network request to '${networkMatch.url}' returned status ${networkMatch.status}`;
      return assertionFail(ctx, pageResult.page.browserId, pageId, 'network', message, {
        url,
        status,
        negate: true,
      }, {
        matchedRequest: {
          url: networkMatch.url,
          status: networkMatch.status,
          method: networkMatch.method,
        },
      }, soft);
    }

    const partialMatches = countPartialUrlMatches(entries, url);
    const message = `No network request matching url '${url}' with status ${status}`;
    return assertionPass(ctx, pageResult.page.browserId, pageId, 'network', message, {
      url,
      status,
      negate: true,
      matchingRequests: partialMatches,
    });
  }

  if (networkMatch) {
    const message = `Network request to '${networkMatch.url}' returned status ${networkMatch.status}`;
    return assertionPass(ctx, pageResult.page.browserId, pageId, 'network', message, {
      url,
      status,
      matchedRequest: {
        url: networkMatch.url,
        status: networkMatch.status,
        method: networkMatch.method,
      },
    });
  }

  const partialMatches = countPartialUrlMatches(entries, url);
  const message = `No network request matching url '${url}' with status ${status}`;
  return assertionFail(
    ctx,
    pageResult.page.browserId,
    pageId,
    'network',
    message,
    { url, status },
    { matchingRequests: partialMatches },
    soft,
  );
}

export { networkSchema };
