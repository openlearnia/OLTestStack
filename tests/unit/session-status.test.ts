import { describe, expect, test } from 'bun:test';
import type { AppContext } from '../../src/core/context.js';
import { InMemoryRecordingService } from '../../src/core/recording/in-memory-recording.js';
import { SessionRegistry } from '../../src/core/registry/session-registry.js';
import { getSessionStatus } from '../../src/domain/recording/session-status.js';

const BROWSER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAGE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function createStatusContext(): AppContext {
  const registry = new SessionRegistry();
  const recording = new InMemoryRecordingService();
  recording.initBrowser(BROWSER_ID, true);
  recording.emit(BROWSER_ID, {
    type: 'action',
    pageId: PAGE_ID,
    payload: { action: 'click' },
  });

  void registry.createBrowser({
    browserId: BROWSER_ID,
    createdAt: new Date().toISOString(),
    headless: true,
    recordingEnabled: true,
    pageIds: [PAGE_ID],
  });
  void registry.createPage({
    pageId: PAGE_ID,
    browserId: BROWSER_ID,
    url: 'https://example.com',
    title: 'Example',
    createdAt: new Date().toISOString(),
  });

  return {
    registry,
    recording,
    config: {},
  } as unknown as AppContext;
}

describe('session_status', () => {
  test('returns alive session with pages and event count', async () => {
    const ctx = createStatusContext();
    const result = await getSessionStatus(ctx, { browserId: BROWSER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.alive).toBe(true);
      expect(result.data.crashed).toBe(false);
      expect(result.data.recording).toBe(true);
      expect(result.data.eventCount).toBe(1);
      expect(result.data.pages).toHaveLength(1);
      expect(result.data.pages[0]?.url).toBe('https://example.com');
    }
  });

  test('returns SESSION_NOT_FOUND for unknown browser', async () => {
    const ctx = createStatusContext();
    const result = await getSessionStatus(ctx, {
      browserId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SESSION_NOT_FOUND');
    }
  });

  test('reports crashed browser', async () => {
    const ctx = createStatusContext();
    await ctx.registry.markBrowserCrashed(BROWSER_ID);
    const result = await getSessionStatus(ctx, { browserId: BROWSER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.alive).toBe(false);
      expect(result.data.crashed).toBe(true);
    }
  });
});
