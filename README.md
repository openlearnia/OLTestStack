# OLTestStack — AI Browser Testing Framework

[![openlearnia](https://img.shields.io/badge/org-openlearnia-blue)](https://github.com/openlearnia)

MCP server that exposes high-level browser automation tools for AI agents. Internally drives Chromium via Puppeteer/CDP; externally presents flat, stateless MCP command payloads.

```bash
git clone https://github.com/openlearnia/OLTestStack.git
cd OLTestStack
```

## Requirements

- [Bun](https://bun.sh) 1.0+ (or Node.js 20+)
- Chromium (bundled with Puppeteer, or set `CHROMIUM_EXECUTABLE_PATH`)
- [Docker](https://www.docker.com/) (optional, for PostgreSQL persistence)

## Ports

| Service | Host port | Container port | Notes |
|---------|-----------|----------------|-------|
| PostgreSQL | **5433** | 5432 | Non-default; avoids local Postgres conflicts |
| App health HTTP (Docker) | **8091** | 8081 | `APP_HOST_PORT` → `HEALTH_PORT`; dashboard at `/dashboard` |
| MCP HTTP (Docker) | **8092** | 8082 | `MCP_HOST_PORT` → `MCP_HTTP_PORT`; local `dev:http` uses 8082 |

Local MCP uses **stdio** by default (no TCP port). `bun run dev:http` listens on **8081** / **8082** on the host (dashboard at [http://localhost:8081/dashboard](http://localhost:8081/dashboard)).

## Quick start (local MCP)

```bash
bun install
bun run typecheck
bun run dev
```

## Docker + PostgreSQL quickstart

Persistence is optional. Active browser/page sessions stay **in-memory** for speed; recordings and test reports flush to Postgres on browser close when enabled.

```bash
# 1. Start Postgres (host port 5433)
cp .env.example .env
bun run docker:up

# 2. Apply migrations
bun run db:migrate

# 3. Enable persistence and start MCP server
export DATABASE_URL=postgresql://oltest:oltest@localhost:5433/olteststack
bun run dev
```

Sessions persist automatically when `DATABASE_URL` is set. Unsaved sessions expire after `SESSION_TTL_HOURS` (default 24h); call `save_session` or use the dashboard to keep them.

Stop infrastructure:

```bash
bun run docker:down
```

Optional: run the app container (health on host **8091**, MCP on **8092**). Run migrations first, then start the full stack:

```bash
docker compose run --rm migrate
bun run docker:app
curl http://localhost:8091/health
open http://localhost:8091/dashboard
```

If the app container restarts in a loop with `column "saved" does not exist`, apply pending migrations to the existing Postgres volume:

```bash
docker compose run --rm migrate
docker compose up -d --build
```

Override host ports in `.env` via `APP_HOST_PORT` and `MCP_HOST_PORT` if 8091/8092 are taken.

Run migrations inside Docker:

```bash
docker compose run --rm migrate
```

> **Production warning:** Default credentials in `.env.example` (`oltest`/`oltest`) are for local development only. Change `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `DATABASE_URL` before deploying.

## Run the MCP server

```bash
bun run dev
```

Or after building:

```bash
bun run build
bun run start
```

The server communicates over **stdio** — do not pipe logs to stdout (stderr only for diagnostics).

When `DATABASE_URL` is set, the server validates the connection at startup and writes reports/events to PostgreSQL on `browser_close` unless `PERSIST_RECORDING=false`. Ephemeral sessions auto-delete after `SESSION_TTL_HOURS` unless promoted via `save_session`.

## Cursor MCP configuration

Add to your Cursor MCP settings (`.cursor/mcp.json` or Cursor Settings → MCP):

```json
{
  "mcpServers": {
    "olteststack": {
      "command": "bun",
      "args": ["run", "dev"],
      "cwd": "/Users/kartikbazzad/OLTestStack",
      "env": {
        "PERSIST_RECORDING": "false"
      }
    }
  }
}
```

Replace `cwd` with the absolute path to this project on your machine. Set `DATABASE_URL` for Postgres persistence (default on when set). Use `PERSIST_RECORDING=false` to disable writes.

## Available tools (V1 — 26)

| Category | Tools |
|----------|-------|
| Browser | `browser_launch`, `browser_close` |
| Page | `page_create`, `page_navigate`, `page_reload`, `page_close` |
| Elements | `page_elements`, `page_find` |
| Actions | `page_click`, `page_type`, `page_press`, `page_scroll` |
| Inspection | `page_screenshot`, `page_snapshot`, `page_text`, `page_html` |
| Monitoring | `page_network`, `page_console` |
| Waiting | `page_wait` |
| Assertions | `assert_exists`, `assert_text`, `assert_url`, `assert_network` |
| Session | `session_export`, `save_session`, `test_run` |

## Example flow

```
browser_launch  →  page_create  →  page_navigate  →  page_find  →  page_type  →  page_click  →  page_wait  →  page_screenshot  →  browser_close
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSER_HEADLESS` | `true` | Default headless mode |
| `CHROMIUM_EXECUTABLE_PATH` | auto | Custom Chromium binary |
| `DEFAULT_TIMEOUT_MS` | `30000` | General operation timeout |
| `DEFAULT_NAVIGATION_TIMEOUT_MS` | `30000` | Navigation/reload timeout |
| `SCREENSHOT_DIR` | `./screenshots` | Screenshot output directory |
| `DATABASE_URL` | — | PostgreSQL connection string (`localhost:5433` in dev) |
| `PERSIST_RECORDING` | `true` when `DATABASE_URL` set | Set `false` to opt out of persisting reports |
| `SESSION_TTL_HOURS` | `24` | Hours until unsaved sessions are auto-deleted |
| `DB_PORT` | `5433` | Documented default host port for local Docker Postgres |
| `HEALTH_PORT` | — | App listen port for health + dashboard (8081; container side in Docker) |
| `DASHBOARD_ENABLED` | `true` when `HEALTH_PORT` or HTTP MCP | Session dashboard at `/dashboard` |
| `APP_HOST_PORT` | `8091` | Docker host port mapped to `HEALTH_PORT` |
| `MCP_HTTP_PORT` | `8082` | App listen port for MCP HTTP |
| `MCP_HOST_PORT` | `8092` | Docker host port mapped to `MCP_HTTP_PORT` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `oltest` / `oltest` / `olteststack` | Docker Compose Postgres credentials |

## Project structure

```
src/
├── core/          # Types, errors, registry, config, recording
├── cdp/           # Puppeteer CDP adapter
├── db/            # Drizzle schema, migrations runner, persistence
├── dashboard/     # Session dashboard UI + REST API
├── domain/        # Business logic (browser, page, elements)
├── health/        # Optional HTTP health endpoint
└── mcp/           # MCP server, tool registration
```

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev:http` | Start MCP server (HTTP) + dashboard on 8081 |
| `bun run dashboard` | Dashboard + health only (no MCP) on 8081 |
| `bun run dev` | Start MCP server (stdio) |
| `bun run build` | Compile TypeScript to `dist/` |
| `bun run typecheck` | Type-check without emit |
| `bun run test` | Run tests |
| `bun run smoke` | End-to-end MCP smoke test (HTTP transport) |
| `bun run test:mcp` | Full MCP tool-flow test via SDK client (no curl) |
| `bun run test:mcp:docker` | Same as `test:mcp` against Docker on port 8092 |
| `bun run docker:up` | Start Postgres via Docker Compose |
| `bun run docker:app` | Build and start MCP app container (HTTP on host 8091/8092) |
| `bun run docker:down` | Stop Docker Compose services |
| `bun run db:migrate` | Apply Drizzle SQL migrations |
| `bun run db:generate` | Generate migrations from schema |
| `bun run db:studio` | Open Drizzle Studio (DB GUI) |

## Documentation

Agent-focused guides for MCP setup, tool reference, workflows, and Cursor skills:

- [Guides index](docs/guides/README.md)
- [Session Dashboard](docs/guides/dashboard.md) — browse persisted test reports and timelines
- [MCP Server Setup](docs/guides/mcp-server-setup.md) — install, configure Cursor/Claude, troubleshoot
- [MCP Tools Reference](docs/guides/mcp-tools-reference.md) — schemas, examples, error codes
- [Agent Workflows](docs/guides/agent-workflows.md) — recommended patterns for AI agents
- [Skills](docs/guides/skills.md) — Cursor Agent Skills for browser testing

**Cursor setup:** project skills (`.cursor/skills/`) and subagents (`.cursor/agents/`) ship with the repo; OLTestStack rules live at user level (`~/.cursor/rules/olteststack-mcp-usage.mdc`, `olteststack-typescript.mdc`) — see [Guides index](docs/guides/README.md#project-cursor-setup).

## Smoke test

Verify MCP connectivity and core browser flow:

```bash
bun run smoke          # quick: launch → navigate → elements → close
bun run test:mcp       # full tool flow via MCP SDK (no curl)
```

Uses HTTP transport (spawns a local server if none is running). Set `CHROMIUM_EXECUTABLE_PATH` if Puppeteer's bundled Chromium is unavailable.

## What's next

V1 is feature-complete (26 MCP tools, dashboard, session TTL, script export/playback). CI runs on push/PR via `.github/workflows/ci.yml`. Remaining: push uncommitted work to GitHub, Docker image publish, and V1.2 enhancements (query capture at record time, variable substitution). See `docs/plans/v1-implementation-plan.md` and `docs/plans/session-script-playback.md`.
