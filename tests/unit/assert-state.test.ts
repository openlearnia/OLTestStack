import { describe, expect, test } from 'bun:test';
import type { AppContext } from '../../src/core/context.js';
import { InMemoryRecordingService } from '../../src/core/recording/in-memory-recording.js';
import { SessionRegistry } from '../../src/core/registry/session-registry.js';
import { assertPageState, assertStateSchema } from '../../src/domain/assertions/assert-state.js';

const PAGE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BROWSER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createAssertStateContext(): AppContext {
  const registry = new SessionRegistry();
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
    url: 'https://example.com/dashboard',
    title: 'Dashboard',
    createdAt: new Date().toISOString(),
  });

  return {
    registry,
    recording: new InMemoryRecordingService(),
    cdp: {
      getAccessibilityTree: async () => [
        {
          nodeId: 'btn-1',
          role: 'button',
          name: 'Submit',
          visible: true,
          tagName: 'button',
        },
      ],
      getVisibleText: async () => 'Welcome to the dashboard',
      getUrl: async () => 'https://example.com/dashboard',
      getNetworkEntries: () => [],
      getConsoleEntries: () => [],
    },
    config: { defaultWaitTimeoutMs: 5000 },
  } as unknown as AppContext;
}

describe('page_assert_state schema', () => {
  test('accepts composite checks', () => {
    expect(
      assertStateSchema.safeParse({
        pageId: PAGE_ID,
        checks: {
          exists: [{ query: 'Submit' }],
          url: { url: '/dashboard' },
          consoleErrorCount: { max: 0 },
        },
      }).success,
    ).toBe(true);
  });
});

describe('page_assert_state handler', () => {
  test('passes when all checks succeed', async () => {
    const ctx = createAssertStateContext();
    const result = await assertPageState(ctx, {
      pageId: PAGE_ID,
      checks: {
        exists: [{ query: 'Submit' }],
        text: [{ contains: 'Welcome' }],
        url: { url: '/dashboard' },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.passed).toBe(true);
      expect(result.data.checks.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('collects soft failures without hard fail', async () => {
    const ctx = createAssertStateContext();
    const result = await assertPageState(ctx, {
      pageId: PAGE_ID,
      checks: {
        text: [{ contains: 'Missing text', soft: true }],
        url: { url: '/missing', soft: true },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.passed).toBe(true);
      expect(result.data.softFailures.length).toBe(2);
    }
  });
});
