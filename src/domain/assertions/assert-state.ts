import type { AppContext } from '../../core/context.js';
import { createError, isErrorResponse, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { z } from 'zod';
import { isValidNetworkStatusInput } from './match-utils.js';
import { assertExists } from './exists.js';
import { assertNetwork } from './network.js';
import { assertText } from './text.js';
import { assertUrl } from './url.js';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';

const existsCheckSchema = z
  .object({
    query: z.string().min(1).optional(),
    elementId: z.string().uuid().optional(),
    negate: z.boolean().optional(),
    soft: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.query !== undefined || data.elementId !== undefined, {
    message: 'exists check requires query or elementId',
  });

const textCheckSchema = z
  .object({
    contains: z.string().min(1),
    match: z.enum(['contains', 'equals']).optional(),
    negate: z.boolean().optional(),
    soft: z.boolean().optional(),
  })
  .strict();

const urlCheckSchema = z
  .object({
    url: z.string().min(1),
    match: z.enum(['equals', 'contains']).optional(),
    negate: z.boolean().optional(),
    soft: z.boolean().optional(),
  })
  .strict();

const networkCheckSchema = z
  .object({
    url: z.string().min(1),
    status: z.union([z.number().int(), z.string()]),
    negate: z.boolean().optional(),
    soft: z.boolean().optional(),
  })
  .strict()
  .refine((data) => isValidNetworkStatusInput(data.status), {
    message: 'status must be an integer 100–599 or a range like 2xx',
  });

const assertStateSchema = z
  .object({
    pageId: z.string().uuid(),
    checks: z
      .object({
        exists: z.array(existsCheckSchema).optional(),
        text: z.array(textCheckSchema).optional(),
        url: urlCheckSchema.optional(),
        network: z.array(networkCheckSchema).optional(),
        consoleErrorCount: z
          .object({
            max: z.number().int().min(0),
            soft: z.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    failFast: z.boolean().optional(),
    soft: z.boolean().optional(),
  })
  .strict();

export interface AssertStateCheckResult {
  kind: string;
  passed: boolean;
  soft?: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface AssertStateResult {
  passed: boolean;
  checks: AssertStateCheckResult[];
  softFailures: AssertStateCheckResult[];
}

function isSoftFailure(result: McpSuccessResponse<unknown> | McpErrorResponse): boolean {
  return (
    result.ok === true &&
    typeof result.data === 'object' &&
    result.data !== null &&
    'passed' in result.data &&
    result.data.passed === false &&
    'soft' in result.data &&
    result.data.soft === true
  );
}

export async function assertPageState(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<AssertStateResult> | McpErrorResponse> {
  const parsed = assertStateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, checks, failFast = false, soft: globalSoft = false } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const results: AssertStateCheckResult[] = [];
  const softFailures: AssertStateCheckResult[] = [];
  const hardFailures: AssertStateCheckResult[] = [];

  const recordFailure = (
    kind: string,
    message: string,
    soft: boolean,
    details?: Record<string, unknown>,
  ): void => {
    const entry: AssertStateCheckResult = { kind, passed: false, soft, message, details };
    results.push(entry);
    if (soft) {
      softFailures.push(entry);
    } else {
      hardFailures.push(entry);
    }
  };

  const recordPass = (kind: string, message: string, details?: Record<string, unknown>): void => {
    results.push({ kind, passed: true, message, details });
  };

  for (const check of checks.exists ?? []) {
    const soft = check.soft ?? globalSoft;
    const result = await assertExists(ctx, { pageId, ...check, soft });
    if (isErrorResponse(result)) {
      recordFailure('exists', result.error.message, soft, { query: check.query, elementId: check.elementId });
      if (failFast && !soft) {
        return createError('ASSERTION_FAILED', result.error.message, { checks: results, softFailures });
      }
      continue;
    }
    if (isSoftFailure(result)) {
      recordFailure('exists', result.data.message, true, result.data as unknown as Record<string, unknown>);
      continue;
    }
    recordPass('exists', result.data.message, result.data as unknown as Record<string, unknown>);
  }

  for (const check of checks.text ?? []) {
    const soft = check.soft ?? globalSoft;
    const result = await assertText(ctx, { pageId, ...check, soft });
    if (isErrorResponse(result)) {
      recordFailure('text', result.error.message, soft, { contains: check.contains });
      if (failFast && !soft) {
        return createError('ASSERTION_FAILED', result.error.message, { checks: results, softFailures });
      }
      continue;
    }
    if (isSoftFailure(result)) {
      recordFailure('text', result.data.message, true, result.data as unknown as Record<string, unknown>);
      continue;
    }
    recordPass('text', result.data.message, result.data as unknown as Record<string, unknown>);
  }

  if (checks.url) {
    const soft = checks.url.soft ?? globalSoft;
    const result = await assertUrl(ctx, { pageId, ...checks.url, soft });
    if (isErrorResponse(result)) {
      recordFailure('url', result.error.message, soft, { url: checks.url.url });
      if (failFast && !soft) {
        return createError('ASSERTION_FAILED', result.error.message, { checks: results, softFailures });
      }
    } else if (isSoftFailure(result)) {
      recordFailure('url', result.data.message, true, result.data as unknown as Record<string, unknown>);
    } else {
      recordPass('url', result.data.message, result.data as unknown as Record<string, unknown>);
    }
  }

  for (const check of checks.network ?? []) {
    const soft = check.soft ?? globalSoft;
    const result = await assertNetwork(ctx, { pageId, ...check, soft });
    if (isErrorResponse(result)) {
      recordFailure('network', result.error.message, soft, { url: check.url, status: check.status });
      if (failFast && !soft) {
        return createError('ASSERTION_FAILED', result.error.message, { checks: results, softFailures });
      }
      continue;
    }
    if (isSoftFailure(result)) {
      recordFailure('network', result.data.message, true, result.data as unknown as Record<string, unknown>);
      continue;
    }
    recordPass('network', result.data.message, result.data as unknown as Record<string, unknown>);
  }

  if (checks.consoleErrorCount) {
    const soft = checks.consoleErrorCount.soft ?? globalSoft;
    const cdpPage = toCdpPage(pageResult.page);
    const errorCount = ctx.cdp
      .getConsoleEntries(cdpPage)
      .filter((entry) => entry.level === 'error').length;
    const max = checks.consoleErrorCount.max;

    if (errorCount > max) {
      const message = `Console error count ${errorCount} exceeds max ${max}`;
      recordFailure('consoleErrorCount', message, soft, { errorCount, max });
      if (failFast && !soft) {
        return createError('ASSERTION_FAILED', message, { checks: results, softFailures });
      }
    } else {
      recordPass('consoleErrorCount', `Console error count ${errorCount} within max ${max}`, {
        errorCount,
        max,
      });
    }
  }

  if (hardFailures.length > 0) {
    return createError('ASSERTION_FAILED', hardFailures[0]!.message, {
      checks: results,
      softFailures,
      failedCount: hardFailures.length,
    });
  }

  return success({
    passed: true,
    checks: results,
    softFailures,
  });
}

export { assertStateSchema };
