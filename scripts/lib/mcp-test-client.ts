/**
 * Shared MCP client helpers for OLTestStack integration scripts.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Subprocess } from 'bun';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const EXPECTED_TOOL_COUNT = 35;

const CHROME_CANDIDATES = [
  process.env.CHROMIUM_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter((path, index, arr): path is string => Boolean(path) && arr.indexOf(path) === index);

export function resolveChromiumPath(): string | undefined {
  return CHROME_CANDIDATES.find((path) => existsSync(path));
}

export const DEFAULT_HTTP_CANDIDATES = [
  'http://127.0.0.1:8082/mcp',
  'http://127.0.0.1:8092/mcp',
];

export type ToolEnvelope = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code?: string; message?: string; details?: unknown };
};

export type McpConnection = {
  client: Client;
  transport: Transport;
  transportLabel: string;
  cleanup: () => Promise<void>;
};

export function parseToolPayload(result: {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}): { raw: typeof result; parsed: ToolEnvelope | null; text?: string } {
  const text = result.content?.find((c) => c.type === 'text')?.text;
  if (!text) return { raw: result, parsed: null };
  try {
    return { raw: result, parsed: JSON.parse(text) as ToolEnvelope };
  } catch {
    return { raw: result, parsed: null, text };
  }
}

export function snippet(value: unknown, max = 240): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function findFreePort(): Promise<number> {
  const server = Bun.serve({ port: 0, fetch: () => new Response('ok') });
  const port = server.port!;
  server.stop(true);
  return port;
}

export async function probeHttp(url: string): Promise<boolean> {
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
          clientInfo: { name: 'mcp-probe', version: '1.0.0' },
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
    client = new Client({ name: 'mcp-validate', version: '1.0.0' });
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name);
    return names.length === EXPECTED_TOOL_COUNT && names.every((n) => !n.includes('.'));
  } catch {
    return false;
  } finally {
    await client?.close().catch(() => undefined);
    await transport?.close().catch(() => undefined);
  }
}

export async function findHttpUrl(candidates: string[]): Promise<string | null> {
  for (const url of candidates) {
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

export async function connectHttp(url: string, clientName = 'olteststack-mcp-test'): Promise<McpConnection> {
  const transport = new StreamableHTTPClientTransport(new URL(url));
  const client = new Client({ name: clientName, version: '1.0.0' });
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

export async function spawnHttpServer(root: string): Promise<{ url: string; proc: Subprocess }> {
  const port = await findFreePort();
  const url = `http://127.0.0.1:${port}/mcp`;
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

export async function connectStdio(root: string, clientName = 'olteststack-mcp-test'): Promise<McpConnection> {
  const chromiumPath = resolveChromiumPath();
  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['run', 'src/index.ts'],
    cwd: root,
    env: {
      ...process.env,
      MCP_TRANSPORT: 'stdio',
      HEALTH_PORT: '',
      PERSIST_RECORDING: 'false',
      ...(chromiumPath ? { CHROMIUM_EXECUTABLE_PATH: chromiumPath } : {}),
    },
  });
  const client = new Client({ name: clientName, version: '1.0.0' });
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

export type ResolveClientOptions = {
  root?: string;
  httpCandidates?: string[];
  clientName?: string;
  preferStdio?: boolean;
};

export async function resolveMcpClient(options: ResolveClientOptions = {}): Promise<McpConnection> {
  const root = options.root ?? resolve(import.meta.dir, '../..');
  const clientName = options.clientName ?? 'olteststack-mcp-test';
  const httpCandidates = [
    process.env.MCP_URL,
    ...(options.httpCandidates ?? DEFAULT_HTTP_CANDIDATES),
  ].filter((url, index, arr): url is string => Boolean(url) && arr.indexOf(url) === index);

  if (options.preferStdio || process.env.MCP_TRANSPORT === 'stdio') {
    return connectStdio(root, clientName);
  }

  const existing = await findHttpUrl(httpCandidates);
  if (existing) {
    return connectHttp(existing, clientName);
  }

  const { url, proc } = await spawnHttpServer(root);
  const connection = await connectHttp(url, clientName);
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
