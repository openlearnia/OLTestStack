import { describe, expect, test } from 'bun:test';
import type { NetworkEntry } from '../../src/cdp/adapter.ts';
import {
  countPartialUrlMatches,
  findMatchingNetworkRequest,
  isValidNetworkStatusInput,
  matchesNetworkStatus,
  matchesText,
  textSnippet,
} from '../../src/domain/assertions/match-utils.ts';
import { generateReport } from '../../src/domain/recording/generate-report.ts';
import type { RecordedEvent } from '../../src/core/types/sessions.ts';

describe('assertion match-utils', () => {
  test('matchesText contains and equals', () => {
    expect(matchesText('Hello World', 'World')).toBe(true);
    expect(matchesText('Hello World', 'Hello World', 'equals')).toBe(true);
    expect(matchesText('Hello World', 'hello')).toBe(false);
  });

  test('textSnippet truncates long text', () => {
    const long = 'a'.repeat(250);
    const snippet = textSnippet(long, 200);
    expect(snippet.length).toBe(200);
    expect(snippet.endsWith('...')).toBe(true);
  });

  test('matchesNetworkStatus exact and range', () => {
    expect(matchesNetworkStatus(200, 200)).toBe(true);
    expect(matchesNetworkStatus(204, '2xx')).toBe(true);
    expect(matchesNetworkStatus(404, '2xx')).toBe(false);
    expect(matchesNetworkStatus(500, '5xx')).toBe(true);
  });

  test('isValidNetworkStatusInput', () => {
    expect(isValidNetworkStatusInput(200)).toBe(true);
    expect(isValidNetworkStatusInput('2xx')).toBe(true);
    expect(isValidNetworkStatusInput(99)).toBe(false);
    expect(isValidNetworkStatusInput('20x')).toBe(false);
  });

  test('findMatchingNetworkRequest', () => {
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
        url: 'https://example.com/api/error',
        method: 'POST',
        status: 500,
        resourceType: 'fetch',
        timestamp: '2026-06-21T10:00:01.000Z',
        failed: true,
      },
    ];

    const match = findMatchingNetworkRequest(entries, '/api/users', 200);
    expect(match?.url).toContain('/api/users');

    const rangeMatch = findMatchingNetworkRequest(entries, '/api/error', '5xx');
    expect(rangeMatch?.status).toBe(500);

    expect(countPartialUrlMatches(entries, '/api/')).toBe(2);
    expect(findMatchingNetworkRequest(entries, '/missing', 200)).toBeUndefined();
  });
});

describe('generateReport', () => {
  const events: RecordedEvent[] = [
    {
      timestamp: '2026-06-21T10:00:00.000Z',
      type: 'navigation',
      pageId: 'page-1',
      payload: { url: 'https://example.com', action: 'navigate' },
    },
    {
      timestamp: '2026-06-21T10:00:01.000Z',
      type: 'action',
      pageId: 'page-1',
      payload: { action: 'click', elementId: 'el-1' },
    },
    {
      timestamp: '2026-06-21T10:00:02.000Z',
      type: 'assertion',
      pageId: 'page-1',
      payload: { passed: true, assertion: 'url', message: 'URL contains /home' },
    },
    {
      timestamp: '2026-06-21T10:00:03.000Z',
      type: 'assertion',
      pageId: 'page-1',
      payload: {
        passed: false,
        assertion: 'text',
        message: 'Text not found',
        expected: { text: 'Welcome' },
        actual: { textSnippet: 'Goodbye' },
      },
    },
    {
      timestamp: '2026-06-21T10:00:04.000Z',
      type: 'screenshot',
      pageId: 'page-1',
      payload: { file: '/tmp/screenshot.png' },
    },
    {
      timestamp: '2026-06-21T10:00:05.000Z',
      type: 'network',
      pageId: 'page-1',
      payload: { url: 'https://example.com/api', status: 500, method: 'GET' },
    },
    {
      timestamp: '2026-06-21T10:00:06.000Z',
      type: 'console',
      pageId: 'page-1',
      payload: { level: 'error', message: 'Uncaught Error', source: 'app.js' },
    },
  ];

  test('derives failed status when assertion fails', () => {
    const report = generateReport(events, 'Login test');
    expect(report.status).toBe('failed');
    expect(report.testName).toBe('Login test');
    expect(report.actionsPerformed).toHaveLength(2);
    expect(report.assertionsPassed).toHaveLength(1);
    expect(report.assertionsFailed).toHaveLength(1);
    expect(report.assertionsFailed[0]?.expected).toEqual({ text: 'Welcome' });
    expect(report.screenshots).toEqual(['/tmp/screenshot.png']);
    expect(report.networkErrors).toHaveLength(1);
    expect(report.consoleErrors).toHaveLength(1);
    expect(report.executionTimeMs).toBe(6000);
  });

  test('derives passed status when all assertions pass', () => {
    const passing = events.filter(
      (event) => !(event.type === 'assertion' && event.payload.passed === false),
    );
    const report = generateReport(passing, 'Happy path');
    expect(report.status).toBe('passed');
  });

  test('derives error status on infrastructure error', () => {
    const report = generateReport(events, 'Error test', { errorOccurred: true });
    expect(report.status).toBe('error');
  });
});
