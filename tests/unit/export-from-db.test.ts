import { describe, expect, test } from 'bun:test';
import type { AppContext } from '../../src/core/context.js';
import { InMemoryRecordingService } from '../../src/core/recording/in-memory-recording.js';
import { SessionRegistry } from '../../src/core/registry/session-registry.js';
import { recordedEventRowToEvent } from '../../src/db/load-recorded-events.js';
import type { RecordedEventRow } from '../../src/db/schema.js';
import { exportSessionFromDatabase } from '../../src/domain/recording/export-from-db.js';
import { sessionExportSchema } from '../../src/domain/recording/session-export.js';

function createTestContext(): AppContext {
  const registry = new SessionRegistry();
  const recording = new InMemoryRecordingService();

  return {
    registry,
    recording,
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

describe('recordedEventRowToEvent', () => {
  test('reconstructs RecordedEvent from persisted metadata', () => {
    const row: RecordedEventRow = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      reportId: '550e8400-e29b-41d4-a716-446655440000',
      browserId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      timestamp: new Date('2026-06-21T10:00:01.000Z'),
      action: 'click',
      target: 'Submit',
      pageId: '11111111-1111-4111-8111-111111111111',
      metadata: {
        type: 'action',
        action: 'click',
        query: 'Submit',
        elementId: '22222222-2222-4222-8222-222222222222',
      },
      createdAt: new Date('2026-06-21T10:00:01.000Z'),
    };

    const event = recordedEventRowToEvent(row);
    expect(event.type).toBe('action');
    expect(event.payload.action).toBe('click');
    expect(event.payload.query).toBe('Submit');
    expect(event.pageId).toBe(row.pageId);
    expect(event.timestamp).toBe('2026-06-21T10:00:01.000Z');
  });
});

describe('sessionExportSchema', () => {
  test('accepts browserId for live export', () => {
    expect(
      sessionExportSchema.safeParse({
        browserId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      }).success,
    ).toBe(true);
  });

  test('accepts reportId or sessionId for database export', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(sessionExportSchema.safeParse({ reportId: id }).success).toBe(true);
    expect(sessionExportSchema.safeParse({ sessionId: id }).success).toBe(true);
  });

  test('rejects missing identifiers and mixed live/db inputs', () => {
    expect(sessionExportSchema.safeParse({}).success).toBe(false);
    expect(
      sessionExportSchema.safeParse({
        browserId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        reportId: '550e8400-e29b-41d4-a716-446655440000',
      }).success,
    ).toBe(false);
  });
});

describe('exportSessionFromDatabase', () => {
  test('returns error when persistence is disabled', async () => {
    const ctx = createTestContext();
    ctx.config.persistRecording = false;

    const result = await exportSessionFromDatabase(ctx, '550e8400-e29b-41d4-a716-446655440000', {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
    }
  });
});
