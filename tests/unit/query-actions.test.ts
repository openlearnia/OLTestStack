import { describe, expect, test } from 'bun:test';
import type { AppContext } from '../../src/core/context.js';
import { InMemoryRecordingService } from '../../src/core/recording/in-memory-recording.js';
import { SessionRegistry } from '../../src/core/registry/session-registry.js';
import { clickByQuery } from '../../src/domain/actions/click-query.js';
import { typeByQuery } from '../../src/domain/actions/type-query.js';
import type { CdpNode } from '../../src/cdp/adapter.js';

const PAGE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BROWSER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createNodes(): CdpNode[] {
  return [
    {
      nodeId: 'node-button',
      role: 'button',
      name: 'Submit',
      visible: true,
      tagName: 'button',
    },
    {
      nodeId: 'node-input',
      role: 'textbox',
      name: 'Email',
      visible: true,
      tagName: 'input',
      regionHint: 'filter',
    },
  ];
}

function createQueryTestContext(nodes: CdpNode[] = createNodes()): AppContext {
  const registry = new SessionRegistry();
  const recording = new InMemoryRecordingService();

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
  recording.initBrowser(BROWSER_ID, true);

  return {
    registry,
    recording,
    cdp: {
      getAccessibilityTree: async () => nodes,
      clickElement: async () => undefined,
      typeElement: async (_page, _selector, value) => value,
    },
    config: { defaultWaitTimeoutMs: 5000 },
  } as unknown as AppContext;
}

describe('page_click_query', () => {
  test('finds and clicks atomically with query recorded', async () => {
    const ctx = createQueryTestContext();
    const result = await clickByQuery(ctx, { pageId: PAGE_ID, query: 'Submit' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.clicked).toBe(true);
      expect(result.data.query).toBe('Submit');
      expect(result.data.matchCount).toBeGreaterThan(0);
    }

    const events = ctx.recording.getEvents(BROWSER_ID);
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toMatchObject({ action: 'click', query: 'Submit' });
  });

  test('preferRole disambiguates among multiple matches', async () => {
    const ctx = createQueryTestContext([
      {
        nodeId: 'label',
        role: 'button',
        name: 'Name',
        visible: true,
        tagName: 'button',
      },
      {
        nodeId: 'input',
        role: 'textbox',
        name: 'Name',
        visible: true,
        tagName: 'input',
      },
    ]);
    const result = await clickByQuery(ctx, {
      pageId: PAGE_ID,
      query: 'Name',
      preferRole: 'button',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const element = await ctx.registry.getElement(PAGE_ID, result.data.elementId);
      expect(element?.role).toBe('button');
    }
  });

  test('candidateIndex out of range returns INVALID_INPUT', async () => {
    const ctx = createQueryTestContext([
      {
        nodeId: 'only',
        role: 'button',
        name: 'Go',
        visible: true,
        tagName: 'button',
      },
    ]);

    const result = await clickByQuery(ctx, {
      pageId: PAGE_ID,
      query: 'Go',
      candidateIndex: 2,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
      expect(result.error.details?.field).toBe('candidateIndex');
    }
  });
});

describe('page_type_query', () => {
  test('finds and types atomically with query recorded', async () => {
    const ctx = createQueryTestContext();
    const result = await typeByQuery(ctx, {
      pageId: PAGE_ID,
      query: 'Email',
      value: 'user@example.com',
      preferRegion: 'filter',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.typed).toBe(true);
      expect(result.data.value).toBe('user@example.com');
      expect(result.data.query).toBe('Email');
    }

    const events = ctx.recording.getEvents(BROWSER_ID);
    expect(events[0]?.payload).toMatchObject({
      action: 'type',
      query: 'Email',
      value: 'user@example.com',
    });
  });

  test('rejects non-typeable element', async () => {
    const ctx = createQueryTestContext([
      {
        nodeId: 'node-button',
        role: 'button',
        name: 'Submit',
        visible: true,
        tagName: 'button',
      },
    ]);

    const result = await typeByQuery(ctx, {
      pageId: PAGE_ID,
      query: 'Submit',
      value: 'hello',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });
});

describe('resolve-find-match disambiguation', () => {
  test('preferRegion boosts toolbar elements', async () => {
    const { resolveFindMatch } = await import('../../src/domain/elements/resolve-find-match.js');
    const nodes: CdpNode[] = [
      {
        nodeId: 'header',
        role: 'columnheader',
        name: 'Name',
        visible: true,
        tagName: 'div',
        regionHint: 'grid-header',
      },
      {
        nodeId: 'filter',
        role: 'textbox',
        name: 'Name',
        visible: true,
        tagName: 'input',
        regionHint: 'filter',
      },
    ];
    const ctx = createQueryTestContext(nodes);
    const found = await resolveFindMatch(ctx, PAGE_ID, 'Name', { preferRegion: 'filter' });

    expect('match' in found).toBe(true);
    if ('match' in found) {
      expect(found.match.element.tag).toBe('input');
      expect(found.match.selectedIndex).toBe(0);
    }
  });
});
