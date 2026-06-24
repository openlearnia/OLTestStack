import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';

export type AssertionKind = 'exists' | 'text' | 'url' | 'network';

export interface AssertSoftFailResult {
  passed: false;
  soft: true;
  assertion: AssertionKind;
  message: string;
  expected: unknown;
  actual: unknown;
}

export type AssertHandlerResponse<TPass> =
  | McpSuccessResponse<TPass>
  | McpSuccessResponse<AssertSoftFailResult>
  | McpErrorResponse;

export function emitAssertionRecording(
  ctx: AppContext,
  browserId: string,
  pageId: string,
  payload: Record<string, unknown>,
): void {
  if (ctx.recording.isEnabled(browserId)) {
    ctx.recording.emit(browserId, {
      type: 'assertion',
      pageId,
      payload,
    });
  }
}

export function assertionPass<
  TAssertion extends AssertionKind,
  TExtra extends Record<string, unknown>,
>(
  ctx: AppContext,
  browserId: string,
  pageId: string,
  assertion: TAssertion,
  message: string,
  extra: TExtra,
): McpSuccessResponse<{ passed: true; assertion: TAssertion; message: string } & TExtra> {
  emitAssertionRecording(ctx, browserId, pageId, {
    passed: true,
    assertion,
    message,
    ...extra,
  });
  return success({ passed: true as const, assertion, message, ...extra });
}

export function assertionFail(
  ctx: AppContext,
  browserId: string,
  pageId: string,
  assertion: AssertionKind,
  message: string,
  expected: unknown,
  actual: unknown,
  soft = false,
): McpErrorResponse | McpSuccessResponse<{
  passed: false;
  soft: true;
  assertion: AssertionKind;
  message: string;
  expected: unknown;
  actual: unknown;
}> {
  emitAssertionRecording(ctx, browserId, pageId, {
    passed: false,
    assertion,
    message,
    expected,
    actual,
    soft,
  });

  if (soft) {
    return success({
      passed: false as const,
      soft: true as const,
      assertion,
      message,
      expected,
      actual,
    });
  }

  return createError('ASSERTION_FAILED', message, {
    assertion,
    expected,
    actual,
  });
}
