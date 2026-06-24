import { describe, expect, test } from 'bun:test';
import type { AppContext } from '../../src/core/context.js';
import { SessionRegistry } from '../../src/core/registry/session-registry.js';
import { manageCookies, pageCookiesSchema } from '../../src/domain/browser/cookies.js';

const BROWSER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createCookiesContext(): AppContext {
  const registry = new SessionRegistry();
  void registry.createBrowser({
    browserId: BROWSER_ID,
    createdAt: new Date().toISOString(),
    headless: true,
    recordingEnabled: true,
    pageIds: [],
  });

  return {
    registry,
    recording: { isEnabled: () => false, getEvents: () => [], initBrowser: () => undefined, emit: () => undefined },
    cdp: {
      getCookies: async () => [{ name: 'session', value: 'abc', domain: '.example.com' }],
      setCookies: async () => undefined,
      clearCookies: async () => undefined,
    },
    config: {},
  } as unknown as AppContext;
}

describe('page_cookies schema', () => {
  test('validates get/set/clear', () => {
    expect(pageCookiesSchema.safeParse({ browserId: BROWSER_ID, op: 'get' }).success).toBe(true);
    expect(
      pageCookiesSchema.safeParse({
        browserId: BROWSER_ID,
        op: 'set',
        cookies: [{ name: 'session', value: 'token' }],
      }).success,
    ).toBe(true);
    expect(pageCookiesSchema.safeParse({ browserId: BROWSER_ID, op: 'set' }).success).toBe(false);
  });
});

describe('page_cookies handler', () => {
  test('gets cookies', async () => {
    const ctx = createCookiesContext();
    const result = await manageCookies(ctx, { browserId: BROWSER_ID, op: 'get', urls: ['https://example.com'] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.op).toBe('get');
      expect(result.data.count).toBe(1);
    }
  });

  test('sets cookies', async () => {
    const ctx = createCookiesContext();
    const result = await manageCookies(ctx, {
      browserId: BROWSER_ID,
      op: 'set',
      cookies: [{ name: 'session', value: 'xyz' }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.set).toBe(1);
    }
  });
});
