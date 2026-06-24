import { describe, expect, test } from 'bun:test';
import type { AppContext } from '../../src/core/context.js';
import { InMemoryRecordingService } from '../../src/core/recording/in-memory-recording.js';
import { SessionRegistry } from '../../src/core/registry/session-registry.js';
import { selectOption, pageSelectSchema } from '../../src/domain/actions/select.js';
import type { CdpNode } from '../../src/cdp/adapter.js';

const PAGE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BROWSER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ELEMENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function createSelectContext(nodes: CdpNode[], selectedValue = 'us'): AppContext {
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
    url: 'https://example.com/form',
    title: 'Form',
    createdAt: new Date().toISOString(),
  });
  recording.initBrowser(BROWSER_ID, true);

  return {
    registry,
    recording,
    cdp: {
      getAccessibilityTree: async () => nodes,
      selectOption: async () => selectedValue,
    },
    config: { defaultWaitTimeoutMs: 5000 },
  } as unknown as AppContext;
}

describe('page_select schema', () => {
  test('requires elementId or query and value or label', () => {
    expect(pageSelectSchema.safeParse({ pageId: PAGE_ID, value: 'us' }).success).toBe(false);
    expect(
      pageSelectSchema.safeParse({
        pageId: PAGE_ID,
        query: 'Country',
        value: 'us',
      }).success,
    ).toBe(true);
    expect(
      pageSelectSchema.safeParse({
        pageId: PAGE_ID,
        elementId: ELEMENT_ID,
        label: 'United States',
      }).success,
    ).toBe(true);
  });
});

describe('page_select handler', () => {
  test('selects by query and records action', async () => {
    const ctx = createSelectContext([
      {
        nodeId: 'select-node',
        role: 'combobox',
        name: 'Country',
        visible: true,
        tagName: 'select',
      },
    ]);

    const result = await selectOption(ctx, {
      pageId: PAGE_ID,
      query: 'Country',
      value: 'us',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.selected).toBe(true);
      expect(result.data.value).toBe('us');
      expect(result.data.query).toBe('Country');
    }

    const events = ctx.recording.getEvents(BROWSER_ID);
    expect(events[0]?.payload).toMatchObject({ action: 'select', query: 'Country', value: 'us' });
  });

  test('rejects non-selectable element', async () => {
    const ctx = createSelectContext([
      {
        nodeId: 'button-node',
        role: 'button',
        name: 'Submit',
        visible: true,
        tagName: 'button',
      },
    ]);

    const result = await selectOption(ctx, {
      pageId: PAGE_ID,
      query: 'Submit',
      value: 'x',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });
});
