import { describe, expect, test } from 'bun:test';
import { saveSessionSchema } from '../../src/domain/recording/save-session.js';
import { mapSessionPersistence } from '../../src/db/save-session-db.js';
import type { TestReportRow } from '../../src/db/schema.js';

describe('save_session', () => {
  test('schema requires reportId or sessionId', () => {
    expect(saveSessionSchema.safeParse({}).success).toBe(false);
    expect(saveSessionSchema.safeParse({ reportId: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(
      true,
    );
    expect(saveSessionSchema.safeParse({ sessionId: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(
      true,
    );
  });

  test('mapSessionPersistence reflects saved vs ephemeral', () => {
    const now = new Date('2026-06-22T12:00:00.000Z');
    const ephemeral: TestReportRow = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      browserId: null,
      testName: 'demo',
      status: 'passed',
      actionsPerformed: [],
      assertionsPassed: [],
      assertionsFailed: [],
      screenshots: [],
      networkErrors: [],
      consoleErrors: [],
      errors: [],
      executionTimeMs: 100,
      startedAt: now,
      completedAt: now,
      createdAt: now,
      saved: false,
      expiresAt: new Date('2026-06-22T20:00:00.000Z'),
      savedAt: null,
    };

    const mapped = mapSessionPersistence(ephemeral, now);
    expect(mapped.saved).toBe(false);
    expect(mapped.expiresInHours).toBe(8);
    expect(mapped.savedAt).toBeNull();

    const saved: TestReportRow = { ...ephemeral, saved: true, expiresAt: null, savedAt: now };
    const savedMapped = mapSessionPersistence(saved, now);
    expect(savedMapped.saved).toBe(true);
    expect(savedMapped.expiresAt).toBeNull();
    expect(savedMapped.expiresInHours).toBeNull();
  });
});
