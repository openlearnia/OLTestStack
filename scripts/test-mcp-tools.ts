#!/usr/bin/env bun
/**
 * Full MCP tool-flow test via @modelcontextprotocol/sdk (Streamable HTTP).
 *
 * Exercises browser automation against fixtures/sample-app/index.html.
 * Auto-spawns a local HTTP server on :8082 when none is reachable.
 *
 * Usage:
 *   bun run test:mcp
 *   MCP_URL=http://localhost:8092/mcp bun run test:mcp:docker
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Subprocess } from 'bun';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const LOCAL_MCP_PORT = 8082;
const LOCAL_MCP_URL = `http://127.0.0.1:${LOCAL_MCP_PORT}/mcp`;

const CHROME_CANDIDATES = [
  process.env.CHROMIUM_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter((path, index, arr): path is string => Boolean(path) && arr.indexOf(path) === index);

type ToolPayload = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: unknown;
};

type StepResult = {
  tool: string;
  pass: boolean;
  note?: string;
};

type McpConnection = {
  client: Client;
  transport: Transport;
  transportLabel: string;
  cleanup: () => Promise<void>;
};

function resolveChromiumPath(): string | undefined {
  return CHROME_CANDIDATES.find((path) => existsSync(path));
}

function httpCandidates(): string[] {
  return [process.env.MCP_URL, LOCAL_MCP_URL].filter(
    (url, index, arr): url is string => Boolean(url) && arr.indexOf(url) === index,
  );
}

function parseToolPayload(result: {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}): { raw: typeof result; parsed: ToolPayload | null; text?: string } {
  const text = result.content?.find((c) => c.type === 'text')?.text;
  if (!text) return { raw: result, parsed: null };
  try {
    return { raw: result, parsed: JSON.parse(text) as ToolPayload, text };
  } catch {
    return { raw: result, parsed: null, text };
  }
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function truncate(value: unknown, max = 240): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
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
          clientInfo: { name: 'mcp-tools-probe', version: '1.0.0' },
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
    client = new Client({ name: 'mcp-tools-validate', version: '1.0.0' });
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name);
    return names.includes('browser_launch') && !names.some((n) => n.includes('.'));
  } catch {
    return false;
  } finally {
    await client?.close().catch(() => undefined);
    await transport?.close().catch(() => undefined);
  }
}

async function findHttpUrl(): Promise<string | null> {
  for (const url of httpCandidates()) {
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
  const client = new Client({ name: 'olteststack-mcp-tools', version: '1.0.0' });
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
  const url = LOCAL_MCP_URL;
  const root = resolve(import.meta.dir, '..');
  const chromiumPath = resolveChromiumPath();

  const proc = Bun.spawn({
    cmd: ['bun', 'run', 'src/index.ts'],
    cwd: root,
    env: {
      ...process.env,
      MCP_TRANSPORT: 'http',
      MCP_HTTP_HOST: '127.0.0.1',
      MCP_HTTP_PORT: String(LOCAL_MCP_PORT),
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

async function resolveClient(): Promise<McpConnection> {
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

function printStepHeader(tool: string, input?: unknown): void {
  console.log('');
  console.log(`── ${tool} ${'─'.repeat(Math.max(0, 52 - tool.length))}`);
  if (input !== undefined) {
    console.log('input:', formatJson(input));
  }
}

function printPayload(payload: ReturnType<typeof parseToolPayload>): void {
  if (payload.parsed) {
    if (payload.parsed.ok) {
      console.log('response: ok');
      if (payload.parsed.data) {
        console.log('data:', formatJson(payload.parsed.data));
      }
    } else {
      console.log('response: error');
      console.log('error:', formatJson(payload.parsed.error ?? payload.parsed));
    }
    return;
  }
  console.log('response: (unparsed)');
  console.log(truncate(payload.text ?? payload.raw));
}

function printSummary(steps: StepResult[], transportLabel: string): void {
  const toolWidth = Math.max(16, ...steps.map((s) => s.tool.length));
  console.log('');
  console.log('Summary');
  console.log(`${'Tool'.padEnd(toolWidth)}  Result  Note`);
  console.log(`${'─'.repeat(toolWidth)}  ──────  ────`);
  for (const step of steps) {
    const status = step.pass ? 'PASS' : 'FAIL';
    console.log(`${step.tool.padEnd(toolWidth)}  ${status}    ${step.note ?? ''}`);
  }
  const failed = steps.filter((s) => !s.pass).length;
  console.log('');
  console.log(`Transport: ${transportLabel}`);
  console.log(`Result: ${steps.length - failed}/${steps.length} passed`);
}

async function main(): Promise<number> {
  const steps: StepResult[] = [];
  let connection: McpConnection | null = null;
  let transportLabel = 'unknown';

  const record = (tool: string, pass: boolean, note?: string) => {
    steps.push({ tool, pass, note });
    console.log(pass ? '→ PASS' : '→ FAIL', note ? `(${note})` : '');
  };

  try {
    connection = await resolveClient();
    transportLabel = connection.transportLabel;
    console.log(`Connected via ${transportLabel}`);

    // 1. tools/list
    printStepHeader('tools/list');
    const tools = await connection.client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    const listOk = names.length > 0 && names.includes('browser_launch');
    printPayload({
      raw: {},
      parsed: { ok: listOk, data: { count: names.length, tools: names } },
    });
    record('tools/list', listOk, `${names.length} tools`);

    // 2. browser_launch
    const launchInput = { headless: true };
    printStepHeader('browser_launch', launchInput);
    const launch = parseToolPayload(
      await connection.client.callTool({ name: 'browser_launch', arguments: launchInput }),
    );
    printPayload(launch);
    const browserId = launch.parsed?.ok ? String(launch.parsed.data?.browserId ?? '') : '';
    record('browser_launch', Boolean(browserId));
    if (!browserId) throw new Error('browser_launch failed');

    // 3. page_create
    const createInput = { browserId };
    printStepHeader('page_create', createInput);
    const page = parseToolPayload(
      await connection.client.callTool({ name: 'page_create', arguments: createInput }),
    );
    printPayload(page);
    const pageId = page.parsed?.ok ? String(page.parsed.data?.pageId ?? '') : '';
    record('page_create', Boolean(pageId));
    if (!pageId) throw new Error('page_create failed');

    // 4. page_navigate
    const samplePath = resolve(import.meta.dir, '../fixtures/sample-app/index.html');
    const navUrl = process.env.TEST_NAV_URL ?? `file://${samplePath}`;
    const navInput = { pageId, url: navUrl };
    printStepHeader('page_navigate', navInput);
    const nav = parseToolPayload(
      await connection.client.callTool({ name: 'page_navigate', arguments: navInput }),
    );
    printPayload(nav);
    record('page_navigate', nav.parsed?.ok === true);

    // 5. page_elements
    const elementsInput = { pageId };
    printStepHeader('page_elements', elementsInput);
    const elements = parseToolPayload(
      await connection.client.callTool({ name: 'page_elements', arguments: elementsInput }),
    );
    printPayload(elements);
    const elementCount = elements.parsed?.ok ? Number(elements.parsed.data?.count ?? 0) : 0;
    record('page_elements', elements.parsed?.ok === true && elementCount > 0, `count=${elementCount}`);

    // 6. page_find
    const findInput = { pageId, query: 'Submit' };
    printStepHeader('page_find', findInput);
    const found = parseToolPayload(
      await connection.client.callTool({ name: 'page_find', arguments: findInput }),
    );
    printPayload(found);
    const findData = found.parsed?.data as { element?: { elementId?: string } } | undefined;
    const elementId = found.parsed?.ok ? String(findData?.element?.elementId ?? '') : '';
    record('page_find', Boolean(elementId), elementId ? 'Submit button' : 'not found');

    // 7. page_click (if element found)
    if (elementId) {
      const clickInput = { pageId, elementId };
      printStepHeader('page_click', clickInput);
      const click = parseToolPayload(
        await connection.client.callTool({ name: 'page_click', arguments: clickInput }),
      );
      printPayload(click);
      record('page_click', click.parsed?.ok === true);
    } else {
      record('page_click', false, 'skipped — no element');
    }

    // 8. page_screenshot
    const screenshotInput = { pageId };
    printStepHeader('page_screenshot', screenshotInput);
    const screenshot = parseToolPayload(
      await connection.client.callTool({ name: 'page_screenshot', arguments: screenshotInput }),
    );
    printPayload(screenshot);
    const screenshotFile = screenshot.parsed?.ok
      ? String(screenshot.parsed.data?.file ?? screenshot.parsed.data?.path ?? '')
      : '';
    record('page_screenshot', screenshot.parsed?.ok === true && Boolean(screenshotFile));

    // 9. assert_text
    const assertInput = { pageId, contains: 'Login' };
    printStepHeader('assert_text', assertInput);
    const assertText = parseToolPayload(
      await connection.client.callTool({ name: 'assert_text', arguments: assertInput }),
    );
    printPayload(assertText);
    record('assert_text', assertText.parsed?.ok === true);

    // 10. session_export
    const exportInput = {
      browserId,
      name: 'MCP tools test',
      goal: 'Exercise full browser tool flow via MCP SDK client',
    };
    printStepHeader('session_export', exportInput);
    const exported = parseToolPayload(
      await connection.client.callTool({ name: 'session_export', arguments: exportInput }),
    );
    printPayload(exported);
    const hasScript = exported.parsed?.ok && Boolean(exported.parsed.data?.script);
    record('session_export', Boolean(hasScript));

    // 11. browser_close
    const closeInput = { browserId };
    printStepHeader('browser_close', closeInput);
    const close = parseToolPayload(
      await connection.client.callTool({ name: 'browser_close', arguments: closeInput }),
    );
    printPayload(close);
    record('browser_close', close.parsed?.ok === true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('');
    console.error('Fatal:', message);
    if (!steps.some((s) => s.tool === 'fatal')) {
      steps.push({ tool: 'fatal', pass: false, note: message });
    }
  } finally {
    if (connection) await connection.cleanup().catch(() => undefined);
    printSummary(steps, transportLabel);
  }

  return steps.every((s) => s.pass) ? 0 : 1;
}

const code = await main();
process.exit(code);
