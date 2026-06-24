import puppeteer, {
  type Browser,
  type ElementHandle,
  type Frame,
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
  type ElementTargetOptions,
  type SelectOptionOptions,
  type UploadFilesOptions,
  type MonitoringHooks,
  type FrameInfo,
  type BrowserCookie,
  type EnterFrameOptions,
} from './adapter.js';
import { PageMonitoringBuffer } from './page-monitoring.js';

const INTERACTIVE_SELECTOR =
  'button, a[href], input, textarea, select, [role], [onclick], summary, [tabindex]:not([tabindex="-1"])';

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
  activeFrame: Frame | null;
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
const CLICK_DELAY_MS = 50;

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

      this.pages.set(pageId, { page, browserId: browser.id, activeFrame: null });

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
    const context = this.getActiveContext(page);
    try {
      const snapshot = await (context as Page).accessibility.snapshot({ interestingOnly: false });
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
            regionHint: role === 'columnheader' ? 'grid-header' : undefined,
          });
        }

        node.children?.forEach((child: SerializedAXNode, i: number) => walk(child, index * 100 + i + 1));
      };

      walk(snapshot, 0);

      const domNodes = await this.extractDomInteractiveElements(context);
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

  async clickElement(page: CdpPage, nodeId: string, options: ElementTargetOptions = {}): Promise<void> {
    const handle = await this.requireElementHandle(page, nodeId, options.tag);
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
      await this.focusElementHandle(handle);
      await handle.click({ delay: CLICK_DELAY_MS });
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

  async typeElement(
    page: CdpPage,
    nodeId: string,
    value: string,
    options: TypeOptions & ElementTargetOptions = {},
  ): Promise<string> {
    const handle = await this.requireElementHandle(page, nodeId, options.tag);
    const { append = false, delay = 0 } = options;

    try {
      await handle.evaluate((el) => {
        el.scrollIntoView({ block: 'center', inline: 'center' });
      });
      await this.focusElementHandle(handle);

      const existingValue = append ? await readElementValue(handle) : '';

      if (!append) {
        await handle.click({ clickCount: 3 });
        await handle.press('Backspace');
      }

      if (delay > 0) {
        await handle.type(value, { delay });
      } else {
        await handle.type(value);
      }

      let finalValue = await readElementValue(handle);
      const expectedValue = append ? `${existingValue}${value}` : value;

      if (finalValue !== expectedValue) {
        await setNativeInputValue(handle, expectedValue);
        finalValue = await readElementValue(handle);
      }

      return finalValue;
    } catch (error) {
      throw new CdpError(
        'Failed to type into element',
        error instanceof Error ? error.message : String(error),
        'typeElement',
        true,
      );
    }
  }

  async pressKey(
    page: CdpPage,
    key: string,
    options: ElementTargetOptions & { nodeId?: string } = {},
  ): Promise<string> {
    if (!isValidKey(key)) {
      throw new CdpError(`Unrecognized key '${key}'`, 'Invalid key', 'pressKey', true);
    }

    const pageEntry = this.getPageEntry(page);
    try {
      if (options.nodeId) {
        const handle = await this.requireElementHandle(page, options.nodeId, options.tag);
        await handle.evaluate((el) => {
          el.scrollIntoView({ block: 'center', inline: 'center' });
        });
        await this.focusElementHandle(handle);
        await handle.press(key as Parameters<ElementHandle['press']>[0]);
        return key;
      }

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

  async scroll(
    page: CdpPage,
    direction: ScrollDirection,
    amount?: number,
    options: ElementTargetOptions & { nodeId?: string } = {},
  ): Promise<{ direction: ScrollDirection; amount: number }> {
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

    if (options.nodeId) {
      const handle = await this.requireElementHandle(page, options.nodeId, options.tag);
      await scrollNearestOverflow(handle, delta);
    } else {
      await pageEntry.evaluate(({ x, y }) => {
        window.scrollBy(x, y);
      }, delta);
    }

    return { direction, amount: scrollAmount };
  }

  async selectOption(
    page: CdpPage,
    nodeId: string,
    options: SelectOptionOptions,
  ): Promise<string> {
    const handle = await this.requireElementHandle(page, nodeId, options.tag);
    const pageEntry = this.getPageEntry(page);

    try {
      await handle.evaluate((el) => {
        el.scrollIntoView({ block: 'center', inline: 'center' });
      });

      const tagName = await handle.evaluate((el) => el.tagName.toLowerCase());

      if (tagName === 'select') {
        if (options.by === 'value' && options.value !== undefined) {
          await handle.select(options.value);
          return await readElementValue(handle);
        }

        if (options.label !== undefined) {
          const selectedValue = await handle.evaluate(
            (el, lbl, matchMode) => {
              const select = el as HTMLSelectElement;
              for (const opt of Array.from(select.options)) {
                const text = opt.text.trim();
                const matches =
                  matchMode === 'contains' ? text.includes(lbl) : text === lbl;
                if (matches) {
                  select.value = opt.value;
                  select.dispatchEvent(new Event('input', { bubbles: true }));
                  select.dispatchEvent(new Event('change', { bubbles: true }));
                  return opt.value;
                }
              }
              throw new Error(`No option matching label '${lbl}'`);
            },
            options.label,
            options.match ?? 'equals',
          );
          return selectedValue;
        }

        throw new CdpError(
          'Select by value requires a value',
          'Missing value',
          'selectOption',
          true,
        );
      }

      await handle.click({ delay: CLICK_DELAY_MS });
      const searchText = options.by === 'value' ? options.value : options.label;
      if (searchText === undefined) {
        throw new CdpError(
          'Select requires value or label',
          'Missing selection target',
          'selectOption',
          true,
        );
      }

      const selected = await pageEntry.evaluate(
        ({ text, matchMode }) => {
          const candidates = Array.from(
            document.querySelectorAll('[role="option"], option, li[data-value]'),
          );
          for (const node of candidates) {
            const htmlEl = node as HTMLElement;
            const style = window.getComputedStyle(htmlEl);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            const label = htmlEl.innerText?.trim() ?? htmlEl.textContent?.trim() ?? '';
            const matches =
              matchMode === 'contains' ? label.includes(text) : label === text;
            if (matches) {
              htmlEl.click();
              return label;
            }
          }
          throw new Error(`No option matching '${text}'`);
        },
        { text: searchText, matchMode: options.match ?? 'equals' },
      );

      return selected;
    } catch (error) {
      if (error instanceof CdpError) throw error;
      throw new CdpError(
        'Failed to select option',
        error instanceof Error ? error.message : String(error),
        'selectOption',
        true,
      );
    }
  }

  async uploadFiles(
    page: CdpPage,
    nodeId: string,
    filePaths: string[],
    options: UploadFilesOptions = {},
  ): Promise<string[]> {
    const handle = await this.requireElementHandle(page, nodeId, options.tag);

    try {
      const isFileInput = await handle.evaluate(
        (el) => el instanceof HTMLInputElement && el.type === 'file',
      );
      if (!isFileInput) {
        throw new CdpError(
          'Element is not a file input',
          'Expected input[type=file]',
          'uploadFiles',
          true,
        );
      }

      if (options.clear) {
        await handle.evaluate((el) => {
          const input = el as HTMLInputElement;
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }

      await (handle as ElementHandle<HTMLInputElement>).uploadFile(...filePaths);
      return filePaths;
    } catch (error) {
      if (error instanceof CdpError) throw error;
      throw new CdpError(
        'Failed to upload files',
        error instanceof Error ? error.message : String(error),
        'uploadFiles',
        true,
      );
    }
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
    const context = this.getActiveContext(page);
    return context.evaluate(() => {
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
    const context = this.getActiveContext(page);
    return context.evaluate(() => document.documentElement.outerHTML);
  }

  async listFrames(page: CdpPage): Promise<FrameInfo[]> {
    const pageEntry = this.getPageEntry(page);
    const frames = pageEntry.frames();
    const main = pageEntry.mainFrame();
    return frames.map((frame, index) => {
      const parent = frame.parentFrame();
      return {
        index,
        name: frame.name() || undefined,
        url: frame.url(),
        isMain: frame === main,
        parentIndex: parent ? frames.indexOf(parent) : undefined,
      };
    });
  }

  async enterFrame(page: CdpPage, options: EnterFrameOptions): Promise<FrameInfo> {
    const entry = this.getPageEntryOrThrow(page);
    const frames = entry.page.frames();
    const main = entry.page.mainFrame();
    let target: Frame | undefined;

    if (options.frameIndex !== undefined) {
      target = frames[options.frameIndex];
    } else if (options.frameQuery) {
      const iframe = await entry.page.$(options.frameQuery);
      if (!iframe) {
        throw new CdpError(
          `No iframe matches selector '${options.frameQuery}'`,
          'Frame not found',
          'enterFrame',
          true,
        );
      }
      target = (await iframe.contentFrame()) ?? undefined;
      if (!target) {
        throw new CdpError(
          `Iframe '${options.frameQuery}' has no content frame`,
          'Frame not attached',
          'enterFrame',
          true,
        );
      }
    } else if (options.frameUrl) {
      target = frames.find((frame) => frame.url().includes(options.frameUrl!));
    } else {
      throw new CdpError(
        'frameIndex, frameQuery, or frameUrl is required for enter',
        'Missing frame selector',
        'enterFrame',
        true,
      );
    }

    if (!target) {
      throw new CdpError(
        'Target frame not found',
        'Frame not found',
        'enterFrame',
        true,
      );
    }

    entry.activeFrame = target === main ? null : target;
    this.elementHandles.delete(page.id);

    const index = frames.indexOf(target);
    return {
      index,
      name: target.name() || undefined,
      url: target.url(),
      isMain: target === main,
      parentIndex: target.parentFrame() ? frames.indexOf(target.parentFrame()!) : undefined,
    };
  }

  async exitFrame(page: CdpPage): Promise<void> {
    const entry = this.getPageEntryOrThrow(page);
    entry.activeFrame = null;
    this.elementHandles.delete(page.id);
  }

  async getCookies(browser: CdpBrowser, urls?: string[]): Promise<BrowserCookie[]> {
    const page = this.getFirstPageForBrowser(browser.id);
    if (!page) {
      throw new CdpError(
        `No open pages for browser ${browser.id}`,
        'No pages',
        'getCookies',
        true,
      );
    }
    const cookies = await page.cookies(...(urls ?? []));
    return cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite as BrowserCookie['sameSite'],
    }));
  }

  async setCookies(browser: CdpBrowser, cookies: BrowserCookie[]): Promise<void> {
    const page = this.getFirstPageForBrowser(browser.id);
    if (!page) {
      throw new CdpError(
        `No open pages for browser ${browser.id}`,
        'No pages',
        'setCookies',
        true,
      );
    }
    await page.setCookie(...cookies);
  }

  async clearCookies(browser: CdpBrowser, urls?: string[]): Promise<void> {
    const page = this.getFirstPageForBrowser(browser.id);
    if (!page) {
      throw new CdpError(
        `No open pages for browser ${browser.id}`,
        'No pages',
        'clearCookies',
        true,
      );
    }

    if (urls && urls.length > 0) {
      const existing = await page.cookies(...urls);
      if (existing.length > 0) {
        await page.deleteCookie(...existing);
      }
      return;
    }

    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
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

  async resolveElementHandle(page: CdpPage, nodeId: string, tag?: string): Promise<ElementHandle | null> {
    const cacheKey = tag ? `${nodeId}::${tag}` : nodeId;
    let pageHandles = this.elementHandles.get(page.id);
    if (!pageHandles) {
      pageHandles = new Map();
      this.elementHandles.set(page.id, pageHandles);
    }

    const cached = pageHandles.get(cacheKey);
    if (cached) return cached;

    const context = this.getActiveContext(page);

    try {
      const handle = await this.lookupElementHandle(context, nodeId, tag);
      if (handle) {
        pageHandles.set(cacheKey, handle);
      }
      return handle;
    } catch {
      return null;
    }
  }

  private async lookupElementHandle(context: Page | Frame, nodeId: string, tag?: string): Promise<ElementHandle | null> {
    const domIndex = parseDomIndexFromNodeId(nodeId);
    if (domIndex !== null) {
      const handles = await context.$$(INTERACTIVE_SELECTOR);
      const handle = handles[domIndex] ?? null;
      if (!handle) return null;

      if (tag) {
        const tagName = await handle.evaluate((el) => el.tagName.toLowerCase());
        if (tagName !== tag.toLowerCase()) return null;
      }

      return handle;
    }

    const roleName = parseRoleNameFromNodeId(nodeId);
    if (!roleName) return null;

    const handle = await context.evaluateHandle(
      ({ selector, role, name, expectedTag }) => {
        function inferInputRole(el: HTMLElement): string {
          const type = (el as HTMLInputElement).type?.toLowerCase() ?? 'text';
          if (type === 'checkbox') return 'checkbox';
          if (type === 'radio') return 'radio';
          if (type === 'submit' || type === 'button') return 'button';
          return 'textbox';
        }

        const elements = Array.from(document.querySelectorAll(selector));
        for (const el of elements) {
          const htmlEl = el as HTMLElement;
          const tagName = htmlEl.tagName.toLowerCase();
          if (expectedTag && tagName !== expectedTag.toLowerCase()) continue;

          const elRole =
            htmlEl.getAttribute('role') ??
            (tagName === 'a' ? 'link' : tagName === 'input' ? inferInputRole(htmlEl) : tagName);
          const ariaLabel = htmlEl.getAttribute('aria-label') ?? undefined;
          const text =
            ariaLabel ??
            htmlEl.innerText?.trim() ??
            (htmlEl as HTMLInputElement).placeholder ??
            htmlEl.getAttribute('value') ??
            '';

          if (elRole.toLowerCase() === role && text === name) {
            return htmlEl;
          }
        }
        return null;
      },
      {
        selector: INTERACTIVE_SELECTOR,
        role: roleName.role,
        name: roleName.name,
        expectedTag: tag,
      },
    );

    const element = handle.asElement() as ElementHandle<Element> | null;
    if (!element) {
      await handle.dispose();
    }
    return element;
  }

  private async extractDomInteractiveElements(context: Page | Frame): Promise<CdpNode[]> {
    type DomScanResult = {
      nodeId: string;
      role: string;
      name: string;
      visible: boolean;
      tagName: string;
      ariaLabel?: string;
      regionHint?: string;
    };

    return context.evaluate((selector: string): DomScanResult[] => {
      const results: DomScanResult[] = [];

      function inferRegion(el: HTMLElement): string | undefined {
        let current: HTMLElement | null = el;
        while (current && current !== document.body) {
          const role = current.getAttribute('role')?.toLowerCase();
          const ariaLabel = current.getAttribute('aria-label')?.toLowerCase() ?? '';
          const id = current.id?.toLowerCase() ?? '';
          const className = current.className?.toString().toLowerCase() ?? '';

          if (
            role === 'toolbar' ||
            ariaLabel.includes('toolbar') ||
            id.includes('toolbar') ||
            className.includes('toolbar')
          ) {
            return 'toolbar';
          }
          if (
            ariaLabel.includes('filter') ||
            id.includes('filter') ||
            className.includes('filter') ||
            current.matches('[data-filter], [data-floating-filter]')
          ) {
            return 'filter';
          }
          if (role === 'columnheader') {
            return 'grid-header';
          }
          if (role === 'gridcell' || role === 'row') {
            return 'grid-body';
          }
          if (role === 'grid') {
            return 'grid-body';
          }
          current = current.parentElement;
        }
        return undefined;
      }

      const elements = document.querySelectorAll(selector);

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
          regionHint: inferRegion(htmlEl),
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
    }, INTERACTIVE_SELECTOR);
  }

  private getPageEntryOrThrow(page: CdpPage): PageEntry {
    const entry = this.pages.get(page.id);
    if (!entry) {
      throw new CdpError(
        `Page ${page.id} not found`,
        'Target closed',
        'getPage',
        false,
      );
    }
    return entry;
  }

  private getActiveContext(page: CdpPage): Page | Frame {
    const entry = this.getPageEntryOrThrow(page);
    return entry.activeFrame ?? entry.page.mainFrame();
  }

  private getFirstPageForBrowser(browserId: string): Page | undefined {
    for (const entry of this.pages.values()) {
      if (entry.browserId === browserId) {
        return entry.page;
      }
    }
    return undefined;
  }

  private getPageEntry(page: CdpPage): Page {
    return this.getPageEntryOrThrow(page).page;
  }

  private async requireElementHandle(page: CdpPage, nodeId: string, tag?: string): Promise<ElementHandle> {
    const handle = await this.resolveElementHandle(page, nodeId, tag);
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

  private async focusElementHandle(handle: ElementHandle): Promise<void> {
    await handle.evaluate((el) => {
      if (el instanceof HTMLElement) {
        el.focus();
      }
    });
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
  const byKey = new Map<string, CdpNode>();

  for (const node of [...axNodes, ...domNodes]) {
    const key = `${node.role}:${node.name}:${node.tagName}`;
    const existing = byKey.get(key);
    if (!existing || (!existing.regionHint && node.regionHint)) {
      byKey.set(key, node);
    }
  }

  return [...byKey.values()].map((node, index) => ({
    ...node,
    nodeId: `${pageId}:${index}:${node.nodeId}`,
  }));
}

export function parseDomIndexFromNodeId(nodeId: string): number | null {
  const match = nodeId.match(/:dom:(\d+):/);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

export function parseDomTagFromNodeId(nodeId: string): string | null {
  const match = nodeId.match(/:dom:\d+:([a-z0-9-]+)/i);
  return match ? match[1]!.toLowerCase() : null;
}

export function parseRoleNameFromNodeId(nodeId: string): { role: string; name: string } | null {
  if (nodeId.includes(':dom:')) return null;
  const parts = nodeId.split(':');
  if (parts.length < 2) return null;
  const name = parts.at(-1) ?? '';
  const role = parts.at(-2) ?? '';
  if (!role) return null;
  return { role: role.toLowerCase(), name };
}

async function scrollNearestOverflow(
  handle: ElementHandle,
  delta: { x: number; y: number },
): Promise<void> {
  await handle.evaluate((el, scrollDelta) => {
    function isScrollable(node: Element): boolean {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;
      const canScrollY =
        (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
        node.scrollHeight > node.clientHeight;
      const canScrollX =
        (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') &&
        node.scrollWidth > node.clientWidth;
      return canScrollY || canScrollX;
    }

    function findScrollableAncestor(node: Element | null): Element {
      let current: Element | null = node;
      while (current && current !== document.documentElement) {
        if (isScrollable(current)) return current;
        current = current.parentElement;
      }
      return node ?? document.documentElement;
    }

    const target = findScrollableAncestor(el);
    target.scrollBy(scrollDelta.x, scrollDelta.y);
  }, delta);
}

async function readElementValue(handle: ElementHandle): Promise<string> {
  return handle.evaluate((el) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el.value;
    }
    if (el instanceof HTMLSelectElement) {
      return el.value;
    }
    return (el as HTMLElement).innerText ?? '';
  });
}

async function setNativeInputValue(handle: ElementHandle, value: string): Promise<void> {
  await handle.evaluate((el, nextValue) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const prototype =
        el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      descriptor?.set?.call(el, nextValue);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, value);
}
