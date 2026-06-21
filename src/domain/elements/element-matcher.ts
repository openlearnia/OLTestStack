import { v4 as uuidv4 } from 'uuid';
import type { CdpNode } from '../../cdp/adapter.js';
import type { Element } from '../../core/types/sessions.js';
import { truncateText } from '../../core/types/sessions.js';

export const MAX_ELEMENTS = 200;

export function cdpNodeToElement(node: CdpNode, elementId?: string): Element {
  return {
    elementId: elementId ?? uuidv4(),
    role: node.role,
    text: truncateText(node.name || node.ariaLabel || ''),
    visible: node.visible,
    tag: node.tagName,
    selector: node.nodeId,
  };
}

export function matchesQuery(element: Element, query: string, ariaLabel?: string): boolean {
  const normalizedQuery = query.toLowerCase();
  const fields = [element.text, element.role, ariaLabel ?? ''].map((f) => f.toLowerCase());
  return fields.some((field) => field.includes(normalizedQuery));
}

export function filterVisible(elements: Element[], includeHidden: boolean): Element[] {
  if (includeHidden) return elements;
  return elements.filter((el) => el.visible);
}

export function toPublicElements(elements: Element[]): Omit<Element, 'selector'>[] {
  return elements.map(({ selector: _s, ...rest }) => rest);
}
