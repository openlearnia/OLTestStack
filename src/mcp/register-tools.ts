import type { AppContext } from '../core/context.js';
import { closeBrowser } from '../domain/browser/close-browser.js';
import { launchBrowser } from '../domain/browser/launch-browser.js';
import { clickByQuery } from '../domain/actions/click-query.js';
import { clickElement } from '../domain/actions/click.js';
import { typeByQuery } from '../domain/actions/type-query.js';
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
import { assertExists } from '../domain/assertions/exists.js';
import { assertNetwork } from '../domain/assertions/network.js';
import { assertText } from '../domain/assertions/text.js';
import { assertUrl } from '../domain/assertions/url.js';
import { runTest } from '../domain/test/run-test.js';
import { sendReport } from '../domain/debug/send-report.js';
import { exportSession } from '../domain/recording/session-export.js';
import { getPersistedSession } from '../domain/recording/session-get.js';
import { getSessionStatus } from '../domain/recording/session-status.js';
import { saveSession } from '../domain/recording/save-session.js';
import { waitForCondition } from '../domain/waiting/wait.js';
import { ToolRegistry } from './registry.js';
import {
  assertExistsSchema,
  assertNetworkSchema,
  assertTextSchema,
  assertUrlSchema,
  browserCloseSchema,
  browserLaunchSchema,
  pageClickSchema,
  pageClickQuerySchema,
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
  pageTypeQuerySchema,
  pageWaitSchema,
  sessionStatusSchema,
  sessionGetSchema,
  sessionExportSchema,
  saveSessionSchema,
  sendReportSchema,
  testRunSchema,
} from './schemas/tools.js';

