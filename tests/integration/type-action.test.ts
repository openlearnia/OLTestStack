import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAppContext } from '../../src/core/context.js';
import { isErrorResponse } from '../../src/core/errors/envelope.js';
import { typeIntoElement } from '../../src/domain/actions/type.js';
import { findElement } from '../../src/domain/elements/find-element.js';
import { closeBrowser } from '../../src/domain/browser/close-browser.js';
import { launchBrowser } from '../../src/domain/browser/launch-browser.js';
import { createPage } from '../../src/domain/page/create-page.js';
import { navigatePage } from '../../src/domain/page/navigate-page.js';

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

describeWithBrowser('page_type integration', () => {
  test('types into distinct fields by elementId', async () => {
    const root = resolve(import.meta.dir, '../..');
    const sampleHtml = resolve(root, 'fixtures/sample-app/index.html');

    const ctx = createAppContext({
      chromiumExecutablePath: chromiumPath,
      headless: true,
    });

    let browserId: string | undefined;
    try {
      const launch = await launchBrowser(ctx, { headless: true });
      expect(isErrorResponse(launch)).toBe(false);
      if (isErrorResponse(launch)) return;

      browserId = launch.data.browserId;
      const page = await createPage(ctx, { browserId });
      expect(isErrorResponse(page)).toBe(false);
      if (isErrorResponse(page)) return;

      const pageId = page.data.pageId;
      const nav = await navigatePage(ctx, { pageId, url: `file://${sampleHtml}` });
      expect(isErrorResponse(nav)).toBe(false);
      if (isErrorResponse(nav)) return;

      const emailFound = await findElement(ctx, { pageId, query: 'Email' });
      const passwordFound = await findElement(ctx, { pageId, query: 'Password' });
      expect(isErrorResponse(emailFound)).toBe(false);
      expect(isErrorResponse(passwordFound)).toBe(false);
      if (isErrorResponse(emailFound) || isErrorResponse(passwordFound)) return;

      const emailType = await typeIntoElement(ctx, {
        pageId,
        elementId: emailFound.data.element.elementId,
        value: 'user@example.com',
      });
      const passwordType = await typeIntoElement(ctx, {
        pageId,
        elementId: passwordFound.data.element.elementId,
        value: 'secret',
      });
      expect(isErrorResponse(emailType)).toBe(false);
      expect(isErrorResponse(passwordType)).toBe(false);
      if (isErrorResponse(emailType) || isErrorResponse(passwordType)) return;

      expect(emailType.data.value).toBe('user@example.com');
      expect(passwordType.data.value).toBe('secret');

      const emailRecheck = await typeIntoElement(ctx, {
        pageId,
        elementId: emailFound.data.element.elementId,
        value: 'user@example.com',
        append: false,
      });
      expect(isErrorResponse(emailRecheck)).toBe(false);
      if (isErrorResponse(emailRecheck)) return;
      expect(emailRecheck.data.value).toBe('user@example.com');
    } finally {
      if (browserId) {
        await closeBrowser(ctx, { browserId });
      }
    }
  }, 60_000);
});
