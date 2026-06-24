export interface LaunchOptions {
  headless?: boolean;
  viewport?: { width: number; height: number };
  userAgent?: string;
  args?: string[];
  executablePath?: string;
}

export interface NavigateOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeoutMs?: number;
}

export interface CdpBrowser {
  id: string;
  connected: boolean;
}

export interface CdpPage {
  id: string;
  browserId: string;
  targetId: string;
  url: string;
  title: string;
}

export interface CdpNode {
  nodeId: string;
  role: string;
  name: string;
  visible: boolean;
  tagName: string;
  ariaLabel?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  /** Heuristic region for find disambiguation (toolbar, filter, grid-header, grid-body) */
  regionHint?: string;
}

export interface DOMStats {
  nodeCount: number;
  formCount: number;
  linkCount: number;
  imageCount: number;
}

export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

export interface ScreenshotCapture {
  buffer: Buffer;
  width: number;
  height: number;
}

export interface TypeOptions {
  append?: boolean;
  delay?: number;
}

export interface ElementTargetOptions {
  tag?: string;
}

export interface SelectOptionOptions extends ElementTargetOptions {
  by: 'value' | 'label';
  value?: string;
  label?: string;
  match?: 'equals' | 'contains';
}

export interface UploadFilesOptions extends ElementTargetOptions {
  clear?: boolean;
}

export interface MonitoringHooks {
  onNetworkError?: (entry: NetworkEntry) => void;
  onConsoleError?: (entry: ConsoleEntry) => void;
}

export interface ScrollResult {
  direction: ScrollDirection;
  amount: number;
}

export interface NetworkEntry {
  requestId: string;
  url: string;
  method: string;
  status: number;
  resourceType: string;
  timestamp: string;
  failed: boolean;
  durationMs?: number;
}

export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: string;
  source?: string;
}

export interface CdpAdapter {
  launchBrowser(options: LaunchOptions): Promise<CdpBrowser>;
  closeBrowser(browser: CdpBrowser): Promise<void>;
  isConnected(browser: CdpBrowser): boolean;
  onBrowserDisconnect(browserId: string, callback: () => void): void;

  createPage(browser: CdpBrowser): Promise<CdpPage>;
  navigate(page: CdpPage, url: string, options?: NavigateOptions): Promise<{ statusCode?: number }>;
  reload(page: CdpPage, options?: NavigateOptions): Promise<void>;
  closePage(page: CdpPage): Promise<void>;
  getUrl(page: CdpPage): Promise<string>;
  getTitle(page: CdpPage): Promise<string>;

  getAccessibilityTree(page: CdpPage): Promise<CdpNode[]>;
  resolveElementHandle(page: CdpPage, nodeId: string): Promise<unknown | null>;

  clickElement(page: CdpPage, nodeId: string, options?: ElementTargetOptions): Promise<void>;
  typeElement(
    page: CdpPage,
    nodeId: string,
    value: string,
    options?: TypeOptions & ElementTargetOptions,
  ): Promise<string>;
  pressKey(page: CdpPage, key: string, options?: ElementTargetOptions & { nodeId?: string }): Promise<string>;
  scroll(
    page: CdpPage,
    direction: ScrollDirection,
    amount?: number,
    options?: ElementTargetOptions & { nodeId?: string },
  ): Promise<ScrollResult>;

  selectOption(page: CdpPage, nodeId: string, options: SelectOptionOptions): Promise<string>;
  uploadFiles(
    page: CdpPage,
    nodeId: string,
    filePaths: string[],
    options?: UploadFilesOptions,
  ): Promise<string[]>;

  captureScreenshot(page: CdpPage, fullPage?: boolean): Promise<ScreenshotCapture>;
  getDomStats(page: CdpPage): Promise<DOMStats>;
  getVisibleText(page: CdpPage): Promise<string>;
  getOuterHtml(page: CdpPage): Promise<string>;

  startPageMonitoring(page: CdpPage, hooks?: MonitoringHooks): void;
  stopPageMonitoring(page: CdpPage): void;
  getNetworkEntries(page: CdpPage): NetworkEntry[];
  getConsoleEntries(page: CdpPage): ConsoleEntry[];
  getInFlightNetworkCount(page: CdpPage): number;
  getLastNetworkActivityMs(page: CdpPage): number;
}

export class CdpError extends Error {
  constructor(
    message: string,
    readonly cdpMessage: string,
    readonly operation: string,
    readonly recoverable: boolean,
    readonly cdpCode?: number,
  ) {
    super(message);
    this.name = 'CdpError';
  }
}