export function registerTools(ctx: AppContext): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: 'browser_launch',
    description:
      'Launch a new Chromium browser instance. Returns a browserId to use with page_create and other commands. Example: {} for default headless session, or { "headless": false } for a visible window.',
    inputSchema: browserLaunchSchema as unknown as Record<string, unknown>,
    handler: (input) => launchBrowser(ctx, input),
  });

  registry.register({
    name: 'browser_close',
    description:
      'Close a browser and all its pages. Returns reportId when persistence is enabled. Always call this when finished. Example: { "browserId": "...", "testName": "Login regression" }.',
    inputSchema: browserCloseSchema as unknown as Record<string, unknown>,
    handler: (input) => closeBrowser(ctx, input),
  });

  registry.register({
    name: 'page_create',
    description:
      'Create a new page (tab) in an existing browser. Returns a pageId for navigation and interaction. Example: { "browserId": "..." }.',
    inputSchema: pageCreateSchema as unknown as Record<string, unknown>,
    handler: (input) => createPage(ctx, input),
  });

  registry.register({
    name: 'page_navigate',
    description:
      'Navigate a page to a URL. Waits for load by default. Invalidates previously discovered elements — call page_elements after navigation. Example: { "pageId": "...", "url": "https://example.com" }.',
    inputSchema: pageNavigateSchema as unknown as Record<string, unknown>,
    handler: (input) => navigatePage(ctx, input),
  });

  registry.register({
    name: 'page_reload',
    description:
      'Reload the current page. Invalidates all previously discovered elements — call page_elements after reload. Example: { "pageId": "..." }.',
    inputSchema: pageReloadSchema as unknown as Record<string, unknown>,
    handler: (input) => reloadPage(ctx, input),
  });

  registry.register({
    name: 'page_close',
    description:
      'Close a page/tab. The browser remains open if other pages exist. Example: { "pageId": "..." }.',
    inputSchema: pageCloseSchema as unknown as Record<string, unknown>,
    handler: (input) => closePage(ctx, input),
  });

  registry.register({
    name: 'page_elements',
    description:
      'List visible interactive elements on the page. Use this to understand what can be clicked or typed into. Example: { "pageId": "..." }.',
    inputSchema: pageElementsSchema as unknown as Record<string, unknown>,
    handler: (input) => listElements(ctx, input),
  });

  registry.register({
    name: 'page_find',
    description:
      'Find a single interactive element by text query (matches visible text, role, or aria-label). Example: { "pageId": "...", "query": "Submit" }.',
    inputSchema: pageFindSchema as unknown as Record<string, unknown>,
    handler: (input) => findElement(ctx, input),
  });

  registry.register({
    name: 'page_click',
    description:
      'Click an interactive element by elementId. Scrolls into view and waits for the element to be actionable. Pass optional query (from page_find) for replayable session_export scripts. Example: { "pageId": "...", "elementId": "...", "query": "Submit" }.',
    inputSchema: pageClickSchema as unknown as Record<string, unknown>,
    handler: (input) => clickElement(ctx, input),
  });

  registry.register({
    name: 'page_click_query',
    description:
      'Find and click an element atomically by text query. Records the query for replay. Supports preferRegion, preferRole, and candidateIndex for disambiguation. Example: { "pageId": "...", "query": "Submit", "preferRole": "button" }.',
    inputSchema: pageClickQuerySchema as unknown as Record<string, unknown>,
    handler: (input) => clickByQuery(ctx, input),
  });

  registry.register({
    name: 'page_type',
    description:
      'Type text into an input or textarea element. Clears existing value unless append is true. Pass optional query (from page_find) for replayable session_export scripts. Example: { "pageId": "...", "elementId": "...", "value": "hello", "query": "Email" }.',
    inputSchema: pageTypeSchema as unknown as Record<string, unknown>,
    handler: (input) => typeIntoElement(ctx, input),
  });

  registry.register({
    name: 'page_type_query',
    description:
      'Find and type into an element atomically by text query. Records the query for replay. Supports preferRegion, preferRole, and candidateIndex for disambiguation. Example: { "pageId": "...", "query": "Email", "value": "user@example.com" }.',
    inputSchema: pageTypeQuerySchema as unknown as Record<string, unknown>,
    handler: (input) => typeByQuery(ctx, input),
  });

  registry.register({
    name: 'page_press',
    description:
      'Press a keyboard key on the page (Enter, Tab, Escape, arrows, modifier combos). Optionally pass elementId to focus an element first. Example: { "pageId": "...", "key": "Enter", "elementId": "..." }.',
    inputSchema: pagePressSchema as unknown as Record<string, unknown>,
    handler: (input) => pressKey(ctx, input),
  });

  registry.register({
    name: 'page_scroll',
    description:
      'Scroll the page or a specific element (pass elementId) in a direction (up, down, left, right). Default amount is one viewport height/width. Example: { "pageId": "...", "direction": "down", "elementId": "..." }.',
    inputSchema: pageScrollSchema as unknown as Record<string, unknown>,
    handler: (input) => scrollPage(ctx, input),
  });

  registry.register({
    name: 'page_screenshot',
    description:
      'Capture a PNG screenshot of the page viewport or full scrollable page. Saves to SCREENSHOT_DIR. Example: { "pageId": "..." }.',
    inputSchema: pageScreenshotSchema as unknown as Record<string, unknown>,
    handler: (input) => captureScreenshot(ctx, input),
  });

  registry.register({
    name: 'page_text',
    description:
      'Extract visible text content from the page (whitespace-normalized). Example: { "pageId": "..." }.',
    inputSchema: pageTextSchema as unknown as Record<string, unknown>,
    handler: (input) => extractText(ctx, input),
  });

  registry.register({
    name: 'page_html',
    description:
      'Extract the full outer HTML of the page document. Example: { "pageId": "..." }.',
    inputSchema: pageHtmlSchema as unknown as Record<string, unknown>,
    handler: (input) => extractHtml(ctx, input),
  });

  registry.register({
    name: 'page_snapshot',
    description:
      'Get a comprehensive page snapshot: URL, title, DOM summary, and interactive elements. Example: { "pageId": "..." }.',
    inputSchema: pageSnapshotSchema as unknown as Record<string, unknown>,
    handler: (input) => captureSnapshot(ctx, input),
  });

  registry.register({
    name: 'page_network',
    description:
      'Return captured network requests for the page. Supports optional URL filter and since timestamp. Example: { "pageId": "...", "filter": "/api/" }.',
    inputSchema: pageNetworkSchema as unknown as Record<string, unknown>,
    handler: (input) => queryNetwork(ctx, input),
  });

  registry.register({
    name: 'page_console',
    description:
      'Return captured browser console messages (logs, warnings, errors). Example: { "pageId": "...", "level": "error" }.',
    inputSchema: pageConsoleSchema as unknown as Record<string, unknown>,
    handler: (input) => queryConsole(ctx, input),
  });

  registry.register({
    name: 'page_wait',
    description:
      'Wait for a condition: element, elementHidden, URL, network idle, network request, or fixed timeout. Example: { "pageId": "...", "condition": "networkRequest", "value": "/api/login" }.',
    inputSchema: pageWaitSchema as unknown as Record<string, unknown>,
    handler: (input) => waitForCondition(ctx, input),
  });

  registry.register({
    name: 'assert_exists',
    description:
      'Assert that an element matching a query exists and is visible, or that a known elementId is visible. Returns elementId on pass. Example: { "pageId": "...", "query": "Submit" }.',
    inputSchema: assertExistsSchema as unknown as Record<string, unknown>,
    handler: (input) => assertExists(ctx, input),
  });

  registry.register({
    name: 'assert_text',
    description:
      'Assert that visible page text contains or equals a string. Example: { "pageId": "...", "contains": "Welcome" }.',
    inputSchema: assertTextSchema as unknown as Record<string, unknown>,
    handler: (input) => assertText(ctx, input),
  });

  registry.register({
    name: 'assert_url',
    description:
      'Assert that the current page URL contains or equals an expected value. Example: { "pageId": "...", "url": "/dashboard" }.',
    inputSchema: assertUrlSchema as unknown as Record<string, unknown>,
    handler: (input) => assertUrl(ctx, input),
  });

  registry.register({
    name: 'assert_network',
    description:
      'Assert that a network request matching a URL substring occurred with the expected status (200 or 2xx). Example: { "pageId": "...", "url": "/api/users", "status": 200 }.',
    inputSchema: assertNetworkSchema as unknown as Record<string, unknown>,
    handler: (input) => assertNetwork(ctx, input),
  });

  registry.register({
    name: 'session_status',
    description:
      'Lightweight live session health check: alive/crashed, recording state, event count, and open pages. Example: { "browserId": "..." }.',
    inputSchema: sessionStatusSchema as unknown as Record<string, unknown>,
    handler: (input) => getSessionStatus(ctx, input),
  });

  registry.register({
    name: 'session_get',
    description:
      'Fetch a persisted session by reportId or sessionId. Wraps dashboard detail query (report + recorded events). Example: { "reportId": "550e8400-e29b-41d4-a716-446655440000" }.',
    inputSchema: sessionGetSchema as unknown as Record<string, unknown>,
    handler: (input) => getPersistedSession(ctx, input),
  });

  registry.register({
    name: 'session_export',
    description:
      'Export a browser session recording as a replayable .olteststack.json script. Pass browserId while the session is open, or reportId/sessionId after browser_close to rebuild from PostgreSQL recorded_events. Example: { "browserId": "...", "name": "Login flow" } or { "reportId": "550e8400-e29b-41d4-a716-446655440000" }.',
    inputSchema: sessionExportSchema as unknown as Record<string, unknown>,
    handler: (input) => exportSession(ctx, input),
  });

  registry.register({
    name: 'save_session',
    description:
      'Promote an ephemeral persisted session to saved (no TTL). Unsaved sessions auto-delete after SESSION_TTL_HOURS unless saved. Example: { "reportId": "550e8400-e29b-41d4-a716-446655440000" } or { "sessionId": "...", "name": "Login regression" }.',
    inputSchema: saveSessionSchema as unknown as Record<string, unknown>,
    handler: (input) => saveSession(ctx, input),
  });

  registry.register({
    name: 'send_report',
    description:
      'Dump full in-memory browser session state as a structured debug report with a unique debugId. Logs summary to stderr as [olteststack:debug] and writes JSON to SCREENSHOT_DIR/debug/. Example: { "browserId": "...", "note": "login failed after submit" }.',
    inputSchema: sendReportSchema as unknown as Record<string, unknown>,
    handler: (input) => sendReport(ctx, input),
  });

  registry.register({
    name: 'test_run',
    description:
      'Execute a complete browser test with explicit steps and return a structured TestReport. Provide goal plus steps, script, or scriptFile; goal-only returns agent-driven guidance. Example: { "goal": "Login flow", "url": "https://app.example.com/login", "steps": [...] } or { "goal": "Replay login", "scriptFile": "scripts/example-login.olteststack.json" }.',
    inputSchema: testRunSchema as unknown as Record<string, unknown>,
    handler: (input) => runTest(ctx, input),
  });

  return registry;
}
