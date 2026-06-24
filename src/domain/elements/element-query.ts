import type { Element } from '../../core/types/sessions.js';

/** Derive a replay query from element metadata when no explicit query was stored. */
export function elementToQuery(element: Element): string {
  const text = element.text.trim();
  if (text.length > 0) return text;
  return element.role;
}

/**
 * Resolve the query to persist on recorded click/type actions.
 * Priority: MCP input query → discoveredQuery from page_find → text → role.
 */
export function resolveRecordingQuery(element: Element, explicitQuery?: string): string {
  if (explicitQuery && explicitQuery.length > 0) return explicitQuery;
  if (element.discoveredQuery && element.discoveredQuery.length > 0) {
    return element.discoveredQuery;
  }
  return elementToQuery(element);
}
