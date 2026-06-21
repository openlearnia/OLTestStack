import type { AppContext } from '../core/context.js';
import { closeBrowser } from '../domain/browser/close-browser.js';
import { launchBrowser } from '../domain/browser/launch-browser.js';
import { clickElement } from '../domain/actions/click.js';
import { pressKey } from '../domain/actions/press.js';
import { scrollPage } from '../domain/actions/scroll.js';
import { typeIntoElement } from '../domain/actions/type.js';
import { findElement } from '../domain/elements/find-element.js';
import { listElements } from '../domain/elements/list-elements.js';
import { captureScreenshot } from '../domain/inspection/screenshot.js';
import { captureSnapshot } from '../domain/inspection/snapshot.js';
import { extractHtml } from '../domain/inspection/html.js';
import { extractText } from '../domain/inspection/text.js';
import { queryConsole } from '../domain/monitoring/console-query.js';
import { queryNetwork } from '../domain/monitoring/network-query.js';
import { closePage } from '../domain/page/close-page.js';
import { createPage } from '../domain/page/create-page.js';
import { navigatePage } from '../domain/page/navigate-page.js';
import { reloadPage } from '../domain/page/reload-page.js';
import { waitForCondition } from '../domain/waiting/wait.js';
import { ToolRegistry } from './registry.js';
import {
  browserCloseSchema,
  browserLaunchSchema,
  pageClickSchema,
  pageCloseSchema,
  pageConsoleSchema,
  pageCreateSchema,
  pageElementsSchema,
  pageFindSchema,
  pageHtmlSchema,
  pageNavigateSchema,
  pageNetworkSchema,
  pagePressSchema,
  pageReloadSchema,
  pageScreenshotSchema,
  pageScrollSchema,
  pageSnapshotSchema,
  pageTextSchema,
  pageTypeSchema,
  pageWaitSchema,
} from './schemas/tools.js';

