import type { ConsoleMessage, HTTPRequest, HTTPResponse, Page } from 'puppeteer';
import {
  type ConsoleEntry,
  MAX_CONSOLE_ENTRIES,
  MAX_NETWORK_ENTRIES,
  type NetworkEntry,
} from './monitoring-types.js';

interface PendingRequest {
  requestId: string;
  url: string;
  method: string;
  resourceType: string;
  timestamp: string;
  startMs: number;
}

export class PageMonitoringBuffer {
  private readonly networkEntries: NetworkEntry[] = [];
  private readonly consoleEntries: ConsoleEntry[] = [];
  private readonly pending = new Map<HTTPRequest, PendingRequest>();
  private lastActivityMs = Date.now();
  private requestCounter = 0;

  constructor(
    private readonly hooks?: {
      onNetworkError?: (entry: NetworkEntry) => void;
      onConsoleError?: (entry: ConsoleEntry) => void;
    },
  ) {}

  attach(page: Page): void {
    page.on('request', (request: HTTPRequest) => {
      const requestId = `req-${++this.requestCounter}`;
      this.pending.set(request, {
        requestId,
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        timestamp: new Date().toISOString(),
        startMs: Date.now(),
      });
      this.touchActivity();
    });

    page.on('response', (response: HTTPResponse) => {
      const request = response.request();
      const pending = this.pending.get(request);
      const requestId = pending?.requestId ?? `req-${++this.requestCounter}`;
      const status = response.status();
      const failed = status === 0 || status >= 400;

      this.addNetworkEntry({
        requestId,
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        status,
        failed,
        timestamp: pending?.timestamp ?? new Date().toISOString(),
        durationMs: pending ? Date.now() - pending.startMs : undefined,
      });

      this.pending.delete(request);
      this.touchActivity();
    });

    page.on('requestfailed', (request: HTTPRequest) => {
      const pending = this.pending.get(request);
      const requestId = pending?.requestId ?? `req-${++this.requestCounter}`;

      this.addNetworkEntry({
        requestId,
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        status: 0,
        failed: true,
        timestamp: pending?.timestamp ?? new Date().toISOString(),
        durationMs: pending ? Date.now() - pending.startMs : undefined,
      });

      this.pending.delete(request);
      this.touchActivity();
    });

    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type();
      const level = mapConsoleLevel(type);
      const location = msg.location();
      const source =
        location.url && location.url !== ''
          ? `${location.url}:${location.lineNumber}`
          : undefined;

      this.addConsoleEntry({
        level,
        message: msg.text(),
        timestamp: new Date().toISOString(),
        ...(source ? { source } : {}),
      });
    });

    page.on('pageerror', (error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      this.addConsoleEntry({
        level: 'error',
        message: err.stack ?? err.message,
        timestamp: new Date().toISOString(),
      });
    });
  }

  getNetworkEntries(): NetworkEntry[] {
    return [...this.networkEntries];
  }

  getConsoleEntries(): ConsoleEntry[] {
    return [...this.consoleEntries];
  }

  getInFlightCount(): number {
    return this.pending.size;
  }

  getLastActivityMs(): number {
    return this.lastActivityMs;
  }

  private touchActivity(): void {
    this.lastActivityMs = Date.now();
  }

  private addNetworkEntry(entry: NetworkEntry): void {
    this.networkEntries.push(entry);
    while (this.networkEntries.length > MAX_NETWORK_ENTRIES) {
      this.networkEntries.shift();
    }
    if (entry.failed) {
      this.hooks?.onNetworkError?.(entry);
    }
  }

  private addConsoleEntry(entry: ConsoleEntry): void {
    this.consoleEntries.push(entry);
    while (this.consoleEntries.length > MAX_CONSOLE_ENTRIES) {
      this.consoleEntries.shift();
    }
    if (entry.level === 'error') {
      this.hooks?.onConsoleError?.(entry);
    }
  }
}

function mapConsoleLevel(type: string): ConsoleEntry['level'] {
  switch (type) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warn';
    case 'info':
      return 'info';
    case 'debug':
      return 'debug';
    default:
      return 'log';
  }
}
