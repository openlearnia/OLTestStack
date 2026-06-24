import { describe, expect, test } from 'bun:test';
import type { AppContext } from '../../src/core/context.js';
import { InMemoryRecordingService } from '../../src/core/recording/in-memory-recording.js';
import { SessionRegistry } from '../../src/core/registry/session-registry.js';
import type { Element, RecordedEvent } from '../../src/core/types/sessions.js';
import { eventsToScript } from '../../src/domain/recording/events-to-script.js';

function createTestContext(elements: Map<string, Element> = new Map()): AppContext {
  const registry = new SessionRegistry();
  const recording = new InMemoryRecordingService();

  return {
    registry: {
      ...registry,
      getElement: async (pageId: string, elementId: string) => elements.get(`${pageId}:${elementId}`),
    } as AppContext['registry'],
    recording,
  } as AppContext;
}

describe('eventsToScript', () => {
  test('maps navigation, actions, and assertions to steps', async () => {
    const pageId = '11111111-1111-4111-8111-111111111111';
    const elementId = '22222222-2222-4222-8222-222222222222';
    const elements = new Map<string, Element>([
      [
        `${pageId}:${elementId}`,
        {
          elementId,
          role: 'button',
          text: 'Sign In',
          visible: true,
        },
      ],
    ]);

    const ctx = createTestContext(elements);
    const events: RecordedEvent[] = [
      {
        timestamp: '2026-06-21T10:00:00.000Z',
        type: 'navigation',
        pageId,
        payload: { url: 'https://example.com/login', title: 'Login', action: 'navigate' },
      },
      {
        timestamp: '2026-06-21T10:00:01.000Z',
        type: 'action',
        pageId,
        payload: { action: 'type', elementId, value: 'user@example.com' },
      },
      {
        timestamp: '2026-06-21T10:00:02.000Z',
        type: 'action',
        pageId,
        payload: { action: 'click', elementId },
      },
      {
        timestamp: '2026-06-21T10:00:03.000Z',
        type: 'assertion',
        pageId,
        payload: {
          passed: true,
          assertion: 'url',
          message: 'URL contains /dashboard',
          url: '/dashboard',
          match: 'contains',
        },
      },
      {
        timestamp: '2026-06-21T10:00:04.000Z',
        type: 'console',
        pageId,
        payload: { message: 'ignored' },
      },
    ];

    const script = await eventsToScript(ctx, events, {
      name: 'Login flow',
      goal: 'Verify login',
    });

    expect(script.version).toBe('1.0');
    expect(script.url).toBe('https://example.com/login');
    expect(script.steps).toEqual([
      { action: 'wait', condition: 'networkIdle' },
      { action: 'type', query: 'Sign In', value: 'user@example.com' },
      { action: 'click', query: 'Sign In' },
      { action: 'wait', condition: 'timeout', durationMs: 1000 },
      { action: 'assert.url', url: '/dashboard', match: 'contains' },
    ]);
  });

  test('prefers payload.query over registry lookup', async () => {
    const pageId = '11111111-1111-4111-8111-111111111111';
    const elementId = '22222222-2222-4222-8222-222222222222';
    const elements = new Map<string, Element>([
      [
        `${pageId}:${elementId}`,
        {
          elementId,
          role: 'button',
          text: 'Wrong Label',
          visible: true,
        },
      ],
    ]);

    const ctx = createTestContext(elements);
    const events: RecordedEvent[] = [
      {
        timestamp: '2026-06-21T10:00:00.000Z',
        type: 'action',
        pageId,
        payload: { action: 'click', elementId, query: 'Sign In' },
      },
    ];

    const script = await eventsToScript(ctx, events, { name: 'Recorded flow' });

    expect(script.steps).toEqual([{ action: 'click', query: 'Sign In' }]);
    expect(script.exportWarnings).toBeUndefined();
  });

  test('warns and skips unresolvable click actions', async () => {
    const pageId = '11111111-1111-4111-8111-111111111111';
    const ctx = createTestContext();
    const events: RecordedEvent[] = [
      {
        timestamp: '2026-06-21T10:00:00.000Z',
        type: 'action',
        pageId,
        payload: { action: 'click', elementId: 'missing-id' },
      },
    ];

    const script = await eventsToScript(ctx, events, { name: 'Broken flow' });

    expect(script.steps).toEqual([]);
    expect(script.exportWarnings?.length).toBe(1);
  });

  test('inserts networkIdle wait after navigate when gap exceeds threshold', async () => {
    const pageId = '11111111-1111-4111-8111-111111111111';
    const ctx = createTestContext();
    const events: RecordedEvent[] = [
      {
        timestamp: '2026-06-21T10:00:00.000Z',
        type: 'navigation',
        pageId,
        payload: { url: 'https://example.com/login', title: 'Login', action: 'navigate' },
      },
      {
        timestamp: '2026-06-21T10:00:01.500Z',
        type: 'action',
        pageId,
        payload: { action: 'type', query: 'Email', value: 'user@example.com' },
      },
    ];

    const script = await eventsToScript(ctx, events, { name: 'Timed flow' });

    expect(script.steps).toEqual([
      { action: 'wait', condition: 'networkIdle' },
      { action: 'type', query: 'Email', value: 'user@example.com' },
    ]);
  });

  test('inserts capped timeout wait after click when gap exceeds threshold', async () => {
    const pageId = '11111111-1111-4111-8111-111111111111';
    const ctx = createTestContext();
    const events: RecordedEvent[] = [
      {
        timestamp: '2026-06-21T10:00:00.000Z',
        type: 'action',
        pageId,
        payload: { action: 'click', query: 'Submit' },
      },
      {
        timestamp: '2026-06-21T10:00:08.000Z',
        type: 'assertion',
        pageId,
        payload: { passed: true, assertion: 'url', url: '/done', match: 'contains' },
      },
    ];

    const script = await eventsToScript(ctx, events, { name: 'Slow click flow' });

    expect(script.steps).toEqual([
      { action: 'click', query: 'Submit' },
      { action: 'wait', condition: 'timeout', durationMs: 5000 },
      { action: 'assert.url', url: '/done', match: 'contains' },
    ]);
  });

  test('skips wait insertion when gap is within threshold', async () => {
    const pageId = '11111111-1111-4111-8111-111111111111';
    const ctx = createTestContext();
    const events: RecordedEvent[] = [
      {
        timestamp: '2026-06-21T10:00:00.000Z',
        type: 'action',
        pageId,
        payload: { action: 'click', query: 'Next' },
      },
      {
        timestamp: '2026-06-21T10:00:00.200Z',
        type: 'action',
        pageId,
        payload: { action: 'type', query: 'Name', value: 'Ada' },
      },
    ];

    const script = await eventsToScript(ctx, events, { name: 'Fast flow' });

    expect(script.steps).toEqual([
      { action: 'click', query: 'Next' },
      { action: 'type', query: 'Name', value: 'Ada' },
    ]);
  });
});
