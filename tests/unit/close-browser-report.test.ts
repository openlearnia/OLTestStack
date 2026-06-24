import { describe, expect, mock, test } from 'bun:test';
import type { AppContext } from '../../src/core/context.js';
import { InMemoryRecordingService } from '../../src/core/recording/in-memory-recording.js';
import { SessionRegistry } from '../../src/core/registry/session-registry.js';

const BROWSER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REPORT_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockFlush = mock(async () => REPORT_ID);

mock.module('../../src/domain/recording/flush-recording.js', () => ({
  flushRecordingToDatabase: mockFlush,
}));

const { closeBrowser } = await import('../../src/domain/browser/close-browser.js');

function createCloseContext(): AppContext {
  const registry = new SessionRegistry();
  const recording = new InMemoryRecordingService();
  recording.initBrowser(BROWSER_ID, true);

  void registry.createBrowser({
    browserId: BROWSER_ID,
    createdAt: new Date().toISOString(),
    headless: true,
    recordingEnabled: true,
    pageIds: [],
  });

  return {
    registry,
    recording,
    cdp: {
      closeBrowser: async () => undefined,
    },
    config: { persistRecording: true },
  } as unknown as AppContext;
}

describe('browser_close reportId', () => {
  test('returns reportId when persistence flush succeeds', async () => {
    const ctx = createCloseContext();
    const result = await closeBrowser(ctx, { browserId: BROWSER_ID, testName: 'Demo' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.closed).toBe(true);
      expect(result.data.reportId).toBe(REPORT_ID);
    }
    expect(mockFlush).toHaveBeenCalledWith(ctx, BROWSER_ID, 'Demo');
  });
});
