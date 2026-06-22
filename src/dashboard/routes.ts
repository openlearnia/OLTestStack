import { join, resolve } from 'node:path';
import type { ResolvedConfig } from '../core/config/load-config.js';
import { getDb } from '../db/client.js';
import { probeDatabase } from '../db/health.js';
import { promoteSessionToSaved } from '../db/save-session-db.js';
import {
  dbUnavailableMessage,
  emptySessionsResponse,
  getSessionDetail,
  getSessionEvents,
  isValidUuid,
  listSessions,
  parseSessionsQueryParams,
} from './queries.js';

const PUBLIC_DIR = join(import.meta.dir, 'public');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function notFound(message = 'Not Found'): Response {
  return new Response(message, { status: 404 });
}

async function serveStaticFile(relativePath: string): Promise<Response | null> {
  const safePath = relativePath.replace(/^\/+/, '');
  const filePath = resolve(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return notFound();
  }

  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return null;
  }

  const ext = safePath.includes('.') ? `.${safePath.split('.').pop()}` : '';
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

  return new Response(file, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    },
  });
}

function screenshotBasename(path: string): string | null {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.includes('..')) return null;
  const parts = normalized.split('/');
  const name = parts[parts.length - 1];
  if (!name || name.includes('/')) return null;
  return name;
}

async function serveScreenshot(config: ResolvedConfig, filename: string): Promise<Response> {
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return notFound();
  }

  const filePath = resolve(config.screenshotDir, filename);
  const screenshotRoot = resolve(config.screenshotDir);

  if (!filePath.startsWith(screenshotRoot)) {
    return notFound();
  }

  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return notFound('Screenshot not found');
  }

  return new Response(file, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

async function handleSaveSession(
  config: ResolvedConfig,
  reportId: string,
  request: Request,
): Promise<Response> {
  if (!isValidUuid(reportId)) {
    return jsonResponse({ error: 'Invalid session id' }, 400);
  }

  const db = getDb(config);
  if (!db) {
    return jsonResponse({ error: dbUnavailableMessage(config.databaseUrl) }, 503);
  }

  let name: string | undefined;
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = (await request.json()) as { name?: string };
      if (typeof body.name === 'string' && body.name.trim()) {
        name = body.name.trim();
      }
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }
  }

  const result = await promoteSessionToSaved(db, reportId, name);
  if (!result) {
    return jsonResponse({ error: 'Session not found' }, 404);
  }

  return jsonResponse(result);
}

async function handleApiSessions(config: ResolvedConfig, request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (!config.databaseUrl) {
    return jsonResponse(emptySessionsResponse(dbUnavailableMessage()), 503);
  }

  const db = getDb(config);
  if (!db) {
    return jsonResponse(emptySessionsResponse(dbUnavailableMessage(config.databaseUrl)), 503);
  }

  try {
    await probeDatabase(db);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse(emptySessionsResponse(message), 503);
  }

  const saveMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/save$/);
  if (saveMatch) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    return handleSaveSession(config, saveMatch[1], request);
  }

  const sessionIdMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)(?:\/(events))?$/);
  if (sessionIdMatch) {
    const [, rawId, subPath] = sessionIdMatch;
    if (!isValidUuid(rawId)) {
      return jsonResponse({ error: 'Invalid session id' }, 400);
    }

    if (subPath === 'events') {
      const result = await getSessionEvents(db, rawId);
      if (!result) {
        return jsonResponse({ error: 'Session not found' }, 404);
      }
      return jsonResponse(result);
    }

    const detail = await getSessionDetail(db, rawId);
    if (!detail) {
      return jsonResponse({ error: 'Session not found' }, 404);
    }
    return jsonResponse(detail);
  }

  if (url.pathname === '/api/sessions') {
    const params = parseSessionsQueryParams(url);
    const result = await listSessions(db, params);
    return jsonResponse(result);
  }

  return notFound();
}

async function handleDashboardStatic(url: URL): Promise<Response> {
  let relativePath = url.pathname.replace(/^\/dashboard\/?/, '') || 'index.html';

  if (relativePath.endsWith('/')) {
    relativePath += 'index.html';
  }

  if (!relativePath.includes('.')) {
    relativePath = 'index.html';
  }

  const response = await serveStaticFile(relativePath);
  return response ?? notFound();
}

export async function handleDashboardRequest(
  config: ResolvedConfig,
  request: Request,
): Promise<Response | null> {
  if (!config.dashboardEnabled) {
    return null;
  }

  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/sessions')) {
    const method = request.method;
    const isSave = /\/save$/.test(url.pathname);
    if (method !== 'GET' && !(isSave && method === 'POST')) {
      return new Response('Method Not Allowed', { status: 405 });
    }
    return handleApiSessions(config, request);
  }

  const screenshotMatch = url.pathname.match(/^\/api\/screenshots\/([^/]+)$/);
  if (screenshotMatch) {
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    return serveScreenshot(config, decodeURIComponent(screenshotMatch[1]));
  }

  if (url.pathname === '/dashboard' || url.pathname.startsWith('/dashboard/')) {
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    return handleDashboardStatic(url);
  }

  return null;
}

export function screenshotUrlForPath(path: string): string | null {
  const name = screenshotBasename(path);
  return name ? `/api/screenshots/${encodeURIComponent(name)}` : null;
}
