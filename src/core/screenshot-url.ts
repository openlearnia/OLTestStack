import type { ResolvedConfig } from './config/load-config.js';

function parseInteger(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function screenshotBasename(path: string): string | null {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.includes('..')) return null;
  const parts = normalized.split('/');
  const name = parts[parts.length - 1];
  if (!name || name.includes('/')) return null;
  return name;
}

/** Relative API path for a screenshot file (e.g. `/api/screenshots/foo.png`). */
export function screenshotApiPathForFile(filePath: string): string | null {
  const name = screenshotBasename(filePath);
  return name ? `/api/screenshots/${encodeURIComponent(name)}` : null;
}

export function screenshotPublicHost(): string {
  return process.env.SCREENSHOT_PUBLIC_HOST ?? 'localhost';
}

export function screenshotPublicPort(config: ResolvedConfig): number | undefined {
  return parseInteger(process.env.APP_HOST_PORT) ?? config.healthPort;
}

/** Whether HTTP screenshot URLs can be fetched from the health/dashboard server. */
export function shouldIncludeScreenshotUrl(config: ResolvedConfig): boolean {
  const port = screenshotPublicPort(config);
  if (port === undefined) return false;
  return (
    config.healthPort !== undefined ||
    config.dashboardEnabled ||
    config.mcpTransport === 'http'
  );
}

/** Full fetchable URL when the health server can serve `/api/screenshots/:filename`. */
export function screenshotUrlForPath(filePath: string, config: ResolvedConfig): string | null {
  if (!shouldIncludeScreenshotUrl(config)) return null;
  const apiPath = screenshotApiPathForFile(filePath);
  if (!apiPath) return null;
  const port = screenshotPublicPort(config);
  if (port === undefined) return null;
  const host = screenshotPublicHost();
  return `http://${host}:${port}${apiPath}`;
}
