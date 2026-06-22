import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAppContext } from '../../src/core/context.js';
import { isErrorResponse } from '../../src/core/errors/envelope.js';
import { runTest } from '../../src/domain/test/run-test.js';

const CHROME_CANDIDATES = [
  process.env.CHROMIUM_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter((path): path is string => Boolean(path));

function resolveChromiumPath(): string | undefined {
  return CHROME_CANDIDATES.find((path) => existsSync(path));
}

const chromiumPath = resolveChromiumPath();
const describeWithBrowser = chromiumPath ? describe : describe.skip;

describeWithBrowser('test_run integration', () => {
  test('runs sample-app script via scriptFile and returns a report', async () => {
    const root = resolve(import.meta.dir, '../..');
    const scriptFile = resolve(root, 'fixtures/sample-app/login.olteststack.json');
    const sampleHtml = resolve(root, 'fixtures/sample-app/index.html');

    const ctx = createAppContext({
      chromiumExecutablePath: chromiumPath,
      headless: true,
    });

    const result = await runTest(ctx, {
      goal: 'Sample app login smoke',
      scriptFile,
      url: `file://${sampleHtml}`,
      headless: true,
      stopOnFailure: true,
      timeoutMs: 30_000,
    });

    expect(isErrorResponse(result)).toBe(false);
    if (isErrorResponse(result)) return;

    expect(result.data).toHaveProperty('report');
    const report = (result.data as {
      report: {
        status: string;
        testName: string;
        actionsPerformed: unknown[];
        assertionsPassed: unknown[];
      };
    }).report;
    expect(report.testName).toBe('Sample app login smoke');
    expect(['passed', 'failed']).toContain(report.status);
    expect(report.actionsPerformed.length).toBeGreaterThan(0);
    expect(report.assertionsPassed.length).toBeGreaterThan(0);
  }, 60_000);
});
