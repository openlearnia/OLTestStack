import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppContext } from '../../src/core/context.js';
import { sendReport, sendReportSchema } from '../../src/domain/debug/send-report.js';

describe('send_report', () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  test('schema requires browserId uuid', () => {
    expect(sendReportSchema.safeParse({}).success).toBe(false);
    expect(
      sendReportSchema.safeParse({ browserId: '550e8400-e29b-41d4-a716-446655440000' }).success,
    ).toBe(true);
    expect(
      sendReportSchema.safeParse({
        browserId: '550e8400-e29b-41d4-a716-446655440000',
        note: 'flaky submit',
      }).success,
    ).toBe(true);
  });

  test('returns SESSION_NOT_FOUND for missing browser', async () => {
    const ctx = createAppContext();
    const result = await sendReport(ctx, {
      browserId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('SESSION_NOT_FOUND');
  });

  test('debugId format and report shape', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'olteststack-send-report-'));
    const ctx = createAppContext({ screenshotDir: tempDir });
    const browserId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const pageId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

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
    ctx.recording.initBrowser(browserId, true);
    ctx.recording.emit(browserId, {
      type: 'navigation',
      pageId,
      payload: { url: 'https://example.com' },
    });

    const result = await sendReport(ctx, { browserId, note: 'unit test' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.debugId).toMatch(/^dbg_[0-9a-f-]{36}$/i);
    expect(result.data.browserId).toBe(browserId);
    expect(result.data.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.data.report.browserSession.browserId).toBe(browserId);
    expect(result.data.report.pages).toHaveLength(1);
    expect(result.data.report.pages[0]?.pageId).toBe(pageId);
    expect(result.data.report.events).toHaveLength(1);
    expect(result.data.report.eventCount).toBe(1);
    expect(result.data.report.registrySnapshot.pages).toHaveLength(1);
    expect(result.data.report.note).toBe('unit test');
    expect(result.data.reportFile).toContain(`${result.data.debugId}.json`);

    const fileContents = await readFile(result.data.reportFile!, 'utf8');
    const persisted = JSON.parse(fileContents) as { debugId: string };
    expect(persisted.debugId).toBe(result.data.debugId);
  });
});
