import type { RecordedEvent } from '../../core/types/sessions.js';

export interface TestReport {
  testName: string;
  status: 'passed' | 'failed' | 'error';
  startedAt: string;
  completedAt: string;
  executionTimeMs: number;
  actionsPerformed: RecordedEvent[];
  assertionsPassed: Array<{
    assertion: string;
    message: string;
    timestamp: string;
  }>;
  assertionsFailed: Array<{
    assertion: string;
    message: string;
    expected: unknown;
    actual: unknown;
    timestamp: string;
  }>;
  softFailures: Array<{
    assertion: string;
    message: string;
    expected?: unknown;
    actual?: unknown;
    timestamp: string;
  }>;
  screenshots: string[];
  networkErrors: Array<{
    url: string;
    status: number;
    method: string;
    timestamp: string;
  }>;
  consoleErrors: Array<{
    message: string;
    source?: string;
    timestamp: string;
  }>;
}

function screenshotPath(event: RecordedEvent): string | undefined {
  const file = event.payload.file ?? event.payload.path;
  return typeof file === 'string' && file.length > 0 ? file : undefined;
}

function deriveStatus(events: RecordedEvent[], errorOccurred: boolean): TestReport['status'] {
  if (errorOccurred || events.some((event) => event.type === 'error')) {
    return 'error';
  }
  if (events.some((event) => event.type === 'assertion' && event.payload.passed === false && !event.payload.soft)) {
    return 'failed';
  }
  return 'passed';
}

export function generateReport(
  events: RecordedEvent[],
  testName: string,
  options?: { errorOccurred?: boolean },
): TestReport {
  const startedAt = events[0]?.timestamp ?? new Date().toISOString();
  const completedAt = events.at(-1)?.timestamp ?? startedAt;
  const executionTimeMs = Math.max(
    0,
    new Date(completedAt).getTime() - new Date(startedAt).getTime(),
  );

  const assertionsPassed = events
    .filter((event) => event.type === 'assertion' && event.payload.passed === true)
    .map((event) => ({
      assertion: String(event.payload.assertion ?? 'unknown'),
      message: String(event.payload.message ?? ''),
      timestamp: event.timestamp,
    }));

  const assertionsFailed = events
    .filter((event) => event.type === 'assertion' && event.payload.passed === false && !event.payload.soft)
    .map((event) => ({
      assertion: String(event.payload.assertion ?? 'unknown'),
      message: String(event.payload.message ?? ''),
      expected: event.payload.expected,
      actual: event.payload.actual,
      timestamp: event.timestamp,
    }));

  const softFailures = events
    .filter((event) => event.type === 'assertion' && event.payload.passed === false && event.payload.soft === true)
    .map((event) => ({
      assertion: String(event.payload.assertion ?? 'unknown'),
      message: String(event.payload.message ?? ''),
      expected: event.payload.expected,
      actual: event.payload.actual,
      timestamp: event.timestamp,
    }));

  const networkErrors = events
    .filter((event) => event.type === 'network')
    .map((event) => ({
      url: String(event.payload.url ?? ''),
      status: Number(event.payload.status ?? 0),
      method: String(event.payload.method ?? 'GET'),
      timestamp: event.timestamp,
    }))
    .filter((entry) => entry.status === 0 || entry.status >= 400);

  const consoleErrors = events
    .filter((event) => event.type === 'console')
    .map((event) => ({
      message: String(event.payload.message ?? ''),
      source: typeof event.payload.source === 'string' ? event.payload.source : undefined,
      timestamp: event.timestamp,
    }));

  return {
    testName,
    status: deriveStatus(events, options?.errorOccurred ?? false),
    startedAt,
    completedAt,
    executionTimeMs,
    actionsPerformed: events.filter(
      (event) => event.type === 'action' || event.type === 'navigation',
    ),
    assertionsPassed,
    assertionsFailed,
    softFailures,
    screenshots: events
      .filter((event) => event.type === 'screenshot')
      .map(screenshotPath)
      .filter((path): path is string => path !== undefined),
    networkErrors,
    consoleErrors,
  };
}
