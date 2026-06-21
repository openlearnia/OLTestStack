import puppeteer, {
  type Browser,
  type ElementHandle,
  type Page,
  type PuppeteerLifeCycleEvent,
  type SerializedAXNode,
} from 'puppeteer';
import type { ResolvedConfig } from '../core/config/load-config.js';
import {
  type CdpAdapter,
  type CdpBrowser,
  type CdpNode,
  type CdpPage,
  type ConsoleEntry,
  CdpError,
  type LaunchOptions,
  type NavigateOptions,
  type NetworkEntry,
  type ScrollDirection,
  type TypeOptions,
  type MonitoringHooks,
} from './adapter.js';
import { PageMonitoringBuffer } from './page-monitoring.js';

const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'checkbox',
  'radio',
  'combobox',
  'listbox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'treeitem',
]);

const INTERACTIVE_TAGS = new Set([
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'summary',
]);

interface BrowserEntry {
  browser: Browser;
  connected: boolean;
}

interface PageEntry {
  page: Page;
  browserId: string;
}

function mapWaitUntil(waitUntil: NavigateOptions['waitUntil'] = 'load'): PuppeteerLifeCycleEvent {
  switch (waitUntil) {
    case 'domcontentloaded':
      return 'domcontentloaded';
    case 'networkidle':
      return 'networkidle2';
    default:
      return 'load';
  }
}

const ACTIONABLE_WAIT_MS = 5_000;
const ACTIONABLE_POLL_MS = 100;

const NAMED_KEYS = new Set([
  'Enter',
  'Tab',
  'Escape',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Backspace',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Insert',
  'Space',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
]);

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

export class PuppeteerCdpAdapter implements CdpAdapter {
  private readonly browsers = new Map<string, BrowserEntry>();
  private readonly pages = new Map<string, PageEntry>();
  private readonly disconnectCallbacks = new Map<string, Set<() => void>>();
  private readonly elementHandles = new Map<string, Map<string, ElementHandle>>();
  private readonly monitoring = new Map<string, PageMonitoringBuffer>();

  constructor(private readonly config: ResolvedConfig) {}

  async launchBrowser(options: LaunchOptions): Promise<CdpBrowser> {
    const browserId = crypto.randomUUID();
    try {
      const browser = await puppeteer.launch({
        headless: options.headless ?? this.config.headless,
        executablePath: options.executablePath ?? this.config.chromiumExecutablePath,
        args: options.args ?? ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: options.viewport ?? { width: 1280, height: 720 },
      });

      if (options.userAgent) {
        const pages = await browser.pages();
        const firstPage = pages[0];
        if (firstPage) {
          await firstPage.setUserAgent(options.userAgent);
        }
      }

      const entry: BrowserEntry = { browser, connected: true };
      this.browsers.set(browserId, entry);

      browser.on('disconnected', () => {
        entry.connected = false;
        const callbacks = this.disconnectCallbacks.get(browserId);
        callbacks?.forEach((cb) => cb());
        this.cleanupBrowser(browserId);
      });

      return { id: browserId, connected: true };
    } catch (error) {
      throw new CdpError(
        'Failed to launch Chromium. Set CHROMIUM_EXECUTABLE_PATH or install Chromium.',
        error instanceof Error ? error.message : String(error),
        'launchBrowser',
        false,
      );
    }
  }

  async closeBrowser(browser: CdpBrowser): Promise<void> {
    const entry = this.browsers.get(browser.id);
    if (!entry) return;

    const pageIds = [...this.pages.entries()]
      .filter(([, p]) => p.browserId === browser.id)
      .map(([id]) => id);

    for (const pageId of pageIds) {
      this.pages.delete(pageId);
      this.elementHandles.delete(pageId);
      this.monitoring.delete(pageId);
    }

    try {
      await entry.browser.close();
    } catch (error) {
      throw new CdpError(
        `Failed to close browser ${browser.id}`,
        error instanceof Error ? error.message : String(error),
        'closeBrowser',
        true,
      );
    } finally {
      this.cleanupBrowser(browser.id);
    }
  }

