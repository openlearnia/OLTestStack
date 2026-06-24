import { describe, expect, test } from 'bun:test';
import { sessionGetSchema } from '../../src/domain/recording/session-get.js';

describe('session_get schema', () => {
  test('requires reportId or sessionId', () => {
    expect(sessionGetSchema.safeParse({}).success).toBe(false);
    expect(sessionGetSchema.safeParse({ reportId: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(
      true,
    );
    expect(sessionGetSchema.safeParse({ sessionId: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(
      true,
    );
  });
});

describe('session_get handler', () => {
  test('returns error without DATABASE_URL', async () => {
    const { getPersistedSession } = await import('../../src/domain/recording/session-get.js');
    const { SessionRegistry } = await import('../../src/core/registry/session-registry.js');
    const { InMemoryRecordingService } = await import('../../src/core/recording/in-memory-recording.js');

    const result = await getPersistedSession(
      {
        registry: new SessionRegistry(),
        recording: new InMemoryRecordingService(),
        config: {},
      } as never,
      { reportId: '550e8400-e29b-41d4-a716-446655440000' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
    }
  });
});
