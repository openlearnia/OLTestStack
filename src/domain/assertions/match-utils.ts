import type { NetworkEntry } from '../../cdp/adapter.js';
import { matchesUrl, type UrlMatchMode } from '../waiting/conditions.js';

export const TEXT_SNIPPET_MAX = 200;

export function matchesText(
  pageText: string,
  expected: string,
  match: 'contains' | 'equals' = 'contains',
): boolean {
  if (match === 'equals') {
    return pageText === expected;
  }
  return pageText.includes(expected);
}

export function textSnippet(pageText: string, maxLength = TEXT_SNIPPET_MAX): string {
  if (pageText.length <= maxLength) return pageText;
  return `${pageText.slice(0, maxLength - 3)}...`;
}

export { matchesUrl, type UrlMatchMode };

export function matchesNetworkStatus(status: number, expected: number | string): boolean {
  if (typeof expected === 'number') {
    return status === expected;
  }
  const rangeMatch = /^([1-5])xx$/.exec(expected);
  if (!rangeMatch) return false;
  const hundreds = Number(rangeMatch[1]) * 100;
  return status >= hundreds && status < hundreds + 100;
}

export function findMatchingNetworkRequest(
  entries: NetworkEntry[],
  urlSubstring: string,
  status: number | string,
): NetworkEntry | undefined {
  const needle = urlSubstring.toLowerCase();
  return entries.find(
    (entry) =>
      entry.url.toLowerCase().includes(needle) && matchesNetworkStatus(entry.status, status),
  );
}

export function countPartialUrlMatches(entries: NetworkEntry[], urlSubstring: string): number {
  const needle = urlSubstring.toLowerCase();
  return entries.filter((entry) => entry.url.toLowerCase().includes(needle)).length;
}

export function isValidNetworkStatusInput(status: unknown): status is number | string {
  if (typeof status === 'number') {
    return Number.isInteger(status) && status >= 100 && status <= 599;
  }
  if (typeof status === 'string') {
    return /^[1-5]xx$/.test(status);
  }
  return false;
}
