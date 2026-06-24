import { describe, expect, test } from 'bun:test';
import { sessionListSchema } from '../../src/domain/recording/session-list.js';

describe('session_list schema', () => {
  test('applies defaults for page and limit', () => {
    const parsed = sessionListSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });

  test('accepts filters', () => {
    const parsed = sessionListSchema.parse({
      page: 2,
      limit: 50,
      status: 'failed',
      search: 'login',
      persistence: 'saved',
    });
    expect(parsed.status).toBe('failed');
    expect(parsed.persistence).toBe('saved');
  });
});

describe('session_list handler', () => {
  test('returns error without DATABASE_URL', async () => {
    const { listPersistedSessions } = await import('../../src/domain/recording/session-list.js');
    const { SessionRegistry } = await import('../../src/core/registry/session-registry.js');
    const { InMemoryRecordingService } = await import('../../src/core/recording/in-memory-recording.js');

    const result = await listPersistedSessions(
      {
        registry: new SessionRegistry(),
        recording: new InMemoryRecordingService(),
        config: {},
      } as never,
      { page: 1 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
    }
  });
});
