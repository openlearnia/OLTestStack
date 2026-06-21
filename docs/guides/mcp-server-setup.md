# MCP Server Setup

This guide walks through installing, configuring, and verifying the OLTestStack MCP server so AI agents can drive Chromium for browser testing.

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| [Bun](https://bun.sh) 1.0+ | Primary runtime (`bun install`, `bun run dev`). Node.js 20+ also works via `node`. |
| Chromium | Bundled with Puppeteer on first install. Override with `CHROMIUM_EXECUTABLE_PATH` if needed. |
| Docker (optional) | Required for HTTP-in-Docker deployment and when persisting recordings/reports to PostgreSQL (`PERSIST_RECORDING=true`). |

## Why stdio vs HTTP?

OLTestStack supports two MCP wire transports:

| Transport | How it works | Best for |
|-----------|--------------|----------|
| **stdio** (default) | The MCP client (Cursor, Claude Desktop) spawns `bun run dev` as a child process and speaks JSON-RPC over stdin/stdout. | Local IDE integration — zero ports, simplest setup. This is the MCP SDK default and what most desktop clients expect. |
| **HTTP** (Streamable HTTP) | A long-running server listens on a TCP port (`/mcp`). Clients connect over HTTP with session headers. | Docker containers, remote hosts, multiple clients, CI runners that cannot spawn local processes. |

**Why was stdio the original default?** Cursor and Claude Desktop natively spawn MCP servers as subprocesses. Stdio needs no open ports, no bind-address decisions, and no auth layer for V1 — perfect for “run beside my editor.” HTTP was not required until Docker/remote access became a goal.

### Port reference

| Service | Default port | Notes |
|---------|--------------|-------|
| PostgreSQL (Docker) | **5433** (host) → 5432 (container) | `POSTGRES_HOST_PORT` |
| HTTP health | **8081** | `GET /health` when `HEALTH_PORT` is set |
| MCP Streamable HTTP | **8082** | `POST/GET/DELETE /mcp` when `MCP_TRANSPORT=http` |

## Installation

Clone the repository and install dependencies:

```bash
cd /path/to/OLTestStack
bun install
bun run typecheck
```

Puppeteer downloads Chromium on first run if it is not already cached. On CI or restricted networks, set `CHROMIUM_EXECUTABLE_PATH` to a system Chromium binary.

## Running the server

### Development — stdio (default)

```bash
bun run dev
```

This starts the MCP server on stdio. The process blocks until the client disconnects.

### Development — HTTP (local)

```bash
bun run dev:http
```

Starts Streamable HTTP on `http://127.0.0.1:8082/mcp` plus health on `http://127.0.0.1:8081/health`.

Or set env vars explicitly:

```bash
MCP_TRANSPORT=http MCP_HTTP_HOST=127.0.0.1 MCP_HTTP_PORT=8082 HEALTH_PORT=8081 bun run dev
```

### Production build

```bash
bun run build
MCP_TRANSPORT=http bun run start   # HTTP mode
bun run start                        # stdio mode (default)
```

### Important: stdout vs stderr (stdio mode only)

The MCP protocol uses **stdout** for JSON-RPC messages. All diagnostics must go to **stderr**. Do not pipe server logs to stdout or wrap the process in tools that write to stdout.

On successful stdio start you should see on stderr:

```
[olteststack] MCP server started on stdio
```

HTTP mode logs endpoints to stderr instead:

```
[olteststack] Health server listening on :8081
[olteststack] MCP HTTP server listening on http://127.0.0.1:8082/mcp
```

## Docker deployment (HTTP)

Run Postgres + MCP server in containers:

```bash
cp .env.example .env
docker compose up -d postgres
docker compose --profile migrate run --rm migrate
docker compose --profile app up -d
```

Verify:

```bash
curl http://localhost:8081/health
# {"status":"ok","service":"olteststack"}

curl -s -X POST http://localhost:8082/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}'
# Returns JSON-RPC initialize result with mcp-session-id header
```

The Docker `app` service sets `MCP_TRANSPORT=http`, binds `MCP_HTTP_HOST=0.0.0.0`, and exposes ports **8081** (health) and **8082** (MCP). Chromium runs headless with `--no-sandbox` flags required in containers.

Stop:

```bash
docker compose --profile app down
```

## Cursor configuration

### Local stdio (recommended for daily dev)

Add the server to `.cursor/mcp.json` in your project (or Cursor Settings → MCP):

```json
{
  "mcpServers": {
    "olteststack": {
      "command": "bun",
      "args": ["run", "dev"],
      "cwd": "/absolute/path/to/OLTestStack",
      "env": {
        "PERSIST_RECORDING": "false",
        "BROWSER_HEADLESS": "true"
      }
    }
  }
}
```

Replace `cwd` with the absolute path to this repository on your machine.

### Remote HTTP (Docker or LAN)

Cursor supports MCP servers over HTTP/SSE when configured with a URL (feature availability varies by Cursor version — check Settings → MCP for “URL” or “HTTP” transport options):

```json
{
  "mcpServers": {
    "olteststack": {
      "url": "http://localhost:8082/mcp"
    }
  }
}
```

If your Cursor build only supports stdio, keep using `bun run dev` locally or run a small HTTP-to-stdio bridge (out of V1 scope).

### With PostgreSQL persistence

```json
{
  "mcpServers": {
    "olteststack": {
      "command": "bun",
      "args": ["run", "dev"],
      "cwd": "/absolute/path/to/OLTestStack",
      "env": {
        "PERSIST_RECORDING": "true",
        "DATABASE_URL": "postgresql://oltest:oltest@localhost:5433/olteststack",
        "BROWSER_HEADLESS": "true"
      }
    }
  }
}
```

Start Postgres and run migrations before enabling persistence:

```bash
cp .env.example .env
bun run docker:up
bun run db:migrate
```

### Headed browser (visible window)

Set `BROWSER_HEADLESS` to `"false"`, or pass `"headless": false` in `browser.launch` at call time.

## Claude Desktop and other MCP clients

### Stdio (default)

Any MCP client that supports stdio transport can run the server:

```json
{
  "mcpServers": {
    "olteststack": {
      "command": "bun",
      "args": ["run", "dev"],
      "cwd": "/absolute/path/to/OLTestStack",
      "env": {
        "PERSIST_RECORDING": "false"
      }
    }
  }
}
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "olteststack": {
      "command": "bun",
      "args": ["run", "dev"],
      "cwd": "/absolute/path/to/OLTestStack"
    }
  }
}
```

### HTTP (Streamable HTTP)

Clients that support Streamable HTTP connect to `http://<host>:8082/mcp`. After `initialize`, include the `mcp-session-id` response header on subsequent requests.

**Generic HTTP client flow (curl / scripts):**

```bash
# 1. Initialize — capture mcp-session-id from response headers
SESSION=$(curl -si -X POST http://localhost:8082/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"demo","version":"1.0.0"}}}' \
  | grep -i mcp-session-id | awk '{print $2}' | tr -d '\r')

# 2. List tools
curl -X POST http://localhost:8082/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "mcp-session-id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

**Node.js with MCP SDK client:**

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const transport = new StreamableHTTPClientTransport(
  new URL('http://localhost:8082/mcp'),
);
const client = new Client({ name: 'demo', version: '1.0.0' });
await client.connect(transport);
const tools = await client.listTools();
```

**Node.js alternative for stdio** (if Bun is not installed):

```json
{
  "mcpServers": {
    "olteststack": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/absolute/path/to/OLTestStack"
    }
  }
}
```

Run `bun run build` first when using the compiled `dist/` entry.

Restart the MCP client after changing configuration.

## Environment variables

Copy `.env.example` to `.env` for local development. Variables can also be set in the MCP client's `env` block or in `docker-compose.yml`.

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `stdio` | `stdio` or `http` |
| `MCP_HTTP_HOST` | `127.0.0.1` | Bind address (`0.0.0.0` in Docker) |
| `MCP_HTTP_PORT` | `8082` | MCP Streamable HTTP port |
| `MCP_HOST_PORT` | `8082` | Docker host port mapping for MCP HTTP |
| `BROWSER_HEADLESS` | `true` | Default headless mode for `browser.launch` |
| `CHROMIUM_EXECUTABLE_PATH` | auto | Path to Chromium/Chrome binary |
| `DEFAULT_TIMEOUT_MS` | `30000` | General operation timeout |
| `DEFAULT_NAVIGATION_TIMEOUT_MS` | `30000` | Navigation and reload timeout |
| `SCREENSHOT_DIR` | `./screenshots` | Screenshot output directory (Phase 6+) |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `PERSIST_RECORDING` | `false` | Flush recordings/reports to Postgres on `browser.close` |
| `DB_PORT` | `5433` | Documented Docker host port for Postgres |
| `HEALTH_PORT` | — | Optional HTTP health server (8081 in Docker) |
| `APP_HOST_PORT` | `8081` | Docker host port mapping for health |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `oltest` / `oltest` / `olteststack` | Docker Compose credentials (dev only) |

## Security notes (HTTP mode)

HTTP MCP exposes browser automation to anyone who can reach the port. For V1:

- **Local dev:** bind to `127.0.0.1` (default) so only your machine can connect.
- **Docker:** `0.0.0.0` is required inside the container; map to `localhost` on the host unless you intend remote access.
- **Production (out of V1 scope):** place a reverse proxy (nginx, Caddy) with TLS and authentication in front of `/mcp`. Do not expose port 8082 directly to the public internet without auth.

Default Postgres credentials are for local development only. Change them before any non-local deployment.

## Verifying the server works

### 1. Manual smoke test (stdio)

```bash
bun run dev
```

The process should start without exiting. Press Ctrl+C to stop.

### 2. Manual smoke test (HTTP)

```bash
bun run dev:http
curl http://localhost:8081/health
curl -X POST http://localhost:8082/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

### 3. Confirm tools in your agent client

In Cursor (or your MCP client):

1. Open MCP settings and ensure `olteststack` shows as connected (green / enabled).
2. Start a new agent chat and ask: *"List the olteststack MCP tools available."*
3. You should see **8 tools** today:
   - `browser.launch`, `browser.close`
   - `page.create`, `page.navigate`, `page.reload`, `page.close`
   - `page.elements`, `page.find`

### 4. End-to-end tool call

Ask the agent to run a minimal flow:

```
browser.launch → page.create → page.navigate (https://example.com) → page.elements → browser.close
```

A successful `page.navigate` returns `{ "ok": true, "data": { "url", "title", ... } }`. All tool responses use the shared JSON envelope (see [MCP Tools Reference](./mcp-tools-reference.md)).

### 5. Run the test suite (optional)

```bash
bun run test
```

## Troubleshooting

### Chromium not found

**Symptoms:** `browser.launch` fails with a launch or executable error.

**Fixes:**

1. Reinstall Puppeteer's browser: `bunx puppeteer browsers install chrome`
2. Point to a system binary:
   ```bash
   export CHROMIUM_EXECUTABLE_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
   ```
3. On Linux CI/Docker, Chromium is preinstalled in the Docker image; ensure `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser`.

### Port conflicts (PostgreSQL / HTTP)

**Symptoms:** `docker compose up` fails; connection refused on `localhost:5433`, `8081`, or `8082`.

**Fixes:**

1. Check if ports are in use: `lsof -i :5433`, `lsof -i :8081`, `lsof -i :8082`
2. Stop conflicting services or change `POSTGRES_HOST_PORT`, `APP_HOST_PORT`, `MCP_HOST_PORT` in `.env`
3. Ensure `DATABASE_URL` matches the host port you configured

### MCP HTTP returns 400 / missing session

**Symptoms:** `POST /mcp` without `mcp-session-id` fails after initialize.

**Fixes:**

1. Send `initialize` first; read `mcp-session-id` from response headers
2. Include `mcp-session-id` on all subsequent `POST`, `GET` (SSE), and `DELETE` requests
3. Use `Content-Type: application/json` on POST bodies

### Session errors (`SESSION_NOT_FOUND`)

**Symptoms:** `page.navigate` or `page.elements` returns `SESSION_NOT_FOUND`.

**Causes and fixes:**

| Cause | Fix |
|-------|-----|
| Stale `pageId` or `browserId` from a previous session | Call `browser.launch` and `page.create` again |
| Browser was closed | IDs are invalidated after `browser.close` |
| MCP server restarted | In-memory sessions are lost; start a new browser |
| Wrong ID copied from an old message | Always use IDs from the most recent success response |

### Element errors (`ELEMENT_NOT_FOUND`)

**Symptoms:** `page.find` returns no match.

**Fixes:**

1. Call `page.elements` after every `page.navigate` or `page.reload` (element IDs are invalidated on navigation)
2. Use a shorter or partial query (matching is case-insensitive substring on text, role, or aria-label)
3. Set `includeHidden: true` in `page.elements` if the control is not visible

### Navigation timeout (`TIMEOUT`)

**Symptoms:** `page.navigate` fails with `TIMEOUT`.

**Fixes:**

1. Increase `timeoutMs` in the navigate call (minimum 1000)
2. Try `waitUntil: "domcontentloaded"` instead of `"load"` or `"networkidle"`
3. Raise `DEFAULT_NAVIGATION_TIMEOUT_MS` in env for slow pages

### MCP client shows no tools

**Fixes:**

1. Verify `cwd` in `mcp.json` points to the project root (where `package.json` lives)
2. Ensure `bun` is on the PATH the MCP client uses
3. Check MCP client logs for startup errors (often stderr from the server process)
4. For HTTP mode, confirm `curl` initialize works before debugging the client
5. Restart the MCP client after config changes

### Orphan Chromium processes

Always call `browser.close` when finished. If processes linger after a crash:

```bash
pkill -f "chrome.*olteststack"   # adjust pattern for your OS
```

Wrap agent workflows in try/finally semantics: launch once, close in cleanup.

## Next steps

- [MCP Tools Reference](./mcp-tools-reference.md) — schemas and examples for each tool
- [Agent Workflows](./agent-workflows.md) — recommended patterns for AI agents
- [Skills](./skills.md) — reusable Cursor skills for common test scenarios
