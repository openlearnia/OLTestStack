import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAppContext } from '../../src/core/context.js';
import { isErrorResponse } from '../../src/core/errors/envelope.js';
import { clickElement } from '../../src/domain/actions/click.js';
import { pressKey } from '../../src/domain/actions/press.js';
import { scrollPage } from '../../src/domain/actions/scroll.js';
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

describeWithBrowser('action focus integration', () => {
  test('types into filter input without returning dataset select value', async () => {
    const root = resolve(import.meta.dir, '../..');
    const fixtureHtml = resolve(root, 'fixtures/sample-app/grid-toolbar.html');

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
      const nav = await navigatePage(ctx, { pageId, url: `file://${fixtureHtml}` });
      expect(isErrorResponse(nav)).toBe(false);
      if (isErrorResponse(nav)) return;

      const filterFound = await findElement(ctx, { pageId, query: 'Filter rows' });
      expect(isErrorResponse(filterFound)).toBe(false);
      if (isErrorResponse(filterFound)) return;

      const typeResult = await typeIntoElement(ctx, {
        pageId,
        elementId: filterFound.data.element.elementId,
        value: 'widget',
      });
      expect(isErrorResponse(typeResult)).toBe(false);
      if (isErrorResponse(typeResult)) return;

      expect(typeResult.data.value).toBe('widget');
      expect(typeResult.data.value).not.toBe('products');
    } finally {
      if (browserId) {
        await closeBrowser(ctx, { browserId });
      }
    }
  }, 60_000);

  test('press with elementId targets focused input', async () => {
    const root = resolve(import.meta.dir, '../..');
    const fixtureHtml = resolve(root, 'fixtures/sample-app/grid-toolbar.html');

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
      const nav = await navigatePage(ctx, { pageId, url: `file://${fixtureHtml}` });
      expect(isErrorResponse(nav)).toBe(false);
      if (isErrorResponse(nav)) return;

      const filterFound = await findElement(ctx, { pageId, query: 'Filter rows' });
      expect(isErrorResponse(filterFound)).toBe(false);
      if (isErrorResponse(filterFound)) return;

      const clickResult = await clickElement(ctx, {
        pageId,
        elementId: filterFound.data.element.elementId,
      });
      expect(isErrorResponse(clickResult)).toBe(false);
      if (isErrorResponse(clickResult)) return;

      const pressResult = await pressKey(ctx, {
        pageId,
        key: 'a',
        elementId: filterFound.data.element.elementId,
      });
      expect(isErrorResponse(pressResult)).toBe(false);
      if (isErrorResponse(pressResult)) return;

      const cdpPage = {
        id: pageId,
        browserId,
        targetId: pageId,
        url: `file://${fixtureHtml}`,
        title: 'Grid Toolbar Fixture',
      };
      const filterValue = await ctx.cdp.getVisibleText(cdpPage);
      expect(filterValue).toContain('a');

      const datasetFound = await findElement(ctx, { pageId, query: 'Dataset' });
      expect(isErrorResponse(datasetFound)).toBe(false);
      if (isErrorResponse(datasetFound)) return;

      const datasetType = await typeIntoElement(ctx, {
        pageId,
        elementId: datasetFound.data.element.elementId,
        value: 'should-not-happen',
      });
      expect(isErrorResponse(datasetType)).toBe(true);
    } finally {
      if (browserId) {
        await closeBrowser(ctx, { browserId });
      }
    }
  }, 60_000);

  test('scroll with elementId scrolls overflow container not window', async () => {
    const root = resolve(import.meta.dir, '../..');
    const fixtureHtml = resolve(root, 'fixtures/sample-app/grid-toolbar.html');

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
      const nav = await navigatePage(ctx, { pageId, url: `file://${fixtureHtml}` });
      expect(isErrorResponse(nav)).toBe(false);
      if (isErrorResponse(nav)) return;

      const viewportFound = await findElement(ctx, { pageId, query: 'scrollable grid body' });
      expect(isErrorResponse(viewportFound)).toBe(false);
      if (isErrorResponse(viewportFound)) return;

      const cdpPage = {
        id: pageId,
        browserId,
        targetId: pageId,
        url: `file://${fixtureHtml}`,
        title: 'Grid Toolbar Fixture',
      };

      const scrollTopBefore = await ctx.cdp.resolveElementHandle(
        cdpPage,
        (await ctx.registry.getElement(pageId, viewportFound.data.element.elementId))!.selector!,
      );
      expect(scrollTopBefore).not.toBeNull();
      if (!scrollTopBefore) return;

      const before = await scrollTopBefore.evaluate((el) => {
        const viewport = document.getElementById('viewport');
        return {
          container: viewport?.scrollTop ?? 0,
          window: window.scrollY,
        };
      });

      const scrollResult = await scrollPage(ctx, {
        pageId,
        direction: 'down',
        amount: 120,
        elementId: viewportFound.data.element.elementId,
      });
      expect(isErrorResponse(scrollResult)).toBe(false);
      if (isErrorResponse(scrollResult)) return;

      const after = await scrollTopBefore.evaluate(() => {
        const viewport = document.getElementById('viewport');
        return {
          container: viewport?.scrollTop ?? 0,
          window: window.scrollY,
        };
      });

      expect(scrollResult.data.scrolled).toBe(true);
      expect(scrollResult.data.amount).toBe(120);
      expect(after.container).toBeGreaterThan(before.container);
      expect(after.window).toBe(before.window);
    } finally {
      if (browserId) {
        await closeBrowser(ctx, { browserId });
      }
    }
  }, 60_000);

  test('find prefers filter input over column header for Name', async () => {
    const root = resolve(import.meta.dir, '../..');
    const fixtureHtml = resolve(root, 'fixtures/sample-app/grid-toolbar.html');

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
      const nav = await navigatePage(ctx, { pageId, url: `file://${fixtureHtml}` });
      expect(isErrorResponse(nav)).toBe(false);
      if (isErrorResponse(nav)) return;

      const nameFound = await findElement(ctx, { pageId, query: 'Name' });
      expect(isErrorResponse(nameFound)).toBe(false);
      if (isErrorResponse(nameFound)) return;

      expect(nameFound.data.matchCount).toBeGreaterThan(1);
      expect(nameFound.data.element.tag).toBe('input');
      expect(nameFound.data.element.role).toBe('textbox');
      expect(nameFound.data.selectedReason).toMatch(/input|toolbar|filter/);
      expect(nameFound.data.candidates?.length).toBeGreaterThan(1);
    } finally {
      if (browserId) {
        await closeBrowser(ctx, { browserId });
      }
    }
  }, 60_000);

  test('press after grid cell click targets focused cell', async () => {
    const root = resolve(import.meta.dir, '../..');
    const fixtureHtml = resolve(root, 'fixtures/sample-app/grid-toolbar.html');

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
      const nav = await navigatePage(ctx, { pageId, url: `file://${fixtureHtml}` });
      expect(isErrorResponse(nav)).toBe(false);
      if (isErrorResponse(nav)) return;

      const cellFound = await findElement(ctx, { pageId, query: 'Alice' });
      expect(isErrorResponse(cellFound)).toBe(false);
      if (isErrorResponse(cellFound)) return;

      const clickResult = await clickElement(ctx, {
        pageId,
        elementId: cellFound.data.element.elementId,
      });
      expect(isErrorResponse(clickResult)).toBe(false);
      if (isErrorResponse(clickResult)) return;

      const pressResult = await pressKey(ctx, {
        pageId,
        key: 'ArrowDown',
        elementId: cellFound.data.element.elementId,
      });
      expect(isErrorResponse(pressResult)).toBe(false);
      if (isErrorResponse(pressResult)) return;

      const cdpPage = {
        id: pageId,
        browserId,
        targetId: pageId,
        url: `file://${fixtureHtml}`,
        title: 'Grid Toolbar Fixture',
      };
      const html = await ctx.cdp.getOuterHtml(cdpPage);
      expect(html).toContain('data-last-grid-key="ArrowDown"');
      expect(html).toContain('data-selected="1"');
    } finally {
      if (browserId) {
        await closeBrowser(ctx, { browserId });
      }
    }
  }, 60_000);

  test('click fires onclick handler', async () => {
    const root = resolve(import.meta.dir, '../..');
    const fixtureHtml = resolve(root, 'fixtures/sample-app/grid-toolbar.html');

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
      const nav = await navigatePage(ctx, { pageId, url: `file://${fixtureHtml}` });
      expect(isErrorResponse(nav)).toBe(false);
      if (isErrorResponse(nav)) return;

      const toggleFound = await findElement(ctx, { pageId, query: 'Toggle dark mode' });
      expect(isErrorResponse(toggleFound)).toBe(false);
      if (isErrorResponse(toggleFound)) return;

      const clickResult = await clickElement(ctx, {
        pageId,
        elementId: toggleFound.data.element.elementId,
      });
      expect(isErrorResponse(clickResult)).toBe(false);
      if (isErrorResponse(clickResult)) return;

      const cdpPage = {
        id: pageId,
        browserId,
        targetId: pageId,
        url: `file://${fixtureHtml}`,
        title: 'Grid Toolbar Fixture',
      };
      const html = await ctx.cdp.getOuterHtml(cdpPage);
      expect(html).toContain('data-dark="1"');
    } finally {
      if (browserId) {
        await closeBrowser(ctx, { browserId });
      }
    }
  }, 60_000);
});
