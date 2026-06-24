import { describe, expect, mock, test } from 'bun:test';
import type { AppContext } from '../../src/core/context.js';
import { InMemoryRecordingService } from '../../src/core/recording/in-memory-recording.js';
import { SessionRegistry } from '../../src/core/registry/session-registry.js';
import type { RecordedEvent } from '../../src/core/types/sessions.js';

const REPORT_ID = '550e8400-e29b-41d4-a716-446655440000';
const BROWSER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PAGE_ID = '11111111-1111-4111-8111-111111111111';

const persistedEvents: RecordedEvent[] = [
  {
    timestamp: '2026-06-21T10:00:00.000Z',
    type: 'navigation',
    pageId: PAGE_ID,
    payload: { url: 'https://example.com/login', title: 'Login', action: 'navigate' },
  },
  {
    timestamp: '2026-06-21T10:00:01.000Z',
    type: 'action',
    pageId: PAGE_ID,
    payload: { action: 'click', query: 'Sign In' },
  },
];

const mockLoadTestReportById = mock(async () => ({
  id: REPORT_ID,
  browserId: BROWSER_ID,
  testName: 'Failed login',
  status: 'failed' as const,
  actionsPerformed: [],
  assertionsPassed: [],
  assertionsFailed: [],
  screenshots: [],
  networkErrors: [],
  consoleErrors: [],
  errors: [],
  executionTimeMs: 1000,
  startedAt: new Date('2026-06-21T10:00:00.000Z'),
  completedAt: new Date('2026-06-21T10:00:01.000Z'),
  createdAt: new Date('2026-06-21T10:00:01.000Z'),
  saved: false,
  expiresAt: new Date('2026-06-22T10:00:01.000Z'),
  savedAt: null,
}));

const mockLoadRecordedEventsForReport = mock(async () => persistedEvents);

mock.module('../../src/db/client.js', () => ({
  getDb: () => ({}),
}));

mock.module('../../src/db/load-recorded-events.js', () => ({
  loadTestReportById: mockLoadTestReportById,
  loadRecordedEventsForReport: mockLoadRecordedEventsForReport,
  recordedEventRowToEvent: () => ({}),
}));

const { exportSessionFromDatabase } = await import('../../src/domain/recording/export-from-db.js');
const { exportSession } = await import('../../src/domain/recording/session-export.js');

function createTestContext(): AppContext {
  return {
    registry: new SessionRegistry(),
    recording: new InMemoryRecordingService(),
    config: {
      headless: true,
      defaultTimeoutMs: 30_000,
      defaultNavigationTimeoutMs: 30_000,
      defaultWaitTimeoutMs: 30_000,
      screenshotDir: './screenshots',
      persistRecording: true,
      sessionTtlHours: 24,
      autoSaveFailedSessions: false,
      dbPort: 5433,
      dashboardEnabled: false,
      mcpTransport: 'stdio',
      mcpHttpPort: 8082,
      mcpHttpHost: '127.0.0.1',
      databaseUrl: 'postgresql://oltest:oltest@localhost:5433/olteststack',
    },
  } as AppContext;
}

describe('exportSessionFromDatabase (mocked Postgres)', () => {
  test('rebuilds script from recorded_events with same shape as live export', async () => {
    const ctx = createTestContext();

    const result = await exportSessionFromDatabase(ctx, REPORT_ID, {
      goal: 'Replay failed login',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(mockLoadTestReportById).toHaveBeenCalled();
    expect(mockLoadRecordedEventsForReport).toHaveBeenCalledWith({}, REPORT_ID);
    expect(result.data.eventCount).toBe(2);
    expect(result.data.stepCount).toBeGreaterThan(0);
    expect(result.data.script.version).toBe('1.0');
    expect(result.data.script.name).toBe('Failed login');
    expect(result.data.script.goal).toBe('Replay failed login');
    expect(result.data.script.url).toBe('https://example.com/login');
    expect(result.data.script.steps.some((step) => step.action === 'click' && step.query === 'Sign In')).toBe(
      true,
    );
  });

  test('returns SESSION_NOT_FOUND when report is missing', async () => {
    mockLoadTestReportById.mockImplementationOnce(async () => undefined);
    const ctx = createTestContext();

    const result = await exportSessionFromDatabase(ctx, REPORT_ID, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('SESSION_NOT_FOUND');
  });

  test('returns INVALID_INPUT when no events were persisted', async () => {
    mockLoadRecordedEventsForReport.mockImplementationOnce(async () => []);
    const ctx = createTestContext();

    const result = await exportSessionFromDatabase(ctx, REPORT_ID, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_INPUT');
  });
});

describe('exportSession sessionId alias', () => {
  test('routes sessionId to database export path', async () => {
    const ctx = createTestContext();

    const result = await exportSession(ctx, {
      sessionId: REPORT_ID,
      name: 'Custom name',
      goal: 'Replay',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.script.name).toBe('Custom name');
    expect(result.data.script.goal).toBe('Replay');
  });
});
