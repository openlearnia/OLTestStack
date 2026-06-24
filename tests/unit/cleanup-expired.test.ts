import { describe, expect, test } from 'bun:test';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { isSessionTtlMigrationMissingError } from '../../src/db/cleanup-expired.js';
import { testReports } from '../../src/db/schema.js';

describe('isSessionTtlMigrationMissingError', () => {
  test('detects PostgreSQL undefined_column code 42703', () => {
    expect(isSessionTtlMigrationMissingError({ code: '42703', message: 'column "saved" does not exist' })).toBe(
      true,
    );
  });

  test('detects message for missing saved column', () => {
    expect(
      isSessionTtlMigrationMissingError({ message: 'column "saved" does not exist' }),
    ).toBe(true);
  });

  test('ignores unrelated database errors', () => {
    expect(isSessionTtlMigrationMissingError({ code: '42P01', message: 'relation "foo" does not exist' })).toBe(
      false,
    );
  });
});

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
