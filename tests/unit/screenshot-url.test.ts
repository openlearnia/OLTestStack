import { afterEach, describe, expect, test } from 'bun:test';
import type { ResolvedConfig } from '../../src/core/config/load-config.js';
import { DEFAULT_CONFIG } from '../../src/core/config/load-config.js';
import {
  screenshotApiPathForFile,
  screenshotBasename,
  screenshotPublicHost,
  screenshotPublicPort,
  screenshotUrlForPath,
  shouldIncludeScreenshotUrl,
} from '../../src/core/screenshot-url.js';

const baseConfig: ResolvedConfig = {
  ...DEFAULT_CONFIG,
  healthPort: 8081,
  dashboardEnabled: true,
};

describe('screenshot URL helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('screenshotBasename rejects path traversal', () => {
    expect(screenshotBasename('./screenshots/foo.png')).toBe('foo.png');
    expect(screenshotBasename('../secrets.png')).toBeNull();
  });

  test('screenshotApiPathForFile encodes basename', () => {
    expect(screenshotApiPathForFile('./screenshots/foo.png')).toBe('/api/screenshots/foo.png');
    expect(screenshotApiPathForFile('./screenshots/a b.png')).toBe(
      '/api/screenshots/a%20b.png',
    );
  });

  test('screenshotPublicPort prefers APP_HOST_PORT over healthPort', () => {
    process.env.APP_HOST_PORT = '8091';
    expect(screenshotPublicPort(baseConfig)).toBe(8091);
    delete process.env.APP_HOST_PORT;
    expect(screenshotPublicPort(baseConfig)).toBe(8081);
  });

  test('screenshotPublicHost defaults to localhost', () => {
    delete process.env.SCREENSHOT_PUBLIC_HOST;
    expect(screenshotPublicHost()).toBe('localhost');
    process.env.SCREENSHOT_PUBLIC_HOST = 'host.docker.internal';
    expect(screenshotPublicHost()).toBe('host.docker.internal');
  });

  test('shouldIncludeScreenshotUrl requires a public port and server signals', () => {
    expect(shouldIncludeScreenshotUrl({ ...DEFAULT_CONFIG })).toBe(false);
    expect(shouldIncludeScreenshotUrl(baseConfig)).toBe(true);
    expect(
      shouldIncludeScreenshotUrl({
        ...DEFAULT_CONFIG,
        mcpTransport: 'http',
        healthPort: 8081,
      }),
    ).toBe(true);
  });

  test('screenshotUrlForPath builds full URL with host port mapping', () => {
    process.env.APP_HOST_PORT = '8091';
    expect(screenshotUrlForPath('./screenshots/2026-01-01_page.png', baseConfig)).toBe(
      'http://localhost:8091/api/screenshots/2026-01-01_page.png',
    );
  });

  test('screenshotUrlForPath omitted when health server unavailable', () => {
    expect(
      screenshotUrlForPath('./screenshots/foo.png', { ...DEFAULT_CONFIG, dashboardEnabled: false }),
    ).toBeNull();
  });
});
