import { v4 as uuidv4 } from 'uuid';
import type { CdpNode } from '../../cdp/adapter.js';
import type { Element } from '../../core/types/sessions.js';
import { truncateText } from '../../core/types/sessions.js';

export const MAX_ELEMENTS = 200;

const TYPEABLE_TAGS = new Set(['input', 'textarea']);
const TYPEABLE_ROLES = new Set(['textbox', 'searchbox']);

export interface RankedMatch {
  element: Element;
  score: number;
  reason: string;
}

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

function regionScore(regionHint?: string): number {
  switch (regionHint) {
    case 'toolbar':
    case 'filter':
      return 40;
    case 'grid-header':
      return -35;
    case 'grid-body':
      return 5;
    default:
      return 0;
  }
}

function tagScore(tag?: string): number {
  switch (tag?.toLowerCase()) {
    case 'input':
    case 'textarea':
      return 50;
    case 'button':
      return 20;
    case 'select':
      return -15;
    default:
      return 0;
  }
}

function roleScore(role: string): number {
  switch (role.toLowerCase()) {
    case 'textbox':
    case 'searchbox':
      return 35;
    case 'columnheader':
      return -40;
    case 'gridcell':
      return 10;
    case 'combobox':
      return -10;
    default:
      return 0;
  }
}

export function scoreFindMatch(element: Element, query: string, regionHint?: string): number {
  const normalizedQuery = query.toLowerCase();
  const text = element.text.toLowerCase();
  const role = element.role.toLowerCase();
  const tag = element.tag?.toLowerCase();

  let score = tagScore(tag) + roleScore(role) + regionScore(regionHint);

  if (TYPEABLE_TAGS.has(tag ?? '') || TYPEABLE_ROLES.has(role)) {
    score += 25;
  }

  if (role === 'columnheader') {
    score -= 30;
  }

  if (text === normalizedQuery) {
    score += 15;
  } else if (text.includes(normalizedQuery)) {
    score += 5;
  }

  if (tag === 'label' || (role === 'generic' && !TYPEABLE_TAGS.has(tag ?? ''))) {
    score -= 25;
  }

  return score;
}

export function explainFindMatch(element: Element, query: string, regionHint?: string): string {
  const tag = element.tag?.toLowerCase();
  const role = element.role.toLowerCase();

  if (regionHint === 'filter' || regionHint === 'toolbar') {
    return 'toolbar/filter region';
  }
  if (TYPEABLE_TAGS.has(tag ?? '') || TYPEABLE_ROLES.has(role)) {
    return 'typeable input element';
  }
  if (role === 'columnheader') {
    return 'column header (deprioritized vs filter inputs)';
  }
  if (tag === 'select' || role === 'combobox') {
    return 'select/combobox element';
  }
  if (tag === 'button' || role === 'button') {
    return 'button element';
  }
  if (element.text.toLowerCase().includes(query.toLowerCase())) {
    return 'text match';
  }
  return 'role or label match';
}

export function rankFindMatches(
  elements: Element[],
  query: string,
  regionHints?: Map<string, string>,
): RankedMatch[] {
  return elements
    .map((element) => {
      const regionHint = element.selector ? regionHints?.get(element.selector) : undefined;
      const score = scoreFindMatch(element, query, regionHint);
      return {
        element,
        score,
        reason: explainFindMatch(element, query, regionHint),
      };
    })
    .sort((a, b) => b.score - a.score);
}
