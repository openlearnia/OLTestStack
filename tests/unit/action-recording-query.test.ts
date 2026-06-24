import { describe, expect, test } from 'bun:test';
import type { AppContext } from '../../src/core/context.js';
import { InMemoryRecordingService } from '../../src/core/recording/in-memory-recording.js';
import { SessionRegistry } from '../../src/core/registry/session-registry.js';
import type { Element } from '../../src/core/types/sessions.js';
import { clickElement } from '../../src/domain/actions/click.js';

function createActionTestContext(element: Element): {
  ctx: AppContext;
  browserId: string;
  pageId: string;
} {
  const registry = new SessionRegistry();
  const recording = new InMemoryRecordingService();
  const browserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const pageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  return {
    browserId,
    pageId,
    ctx: {
      registry,
      recording,
      cdp: {
        clickElement: async () => undefined,
      },
      config: { defaultWaitTimeoutMs: 5000 },
    } as unknown as AppContext,
  };
}

describe('action recording query capture', () => {
  test('click emits discoveredQuery from registry element', async () => {
    const elementId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const element: Element = {
      elementId,
      role: 'textbox',
      text: 'Email address',
      visible: true,
      selector: 'node-1',
      discoveredQuery: 'Email',
    };

    const { ctx, browserId, pageId } = createActionTestContext(element);
    recordingInit(ctx, browserId);
    await ctx.registry.createBrowser({
      browserId,
      createdAt: new Date().toISOString(),
      headless: true,
      recordingEnabled: true,
      pageIds: [pageId],
    });
    await ctx.registry.createPage({
      pageId,
      browserId,
      url: 'https://example.com',
      title: 'Example',
      createdAt: new Date().toISOString(),
    });
    await ctx.registry.registerElement(pageId, element);

    const result = await clickElement(ctx, { pageId, elementId });
    expect(result.ok).toBe(true);

    const events = ctx.recording.getEvents(browserId);
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toEqual({
      action: 'click',
      elementId,
      query: 'Email',
    });
  });

  test('click prefers explicit query over discoveredQuery', async () => {
    const elementId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const element: Element = {
      elementId,
      role: 'button',
      text: 'Submit',
      visible: true,
      selector: 'node-2',
      discoveredQuery: 'Submit',
    };

    const { ctx, browserId, pageId } = createActionTestContext(element);
    recordingInit(ctx, browserId);
    await ctx.registry.createBrowser({
      browserId,
      createdAt: new Date().toISOString(),
      headless: true,
      recordingEnabled: true,
      pageIds: [pageId],
    });
    await ctx.registry.createPage({
      pageId,
      browserId,
      url: 'https://example.com',
      title: 'Example',
      createdAt: new Date().toISOString(),
    });
    await ctx.registry.registerElement(pageId, element);

    await clickElement(ctx, { pageId, elementId, query: 'Sign In' });

    const events = ctx.recording.getEvents(browserId);
    expect(events[0]?.payload.query).toBe('Sign In');
  });
});

function recordingInit(ctx: AppContext, browserId: string): void {
  ctx.recording.initBrowser(browserId, true);
}
