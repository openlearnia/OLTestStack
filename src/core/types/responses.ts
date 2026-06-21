export interface McpSuccessResponse<T> {
  ok: true;
  data: T;
}

export interface McpErrorResponse {
  ok: false;
  error: {
    code: import('../errors/codes.js').ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type McpResponse<T> = McpSuccessResponse<T> | McpErrorResponse;
