export interface BrowserSession {
  browserId: string;
  createdAt: string;
  headless: boolean;
  recordingEnabled: boolean;
  pageIds: string[];
  crashed?: boolean;
}

export interface PageSession {
  pageId: string;
  browserId: string;
  url: string;
  title: string;
  createdAt: string;
}

export interface Element {
  elementId: string;
  role: string;
  text: string;
  visible: boolean;
  tag?: string;
  /** Internal CDP node reference — never exposed in MCP responses */
  selector?: string;
  /** Query from page_find/page_wait — used for replayable recording; never exposed in MCP responses */
  discoveredQuery?: string;
}

export type RecordedEventType =
  | 'action'
  | 'assertion'
  | 'navigation'
  | 'screenshot'
  | 'network'
  | 'console'
  | 'error';

export interface RecordedEvent {
  timestamp: string;
  type: RecordedEventType;
  pageId?: string;
  payload: Record<string, unknown>;
}

/** Strip internal fields before MCP serialization */
export function toPublicElement(element: Element): Omit<Element, 'selector' | 'discoveredQuery'> {
  const { selector: _selector, discoveredQuery: _discoveredQuery, ...publicElement } = element;
  return publicElement;
}

export const ELEMENT_TEXT_MAX_LENGTH = 200;

export function truncateText(text: string, maxLength = ELEMENT_TEXT_MAX_LENGTH): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}
