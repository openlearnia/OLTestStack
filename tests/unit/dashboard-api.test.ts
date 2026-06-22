import { describe, expect, test } from 'bun:test';
import {
  dbUnavailableMessage,
  emptySessionsResponse,
  isValidUuid,
  parseSessionsQueryParams,
} from '../../src/dashboard/queries.ts';

describe('dashboard queries', () => {
  test('parseSessionsQueryParams applies defaults and caps limit', () => {
    const url = new URL('http://localhost/api/sessions');
    expect(parseSessionsQueryParams(url)).toEqual({
      page: 1,
      limit: 20,
      status: undefined,
      search: undefined,
      persistence: undefined,
    });

    const filtered = new URL(
      'http://localhost/api/sessions?page=2&limit=500&status=passed&search=login&persistence=expiring',
    );
    expect(parseSessionsQueryParams(filtered)).toEqual({
      page: 2,
      limit: 100,
      status: 'passed',
      search: 'login',
      persistence: 'expiring',
    });
  });

  test('parseSessionsQueryParams ignores invalid status', () => {
    const url = new URL('http://localhost/api/sessions?status=unknown');
    expect(parseSessionsQueryParams(url).status).toBeUndefined();
  });

  test('isValidUuid validates report ids', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUuid('not-a-uuid')).toBe(false);
  });

  test('emptySessionsResponse includes db flag and message', () => {
    const response = emptySessionsResponse('Database offline');
    expect(response.dbAvailable).toBe(false);
    expect(response.sessions).toEqual([]);
    expect(response.message).toBe('Database offline');
  });

  test('dbUnavailableMessage explains missing DATABASE_URL', () => {
    expect(dbUnavailableMessage()).toContain('DATABASE_URL');
    expect(dbUnavailableMessage('postgresql://localhost/test')).toContain('unreachable');
  });
});

describe('dashboard routes', () => {
  test('screenshotUrlForPath returns API path for basename', async () => {
    const { screenshotUrlForPath } = await import('../../src/dashboard/routes.ts');
    expect(screenshotUrlForPath('./screenshots/foo.png')).toBe('/api/screenshots/foo.png');
    expect(screenshotUrlForPath('../secrets.png')).toBeNull();
  });
});
