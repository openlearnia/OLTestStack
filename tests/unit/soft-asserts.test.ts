import { describe, expect, test } from 'bun:test';
import { assertionFail } from '../../src/domain/assertions/result.js';
import { generateReport } from '../../src/domain/recording/generate-report.js';
import type { RecordedEvent } from '../../src/core/types/sessions.js';

const BROWSER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAGE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('soft asserts', () => {
  test('assertionFail with soft returns ok:true', () => {
    const ctx = {
      recording: { isEnabled: () => false, emit: () => undefined },
    } as never;

    const result = assertionFail(
      ctx,
      BROWSER_ID,
      PAGE_ID,
      'text',
      'soft miss',
      { text: 'x' },
      { text: 'y' },
      true,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.soft).toBe(true);
      expect(result.data.passed).toBe(false);
    }
  });

  test('generateReport separates softFailures from assertionsFailed', () => {
    const events: RecordedEvent[] = [
      {
        timestamp: '2026-06-21T10:00:00.000Z',
        type: 'assertion',
        pageId: PAGE_ID,
        payload: { passed: false, assertion: 'text', message: 'hard fail', soft: false },
      },
      {
        timestamp: '2026-06-21T10:00:01.000Z',
        type: 'assertion',
        pageId: PAGE_ID,
        payload: { passed: false, assertion: 'url', message: 'soft fail', soft: true },
      },
    ];

    const report = generateReport(events, 'soft test');
    expect(report.status).toBe('failed');
    expect(report.assertionsFailed).toHaveLength(1);
    expect(report.softFailures).toHaveLength(1);
    expect(report.softFailures[0]?.message).toBe('soft fail');
  });

  test('generateReport passes when only soft failures', () => {
    const events: RecordedEvent[] = [
      {
        timestamp: '2026-06-21T10:00:00.000Z',
        type: 'assertion',
        pageId: PAGE_ID,
        payload: { passed: false, assertion: 'text', message: 'soft only', soft: true },
      },
    ];

    const report = generateReport(events, 'soft only');
    expect(report.status).toBe('passed');
    expect(report.softFailures).toHaveLength(1);
    expect(report.assertionsFailed).toHaveLength(0);
  });
});
