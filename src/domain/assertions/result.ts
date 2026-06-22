import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';

export type AssertionKind = 'exists' | 'text' | 'url' | 'network';

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
): McpErrorResponse {
  emitAssertionRecording(ctx, browserId, pageId, {
    passed: false,
    assertion,
    message,
    expected,
    actual,
  });
  return createError('ASSERTION_FAILED', message, {
    assertion,
    expected,
    actual,
  });
}
