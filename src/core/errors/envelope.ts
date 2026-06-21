import type { ErrorCode } from './codes.js';
import type { McpErrorResponse, McpSuccessResponse } from '../types/responses.js';

export function success<T>(data: T): McpSuccessResponse<T> {
  return { ok: true, data };
}

export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): McpErrorResponse {
  return {
    ok: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
}

export function isErrorResponse(
  response: McpSuccessResponse<unknown> | McpErrorResponse,
): response is McpErrorResponse {
  return !response.ok;
}
