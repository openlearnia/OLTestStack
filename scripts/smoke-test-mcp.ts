#!/usr/bin/env bun
/**
 * End-to-end MCP smoke test for OLTestStack.
 *
 * Prefers Streamable HTTP (reliable for programmatic testing). Falls back to
 * spawning a local HTTP server when none is reachable. Stdio is opt-in only.
 *
 * Usage:
 *   bun run smoke
 *   MCP_URL=http://127.0.0.1:8092/mcp bun run smoke
 *   MCP_TRANSPORT=stdio bun run smoke   # opt-in; may hit WritableIterable issues in Bun
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Subprocess } from 'bun';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const EXPECTED_TOOL_COUNT = 26;
const CHROME_CANDIDATES = [
  process.env.CHROMIUM_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter((path, index, arr): path is string => Boolean(path) && arr.indexOf(path) === index);

function resolveChromiumPath(): string | undefined {
  return CHROME_CANDIDATES.find((path) => existsSync(path));
}
const HTTP_CANDIDATES = [
  process.env.MCP_URL,
  'http://127.0.0.1:8092/mcp',
  'http://127.0.0.1:8082/mcp',
].filter((url, index, arr): url is string => Boolean(url) && arr.indexOf(url) === index);

type StepResult = {
  name: string;
  pass: boolean;
  snippet?: string;
  error?: string;
};

type McpConnection = {
  client: Client;
  transport: Transport;
  transportLabel: string;
  cleanup: () => Promise<void>;
};

function snippet(value: unknown, max = 200): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function parseToolPayload(result: { content?: Array<{ type: string; text?: string }>; isError?: boolean }) {
  const text = result.content?.find((c) => c.type === 'text')?.text;
  if (!text) return { raw: result, parsed: null as unknown };
  try {
    return { raw: result, parsed: JSON.parse(text) as { ok: boolean; data?: Record<string, unknown>; error?: unknown } };
  } catch {
    return { raw: result, parsed: null as unknown, text };
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function findFreePort(): Promise<number> {
  const server = Bun.serve({ port: 0, fetch: () => new Response('ok') });
  const port = server.port!;
  server.stop(true);
  return port;
}

async function probeHttp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'smoke-probe', version: '1.0.0' },
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function validateOlteststack(url: string): Promise<boolean> {
  let transport: StreamableHTTPClientTransport | null = null;
  let client: Client | null = null;
  try {
    transport = new StreamableHTTPClientTransport(new URL(url));
    client = new Client({ name: 'smoke-validate', version: '1.0.0' });
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name);
    const countOk = names.length === EXPECTED_TOOL_COUNT;
    const underscoreOnly = names.every((n) => !n.includes('.'));
    return countOk && underscoreOnly;
  } catch {
    return false;
  } finally {
    await client?.close().catch(() => undefined);
    await transport?.close().catch(() => undefined);
  }
}

async function findHttpUrl(): Promise<string | null> {
  for (const url of HTTP_CANDIDATES) {
    if (!(await probeHttp(url))) continue;
    if (await validateOlteststack(url)) return url;
  }
  return null;
}

async function waitForHttp(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probeHttp(url)) return true;
    await sleep(250);
  }
  return false;
}

async function connectHttp(url: string): Promise<McpConnection> {
  const transport = new StreamableHTTPClientTransport(new URL(url));
  const client = new Client({ name: 'olteststack-smoke', version: '1.0.0' });
  await client.connect(transport);
  return {
    client,
    transport,
    transportLabel: `http (${url})`,
    cleanup: async () => {
      await client.close().catch(() => undefined);
      await transport.close().catch(() => undefined);
    },
  };
}

async function spawnHttpServer(): Promise<{ url: string; proc: Subprocess }> {
  const port = await findFreePort();
  const url = `http://127.0.0.1:${port}/mcp`;
  const root = resolve(import.meta.dir, '..');

  const chromiumPath = resolveChromiumPath();
  const proc = Bun.spawn({
    cmd: ['bun', 'run', 'src/index.ts'],
    cwd: root,
    env: {
      ...process.env,
      MCP_TRANSPORT: 'http',
      MCP_HTTP_HOST: '127.0.0.1',
      MCP_HTTP_PORT: String(port),
      HEALTH_PORT: '',
      PERSIST_RECORDING: 'false',
      ...(chromiumPath ? { CHROMIUM_EXECUTABLE_PATH: chromiumPath } : {}),
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const ready = await waitForHttp(url);
  if (!ready) {
    proc.kill();
    throw new Error(`Timed out waiting for spawned MCP HTTP server at ${url}`);
  }

  return { url, proc };
}

async function connectStdio(): Promise<McpConnection> {
  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['run', 'src/index.ts'],
    cwd: resolve(import.meta.dir, '..'),
    env: {
      ...process.env,
      MCP_TRANSPORT: 'stdio',
      HEALTH_PORT: '',
      PERSIST_RECORDING: 'false',
    },
  });
  const client = new Client({ name: 'olteststack-smoke', version: '1.0.0' });
  await client.connect(transport);
  return {
    client,
    transport,
    transportLabel: 'stdio',
    cleanup: async () => {
      await client.close().catch(() => undefined);
      await transport.close().catch(() => undefined);
    },
  };
}

async function resolveClient(): Promise<McpConnection> {
  if (process.env.MCP_TRANSPORT === 'stdio') {
    return connectStdio();
  }

  const existing = await findHttpUrl();
  if (existing) {
    return connectHttp(existing);
  }

  const { url, proc } = await spawnHttpServer();
  const connection = await connectHttp(url);
  const baseCleanup = connection.cleanup;
  return {
    ...connection,
    transportLabel: `http (spawned ${url})`,
    cleanup: async () => {
      await baseCleanup();
      if (!proc.killed) {
        proc.kill();
        await proc.exited.catch(() => undefined);
      }
    },
  };
}

async function main(): Promise<number> {
  const steps: StepResult[] = [];
  let connection: McpConnection | null = null;
  let transportLabel = 'unknown';
  let browserId: string | undefined;

  const record = (step: StepResult) => {
    steps.push(step);
    const icon = step.pass ? 'PASS' : 'FAIL';
    console.log(`[${icon}] ${step.name}${step.snippet ? ` — ${step.snippet}` : ''}${step.error ? ` — ${step.error}` : ''}`);
  };

  try {
    connection = await resolveClient();
    transportLabel = connection.transportLabel;
    record({ name: 'connect', pass: true, snippet: transportLabel });

    const tools = await connection.client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    const underscoreOnly = names.every((n) => !n.includes('.'));
    const countOk = names.length === EXPECTED_TOOL_COUNT;
    record({
      name: 'tools/list',
      pass: countOk && underscoreOnly,
      snippet: `${names.length} tools: ${names.slice(0, 5).join(', ')}${names.length > 5 ? ', …' : ''}`,
      error: !countOk
        ? `expected ${EXPECTED_TOOL_COUNT}, got ${names.length}`
        : !underscoreOnly
          ? 'found dotted tool names'
          : undefined,
    });

    const launch = parseToolPayload(
      await connection.client.callTool({ name: 'browser_launch', arguments: { headless: true } }),
    );
    browserId = launch.parsed?.ok ? String(launch.parsed.data?.browserId ?? '') : undefined;
    record({
      name: 'browser_launch',
      pass: Boolean(browserId),
      snippet: browserId ? `browserId=${browserId}` : snippet(launch.parsed ?? launch.raw),
      error: browserId ? undefined : 'missing browserId',
    });
    if (!browserId) throw new Error('browser_launch failed');

    const page = parseToolPayload(
      await connection.client.callTool({ name: 'page_create', arguments: { browserId } }),
    );
    const pageId = page.parsed?.ok ? String(page.parsed.data?.pageId ?? '') : '';
    record({
      name: 'page_create',
      pass: Boolean(pageId),
      snippet: pageId ? `pageId=${pageId}` : snippet(page.parsed ?? page.raw),
      error: pageId ? undefined : 'missing pageId',
    });
    if (!pageId) throw new Error('page_create failed');

    const samplePath = resolve(import.meta.dir, '../fixtures/sample-app/index.html');
    const navUrl = process.env.SMOKE_NAV_URL ?? `file://${samplePath}`;
    const nav = parseToolPayload(
      await connection.client.callTool({ name: 'page_navigate', arguments: { pageId, url: navUrl } }),
    );
    record({
      name: 'page_navigate',
      pass: nav.parsed?.ok === true,
      snippet: `url=${navUrl}`,
      error: nav.parsed?.ok ? undefined : snippet(nav.parsed?.error ?? nav.raw),
    });

    const elements = parseToolPayload(
      await connection.client.callTool({ name: 'page_elements', arguments: { pageId } }),
    );
    const count = elements.parsed?.ok ? Number(elements.parsed.data?.count ?? 0) : 0;
    record({
      name: 'page_elements',
      pass: elements.parsed?.ok === true && count > 0,
      snippet: `count=${count}`,
      error: elements.parsed?.ok && count > 0 ? undefined : snippet(elements.parsed?.error ?? elements.raw),
    });

    const close = parseToolPayload(
      await connection.client.callTool({ name: 'browser_close', arguments: { browserId } }),
    );
    record({
      name: 'browser_close',
      pass: close.parsed?.ok === true,
      snippet: close.parsed?.ok ? 'closed' : snippet(close.parsed?.error ?? close.raw),
    });
    if (close.parsed?.ok) {
      browserId = undefined;
    }
  } catch (error) {
    record({
      name: 'fatal',
      pass: false,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (connection && browserId) {
      await connection.client
        .callTool({ name: 'browser_close', arguments: { browserId } })
        .catch(() => undefined);
    }
    if (connection) await connection.cleanup().catch(() => undefined);
  }

  const failed = steps.filter((s) => !s.pass).length;
  console.log('');
  console.log(`Transport: ${transportLabel}`);
  console.log(`Steps: ${steps.length - failed}/${steps.length} passed`);
  return failed === 0 ? 0 : 1;
}

const code = await main();
process.exit(code);