  isConnected(browser: CdpBrowser): boolean {
    const entry = this.browsers.get(browser.id);
    return entry?.connected ?? false;
  }

  onBrowserDisconnect(browserId: string, callback: () => void): void {
    let callbacks = this.disconnectCallbacks.get(browserId);
    if (!callbacks) {
      callbacks = new Set();
      this.disconnectCallbacks.set(browserId, callbacks);
    }
    callbacks.add(callback);
  }

  async createPage(browser: CdpBrowser): Promise<CdpPage> {
    const entry = this.browsers.get(browser.id);
    if (!entry || !entry.connected) {
      throw new CdpError(
        `Browser ${browser.id} is not connected`,
        'Browser disconnected',
        'createPage',
        false,
      );
    }

    try {
      const page = await entry.browser.newPage();
      const pageId = crypto.randomUUID();
      const targetId = pageId;

      this.pages.set(pageId, { page, browserId: browser.id });

      return {
        id: pageId,
        browserId: browser.id,
        targetId,
        url: page.url(),
        title: await page.title(),
      };
    } catch (error) {
      throw new CdpError(
        `Failed to create page in browser ${browser.id}`,
        error instanceof Error ? error.message : String(error),
        'createPage',
        true,
      );
    }
  }

  async navigate(page: CdpPage, url: string, options?: NavigateOptions): Promise<{ statusCode?: number }> {
    const pageEntry = this.getPageEntry(page);
    const timeout = options?.timeoutMs ?? this.config.defaultNavigationTimeoutMs;
    pageEntry.setDefaultNavigationTimeout(timeout);

    try {
      const response = await pageEntry.goto(url, {
        waitUntil: mapWaitUntil(options?.waitUntil),
        timeout,
      });
      this.elementHandles.delete(page.id);
      return { statusCode: response?.status() };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('timeout') || msg.includes('Timeout')) {
        throw new CdpError(
          `Navigation to '${url}' timed out after ${timeout} ms.`,
          msg,
          'navigate',
          true,
        );
      }
      throw new CdpError(`Navigation to '${url}' failed`, msg, 'navigate', true);
    }
  }

  async reload(page: CdpPage, options?: NavigateOptions): Promise<void> {
    const pageEntry = this.getPageEntry(page);
    const timeout = options?.timeoutMs ?? this.config.defaultNavigationTimeoutMs;
    pageEntry.setDefaultNavigationTimeout(timeout);

    try {
      await pageEntry.reload({
        waitUntil: mapWaitUntil(options?.waitUntil),
        timeout,
      });
      this.elementHandles.delete(page.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('timeout') || msg.includes('Timeout')) {
        throw new CdpError(`Page reload timed out after ${timeout} ms.`, msg, 'reload', true);
      }
      throw new CdpError('Page reload failed', msg, 'reload', true);
    }
  }

  async closePage(page: CdpPage): Promise<void> {
    const pageEntry = this.pages.get(page.id);
    if (!pageEntry) return;

    try {
      await pageEntry.page.close();
    } catch (error) {
      throw new CdpError(
        `Failed to close page ${page.id}`,
        error instanceof Error ? error.message : String(error),
        'closePage',
        true,
      );
    } finally {
      this.stopPageMonitoring(page);
      this.pages.delete(page.id);
      this.elementHandles.delete(page.id);
    }
  }

  async getUrl(page: CdpPage): Promise<string> {
    return this.getPageEntry(page).url();
  }

  async getTitle(page: CdpPage): Promise<string> {
    return this.getPageEntry(page).title();
  }

  async getAccessibilityTree(page: CdpPage): Promise<CdpNode[]> {
    const pageEntry = this.getPageEntry(page);
    try {
      const snapshot = await pageEntry.accessibility.snapshot({ interestingOnly: false });
      if (!snapshot) return [];

      const nodes: CdpNode[] = [];
      const walk = (node: SerializedAXNode, index: number): void => {
        const role = (node.role ?? 'generic').toLowerCase();
        const name = node.name ?? '';
        const tagName = inferTagFromRole(role);
        const isInteractive =
          INTERACTIVE_ROLES.has(role) ||
          node.focused === true ||
          (node.value !== undefined && role !== 'generic');

        if (isInteractive || INTERACTIVE_TAGS.has(tagName)) {
          nodes.push({
            nodeId: `${page.id}:${index}:${role}:${name.slice(0, 20)}`,
            role,
            name,
            visible: true,
            tagName,
            ariaLabel: name || undefined,
          });
        }

        node.children?.forEach((child: SerializedAXNode, i: number) => walk(child, index * 100 + i + 1));
      };

      walk(snapshot, 0);

      const domNodes = await this.extractDomInteractiveElements(pageEntry);
      return mergeNodes(nodes, domNodes, page.id);
    } catch (error) {
      throw new CdpError(
        'Failed to get accessibility tree',
        error instanceof Error ? error.message : String(error),
        'getAccessibilityTree',
        true,
      );
    }
  }

  async clickElement(page: CdpPage, nodeId: string): Promise<void> {
    const handle = await this.requireElementHandle(page, nodeId);
    try {
      await handle.evaluate((el) => {
        el.scrollIntoView({ block: 'center', inline: 'center' });
      });
      const actionable = await this.waitForActionable(handle);
      if (!actionable) {
        throw new CdpError(
          `Element not actionable within ${ACTIONABLE_WAIT_MS} ms`,
          'Element not visible or enabled',
          'clickElement',
          true,
        );
      }
      await handle.click();
    } catch (error) {
      if (error instanceof CdpError) throw error;
      throw new CdpError(
        'Failed to click element',
        error instanceof Error ? error.message : String(error),
        'clickElement',
        true,
      );
    }
  }

  async typeElement(page: CdpPage, nodeId: string, value: string, options: TypeOptions = {}): Promise<string> {
    const handle = await this.requireElementHandle(page, nodeId);
    const { append = false, delay = 0 } = options;

    try {
      await handle.evaluate((el) => {
        el.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await handle.click({ clickCount: 3 });

      if (!append) {
        await handle.evaluate((el) => {
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            el.value = '';
          }
        });
      }

      if (delay > 0) {
        await handle.type(value, { delay });
      } else {
        await handle.type(value);
      }

      return handle.evaluate((el) => {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          return el.value;
        }
        return (el as HTMLElement).innerText ?? '';
      });
    } catch (error) {
      throw new CdpError(
        'Failed to type into element',
        error instanceof Error ? error.message : String(error),
        'typeElement',
        true,
      );
    }
  }

  async pressKey(page: CdpPage, key: string): Promise<string> {
    if (!isValidKey(key)) {
      throw new CdpError(`Unrecognized key '${key}'`, 'Invalid key', 'pressKey', true);
    }

    const pageEntry = this.getPageEntry(page);
    try {
      await pageEntry.keyboard.press(key as Parameters<Page['keyboard']['press']>[0]);
      return key;
    } catch (error) {
      throw new CdpError(
        `Failed to press key '${key}'`,
        error instanceof Error ? error.message : String(error),
        'pressKey',
        true,
      );
    }
  }

  async scroll(page: CdpPage, direction: ScrollDirection, amount?: number): Promise<{ direction: ScrollDirection; amount: number }> {
    const pageEntry = this.getPageEntry(page);
    const viewport = pageEntry.viewport();
    const defaultAmount =
      direction === 'left' || direction === 'right'
        ? (viewport?.width ?? 1280)
        : (viewport?.height ?? 720);
    const scrollAmount = amount ?? defaultAmount;

    const delta = {
      up: { x: 0, y: -scrollAmount },
      down: { x: 0, y: scrollAmount },
      left: { x: -scrollAmount, y: 0 },
      right: { x: scrollAmount, y: 0 },
    }[direction];

    await pageEntry.evaluate(({ x, y }) => {
      window.scrollBy(x, y);
    }, delta);

    return { direction, amount: scrollAmount };
  }

  async captureScreenshot(page: CdpPage, fullPage = false): Promise<{ buffer: Buffer; width: number; height: number }> {
    const pageEntry = this.getPageEntry(page);
    try {
      const buffer = (await pageEntry.screenshot({ type: 'png', fullPage })) as Buffer;
      const dimensions = await pageEntry.evaluate(() => ({
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      }));
      return { buffer, width: dimensions.width, height: dimensions.height };
    } catch (error) {
      throw new CdpError(
        'Failed to capture screenshot',
        error instanceof Error ? error.message : String(error),
        'captureScreenshot',
        true,
      );
    }
  }

  async getDomStats(page: CdpPage): Promise<import('./adapter.js').DOMStats> {
    const pageEntry = this.getPageEntry(page);
    return pageEntry.evaluate(() => ({
      nodeCount: document.querySelectorAll('*').length,
      formCount: document.querySelectorAll('form').length,
      linkCount: document.querySelectorAll('a[href]').length,
      imageCount: document.querySelectorAll('img').length,
    }));
  }

  async getVisibleText(page: CdpPage): Promise<string> {
    const pageEntry = this.getPageEntry(page);
    return pageEntry.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const lines: string[] = [];
      let node: Node | null = walker.nextNode();
      while (node) {
        const text = node.textContent?.replace(/\s+/g, ' ').trim();
        if (text) {
          const parent = node.parentElement;
          if (parent) {
            const style = window.getComputedStyle(parent);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              lines.push(text);
            }
          }
        }
        node = walker.nextNode();
      }
      return lines.join('\n');
    });
  }

  async getOuterHtml(page: CdpPage): Promise<string> {
    const pageEntry = this.getPageEntry(page);
    return pageEntry.evaluate(() => document.documentElement.outerHTML);
  }

  startPageMonitoring(page: CdpPage, hooks?: MonitoringHooks): void {
    const pageEntry = this.getPageEntry(page);
    const buffer = new PageMonitoringBuffer({
      onNetworkError: hooks?.onNetworkError,
      onConsoleError: hooks?.onConsoleError,
    });
    buffer.attach(pageEntry);
    this.monitoring.set(page.id, buffer);
  }

  stopPageMonitoring(page: CdpPage): void {
    this.monitoring.delete(page.id);
  }

  getNetworkEntries(page: CdpPage): NetworkEntry[] {
    return this.monitoring.get(page.id)?.getNetworkEntries() ?? [];
  }

  getConsoleEntries(page: CdpPage): ConsoleEntry[] {
    return this.monitoring.get(page.id)?.getConsoleEntries() ?? [];
  }

  getInFlightNetworkCount(page: CdpPage): number {
    return this.monitoring.get(page.id)?.getInFlightCount() ?? 0;
  }

  getLastNetworkActivityMs(page: CdpPage): number {
    return this.monitoring.get(page.id)?.getLastActivityMs() ?? Date.now();
  }

  async resolveElementHandle(page: CdpPage, nodeId: string): Promise<ElementHandle | null> {
    let pageHandles = this.elementHandles.get(page.id);
    if (!pageHandles) {
      pageHandles = new Map();
      this.elementHandles.set(page.id, pageHandles);
    }

    const cached = pageHandles.get(nodeId);
    if (cached) return cached;

    const pageEntry = this.getPageEntry(page);
    const selector = nodeIdToSelector(nodeId);
    if (!selector) return null;

    try {
      const handle = await pageEntry.$(selector);
      if (handle) {
        pageHandles.set(nodeId, handle);
      }
      return handle;
    } catch {
      return null;
    }
  }

  private async extractDomInteractiveElements(page: Page): Promise<CdpNode[]> {
    type DomScanResult = {
      nodeId: string;
      role: string;
      name: string;
      visible: boolean;
      tagName: string;
      ariaLabel?: string;
    };

    return page.evaluate((): DomScanResult[] => {
      const results: DomScanResult[] = [];

      const interactiveSelector =
        'button, a[href], input, textarea, select, [role], [onclick], summary, [tabindex]:not([tabindex="-1"])';
      const elements = document.querySelectorAll(interactiveSelector);

      elements.forEach((el: Element, index: number) => {
        const htmlEl = el as HTMLElement;
        const style = window.getComputedStyle(htmlEl);
        const visible =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0' &&
          htmlEl.offsetWidth > 0 &&
          htmlEl.offsetHeight > 0;

        const tagName = htmlEl.tagName.toLowerCase();
        const role =
          htmlEl.getAttribute('role') ??
          (tagName === 'a' ? 'link' : tagName === 'input' ? inferInputRole(htmlEl) : tagName);
        const ariaLabel = htmlEl.getAttribute('aria-label') ?? undefined;
        const text =
          ariaLabel ??
          htmlEl.innerText?.trim() ??
          (htmlEl as HTMLInputElement).placeholder ??
          htmlEl.getAttribute('value') ??
          '';

        results.push({
          nodeId: `dom:${index}:${tagName}`,
          role,
          name: text,
          visible,
          tagName,
          ariaLabel,
        });
      });

      function inferInputRole(el: HTMLElement): string {
        const type = (el as HTMLInputElement).type?.toLowerCase() ?? 'text';
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
        if (type === 'submit' || type === 'button') return 'button';
        return 'textbox';
      }

      return results;
    });
  }

  private getPageEntry(page: CdpPage): Page {
    const entry = this.pages.get(page.id);
    if (!entry) {
      throw new CdpError(
        `Page ${page.id} not found`,
        'Target closed',
        'getPage',
        false,
      );
    }
    return entry.page;
  }

  private async requireElementHandle(page: CdpPage, nodeId: string): Promise<ElementHandle> {
    const handle = await this.resolveElementHandle(page, nodeId);
    if (!handle) {
      throw new CdpError(
        `Element handle for node '${nodeId}' not found`,
        'Element not found',
        'resolveElementHandle',
        true,
      );
    }
    return handle;
  }

  private async waitForActionable(handle: ElementHandle): Promise<boolean> {
    const deadline = Date.now() + ACTIONABLE_WAIT_MS;
    while (Date.now() < deadline) {
      const actionable = await handle.evaluate((el) => {
        const htmlEl = el as HTMLElement;
        const style = window.getComputedStyle(htmlEl);
        const visible =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          htmlEl.offsetWidth > 0 &&
          htmlEl.offsetHeight > 0;
        const disabled =
          (htmlEl as HTMLButtonElement).disabled === true ||
          htmlEl.getAttribute('aria-disabled') === 'true';
        return visible && !disabled;
      });
      if (actionable) return true;
      await new Promise((resolve) => setTimeout(resolve, ACTIONABLE_POLL_MS));
    }
    return false;
  }

  private cleanupBrowser(browserId: string): void {
    this.browsers.delete(browserId);
    this.disconnectCallbacks.delete(browserId);
    for (const [pageId, entry] of this.pages.entries()) {
      if (entry.browserId === browserId) {
        this.pages.delete(pageId);
        this.elementHandles.delete(pageId);
        this.monitoring.delete(pageId);
      }
    }
  }
}

