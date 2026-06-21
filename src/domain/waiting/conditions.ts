export const NETWORK_IDLE_QUIET_MS = 500;
export const WAIT_POLL_MS = 100;

export type UrlMatchMode = 'equals' | 'contains';

export function matchesUrl(currentUrl: string, expected: string, match: UrlMatchMode = 'contains'): boolean {
  if (match === 'equals') {
    return currentUrl === expected;
  }
  return currentUrl.includes(expected);
}

export function isNetworkIdle(
  inFlightCount: number,
  lastActivityMs: number,
  nowMs: number = Date.now(),
  quietMs: number = NETWORK_IDLE_QUIET_MS,
): boolean {
  if (inFlightCount > 0) return false;
  return nowMs - lastActivityMs >= quietMs;
}
