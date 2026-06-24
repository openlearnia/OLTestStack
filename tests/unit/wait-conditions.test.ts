import { describe, expect, test } from 'bun:test';
import type { NetworkEntry } from '../../src/cdp/adapter.ts';
import { filterNetworkEntries } from '../../src/domain/monitoring/network-query.ts';
import { filterConsoleEntries } from '../../src/domain/monitoring/console-query.ts';
import {
  isNetworkIdle,
  matchesUrl,
  NETWORK_IDLE_QUIET_MS,
} from '../../src/domain/waiting/conditions.ts';

describe('wait conditions', () => {
  test('matchesUrl contains and equals', () => {
    expect(matchesUrl('https://app.example.com/dashboard', '/dashboard')).toBe(true);
    expect(matchesUrl('https://app.example.com/dashboard', 'https://app.example.com/dashboard', 'equals')).toBe(
      true,
    );
    expect(matchesUrl('https://app.example.com/home', '/dashboard')).toBe(false);
  });

  test('isNetworkIdle requires zero in-flight and quiet period', () => {
    const now = 10_000;
    expect(isNetworkIdle(1, now - NETWORK_IDLE_QUIET_MS - 1, now)).toBe(false);
    expect(isNetworkIdle(0, now - NETWORK_IDLE_QUIET_MS, now)).toBe(true);
    expect(isNetworkIdle(0, now - 100, now)).toBe(false);
  });
});

describe('wait schema extensions', () => {
  test('waitSchema accepts elementHidden and networkRequest', async () => {
    const { waitSchema } = await import('../../src/domain/waiting/wait.js');
    expect(waitSchema.safeParse({
      pageId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      condition: 'elementHidden',
      query: 'Loading',
    }).success).toBe(true);
    expect(waitSchema.safeParse({
      pageId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      condition: 'networkRequest',
      value: '/api/users',
      status: 200,
    }).success).toBe(true);
  });
});

describe('network-query filters', () => {
  const entries: NetworkEntry[] = [
    {
      requestId: '1',
      url: 'https://example.com/api/users',
      method: 'GET',
      status: 200,
      resourceType: 'fetch',
      timestamp: '2026-06-21T10:00:00.000Z',
      failed: false,
    },
    {
      requestId: '2',
      url: 'https://example.com/static/app.js',
      method: 'GET',
      status: 200,
      resourceType: 'script',
      timestamp: '2026-06-21T10:00:05.000Z',
      failed: false,
    },
  ];

  test('filterNetworkEntries by URL substring', () => {
    const filtered = filterNetworkEntries(entries, { filter: '/api/' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.url).toContain('/api/');
  });

  test('filterNetworkEntries by since timestamp', () => {
    const filtered = filterNetworkEntries(entries, { since: '2026-06-21T10:00:03.000Z' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.requestId).toBe('2');
  });
});

describe('console-query filters', () => {
  test('filterConsoleEntries by level', () => {
    const messages = [
      { level: 'log' as const, message: 'info', timestamp: '2026-06-21T10:00:00.000Z' },
      { level: 'error' as const, message: 'boom', timestamp: '2026-06-21T10:00:01.000Z' },
    ];
    expect(filterConsoleEntries(messages, 'error')).toHaveLength(1);
    expect(filterConsoleEntries(messages, 'all')).toHaveLength(2);
  });
});
