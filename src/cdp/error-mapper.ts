import type { ErrorCode } from '../core/errors/codes.js';
import { CdpError } from './adapter.js';

export function mapCdpError(error: unknown, operation: string): { code: ErrorCode; message: string; details?: Record<string, unknown> } {
  if (error instanceof CdpError) {
    return mapCdpErrorInstance(error);
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('timeout') || message.includes('Timeout')) {
    return {
      code: 'TIMEOUT',
      message: `${operation} timed out: ${message}`,
      details: { operation },
    };
  }

  if (message.includes('Target closed') || message.includes('Session closed')) {
    return {
      code: 'BROWSER_CRASHED',
      message: `Browser disconnected during ${operation}. Call browser.launch to start a new session.`,
      details: { operation },
    };
  }

  if (message.includes('net::ERR_') || message.includes('Navigation failed')) {
    return {
      code: 'NAVIGATION_FAILED',
      message: `Navigation failed: ${message}`,
      details: { operation },
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: `CDP ${operation} failed: ${message}`,
    details: { operation },
  };
}

function mapCdpErrorInstance(error: CdpError): { code: ErrorCode; message: string; details?: Record<string, unknown> } {
  const message = error.message;

  if (message.includes('timeout') || error.operation.includes('navigate') || error.operation.includes('reload')) {
    if (error.cdpMessage.includes('timeout')) {
      return { code: 'TIMEOUT', message, details: { operation: error.operation } };
    }
  }

  if (!error.recoverable) {
    return {
      code: 'BROWSER_CRASHED',
      message,
      details: { operation: error.operation, cdpMessage: error.cdpMessage },
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message,
    details: { operation: error.operation, cdpMessage: error.cdpMessage },
  };
}
