import { describe, expect, test } from 'bun:test';
import type { AppContext } from '../../src/core/context.js';
import { InMemoryRecordingService } from '../../src/core/recording/in-memory-recording.js';
import { SessionRegistry } from '../../src/core/registry/session-registry.js';
import { manageFrameContext, pageFrameSchema } from '../../src/domain/page/frame-context.js';
import type { FrameInfo } from '../../src/cdp/adapter.js';

const PAGE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BROWSER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const SAMPLE_FRAMES: FrameInfo[] = [
  { index: 0, url: 'https://example.com/', isMain: true },
  { index: 1, name: 'payment', url: 'https://pay.example.com/', isMain: false, parentIndex: 0 },
];

function createFrameContext(overrides: Partial<AppContext['cdp']> = {}): AppContext {
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
    url: 'https://example.com/',
    title: 'Example',
    createdAt: new Date().toISOString(),
  });

  return {
    registry,
    recording: new InMemoryRecordingService(),
    cdp: {
      listFrames: async () => SAMPLE_FRAMES,
      enterFrame: async () => SAMPLE_FRAMES[1]!,
      exitFrame: async () => undefined,
      ...overrides,
    },
    config: { defaultWaitTimeoutMs: 5000 },
  } as unknown as AppContext;
}

describe('page_frame schema', () => {
  test('requires action and pageId', () => {
    expect(pageFrameSchema.safeParse({ pageId: PAGE_ID, action: 'list' }).success).toBe(true);
    expect(pageFrameSchema.safeParse({ pageId: PAGE_ID, action: 'enter', frameIndex: 1 }).success).toBe(
      true,
    );
    expect(pageFrameSchema.safeParse({ pageId: PAGE_ID, action: 'enter' }).success).toBe(false);
  });
});

describe('page_frame handler', () => {
  test('lists frames', async () => {
    const ctx = createFrameContext();
    const result = await manageFrameContext(ctx, { pageId: PAGE_ID, action: 'list' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.action).toBe('list');
      expect(result.data.frames).toHaveLength(2);
    }
  });

  test('enters frame and invalidates elements', async () => {
    const ctx = createFrameContext();
    const result = await manageFrameContext(ctx, {
      pageId: PAGE_ID,
      action: 'enter',
      frameIndex: 1,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.action).toBe('enter');
      expect(result.data.activeFrameIndex).toBe(1);
    }
    const page = await ctx.registry.getPage(PAGE_ID);
    expect(page?.activeFrameIndex).toBe(1);
  });

  test('exits to main frame', async () => {
    const ctx = createFrameContext();
    await ctx.registry.updatePage(PAGE_ID, { activeFrameIndex: 1, activeFrameUrl: 'https://pay.example.com/' });
    const result = await manageFrameContext(ctx, { pageId: PAGE_ID, action: 'exit' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.activeFrameIndex).toBe(0);
    }
  });
});