export function registerTools(ctx: AppContext): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: 'browser.launch',
    description:
      'Launch a new Chromium browser instance. Returns a browserId to use with page.create and other commands. Example: {} for default headless session, or { "headless": false } for a visible window.',
    inputSchema: browserLaunchSchema as unknown as Record<string, unknown>,
    handler: (input) => launchBrowser(ctx, input),
  });

  registry.register({
    name: 'browser.close',
    description:
      'Close a browser and all its pages. Always call this when finished to avoid orphan processes. Example: { "browserId": "..." }.',
    inputSchema: browserCloseSchema as unknown as Record<string, unknown>,
    handler: (input) => closeBrowser(ctx, input),
  });

  registry.register({
    name: 'page.create',
    description:
      'Create a new page (tab) in an existing browser. Returns a pageId for navigation and interaction. Example: { "browserId": "..." }.',
    inputSchema: pageCreateSchema as unknown as Record<string, unknown>,
    handler: (input) => createPage(ctx, input),
  });

  registry.register({
    name: 'page.navigate',
    description:
      'Navigate a page to a URL. Waits for load by default. Invalidates previously discovered elements — call page.elements after navigation. Example: { "pageId": "...", "url": "https://example.com" }.',
    inputSchema: pageNavigateSchema as unknown as Record<string, unknown>,
    handler: (input) => navigatePage(ctx, input),
  });

  registry.register({
    name: 'page.reload',
    description:
      'Reload the current page. Invalidates all previously discovered elements — call page.elements after reload. Example: { "pageId": "..." }.',
    inputSchema: pageReloadSchema as unknown as Record<string, unknown>,
    handler: (input) => reloadPage(ctx, input),
  });

  registry.register({
    name: 'page.close',
    description:
      'Close a page/tab. The browser remains open if other pages exist. Example: { "pageId": "..." }.',
    inputSchema: pageCloseSchema as unknown as Record<string, unknown>,
    handler: (input) => closePage(ctx, input),
  });

  registry.register({
    name: 'page.elements',
    description:
      'List visible interactive elements on the page. Use this to understand what can be clicked or typed into. Example: { "pageId": "..." }.',
    inputSchema: pageElementsSchema as unknown as Record<string, unknown>,
    handler: (input) => listElements(ctx, input),
  });

  registry.register({
    name: 'page.find',
    description:
      'Find a single interactive element by text query (matches visible text, role, or aria-label). Example: { "pageId": "...", "query": "Submit" }.',
    inputSchema: pageFindSchema as unknown as Record<string, unknown>,
    handler: (input) => findElement(ctx, input),
  });

  registry.register({
    name: 'page.click',
    description:
      'Click an interactive element by elementId. Scrolls into view and waits for the element to be actionable. Example: { "pageId": "...", "elementId": "..." }.',
    inputSchema: pageClickSchema as unknown as Record<string, unknown>,
    handler: (input) => clickElement(ctx, input),
  });

  registry.register({
    name: 'page.type',
    description:
      'Type text into an input or textarea element. Clears existing value unless append is true. Example: { "pageId": "...", "elementId": "...", "value": "hello" }.',
    inputSchema: pageTypeSchema as unknown as Record<string, unknown>,
    handler: (input) => typeIntoElement(ctx, input),
  });

  registry.register({
    name: 'page.press',
    description:
      'Press a keyboard key on the page (Enter, Tab, Escape, arrows, modifier combos). Example: { "pageId": "...", "key": "Enter" }.',
    inputSchema: pagePressSchema as unknown as Record<string, unknown>,
    handler: (input) => pressKey(ctx, input),
  });

  registry.register({
    name: 'page.scroll',
    description:
      'Scroll the page in a direction (up, down, left, right). Default amount is one viewport height/width. Example: { "pageId": "...", "direction": "down" }.',
    inputSchema: pageScrollSchema as unknown as Record<string, unknown>,
    handler: (input) => scrollPage(ctx, input),
  });

  registry.register({
    name: 'page.screenshot',
    description:
      'Capture a PNG screenshot of the page viewport or full scrollable page. Saves to SCREENSHOT_DIR. Example: { "pageId": "..." }.',
    inputSchema: pageScreenshotSchema as unknown as Record<string, unknown>,
    handler: (input) => captureScreenshot(ctx, input),
  });

  registry.register({
    name: 'page.text',
    description:
      'Extract visible text content from the page (whitespace-normalized). Example: { "pageId": "..." }.',
    inputSchema: pageTextSchema as unknown as Record<string, unknown>,
    handler: (input) => extractText(ctx, input),
  });

  registry.register({
    name: 'page.html',
    description:
      'Extract the full outer HTML of the page document. Example: { "pageId": "..." }.',
    inputSchema: pageHtmlSchema as unknown as Record<string, unknown>,
    handler: (input) => extractHtml(ctx, input),
  });

  registry.register({
    name: 'page.snapshot',
    description:
      'Get a comprehensive page snapshot: URL, title, DOM summary, and interactive elements. Example: { "pageId": "..." }.',
    inputSchema: pageSnapshotSchema as unknown as Record<string, unknown>,
    handler: (input) => captureSnapshot(ctx, input),
  });

  registry.register({
    name: 'page.network',
    description:
      'Return captured network requests for the page. Supports optional URL filter and since timestamp. Example: { "pageId": "...", "filter": "/api/" }.',
    inputSchema: pageNetworkSchema as unknown as Record<string, unknown>,
    handler: (input) => queryNetwork(ctx, input),
  });

  registry.register({
    name: 'page.console',
    description:
      'Return captured browser console messages (logs, warnings, errors). Example: { "pageId": "...", "level": "error" }.',
    inputSchema: pageConsoleSchema as unknown as Record<string, unknown>,
    handler: (input) => queryConsole(ctx, input),
  });

  registry.register({
    name: 'page.wait',
    description:
      'Wait for a condition: element appearance, URL match, network idle, or fixed timeout. Example: { "pageId": "...", "condition": "element", "query": "Submit" }.',
    inputSchema: pageWaitSchema as unknown as Record<string, unknown>,
    handler: (input) => waitForCondition(ctx, input),
  });

  return registry;
}