function isValidKey(key: string): boolean {
  if (!key) return false;
  const parts = key.split('+');
  if (parts.length === 0) return false;

  const mainKey = parts[parts.length - 1]!;
  const modifiers = parts.slice(0, -1);

  if (modifiers.some((mod) => !MODIFIER_KEYS.has(mod))) return false;
  if (mainKey.length === 1) return true;
  return NAMED_KEYS.has(mainKey);
}

function inferTagFromRole(role: string): string {
  const roleToTag: Record<string, string> = {
    button: 'button',
    link: 'a',
    textbox: 'input',
    checkbox: 'input',
    radio: 'input',
    combobox: 'select',
  };
  return roleToTag[role] ?? 'div';
}

function mergeNodes(axNodes: CdpNode[], domNodes: CdpNode[], pageId: string): CdpNode[] {
  const seen = new Set<string>();
  const merged: CdpNode[] = [];

  for (const node of [...axNodes, ...domNodes]) {
    const key = `${node.role}:${node.name}:${node.tagName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...node, nodeId: `${pageId}:${merged.length}:${node.nodeId}` });
  }

  return merged;
}

function nodeIdToSelector(_nodeId: string): string | null {
  return 'button, a[href], input, textarea, select, [role], [onclick], summary, [tabindex]:not([tabindex="-1"])';
}
