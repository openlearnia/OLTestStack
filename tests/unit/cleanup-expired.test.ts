import { describe, expect, test } from 'bun:test';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { testReports } from '../../src/db/schema.js';

describe('cleanup expired sessions query shape', () => {
  test('builds clause for unsaved rows past expires_at', () => {
    const now = new Date('2026-06-22T12:00:00.000Z');
    const clause = and(
      eq(testReports.saved, false),
      isNotNull(testReports.expiresAt),
      lt(testReports.expiresAt, now),
    );

    expect(clause).toBeDefined();
    expect(testReports.saved.name).toBe('saved');
    expect(testReports.expiresAt.name).toBe('expires_at');
  });
});
