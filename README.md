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
| App health HTTP | **8081** | 8081 | Optional; only when `HEALTH_PORT` is set or Docker `app` profile runs |

MCP transport remains **stdio** (no TCP port for MCP).

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
export PERSIST_RECORDING=true
export DATABASE_URL=postgresql://oltest:oltest@localhost:5433/olteststack
bun run dev
```

Stop infrastructure:

```bash
bun run docker:down
```

Optional: run the app container with health endpoint on 8081:

```bash
docker compose --profile app up -d
curl http://localhost:8081/health
```

Run migrations inside Docker:

```bash
docker compose --profile migrate up migrate
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

When `PERSIST_RECORDING=true`, the server validates `DATABASE_URL` at startup and writes reports/events to PostgreSQL on `browser.close`.

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

Replace `cwd` with the absolute path to this project on your machine. Set `PERSIST_RECORDING=true` and `DATABASE_URL` if you want Postgres persistence.

## Available tools (V1 partial — 19 of 22)

| Category | Tools |
|----------|-------|
| Browser | `browser.launch`, `browser.close` |
| Page | `page.create`, `page.navigate`, `page.reload`, `page.close` |
| Elements | `page.elements`, `page.find` |
| Actions | `page.click`, `page.type`, `page.press`, `page.scroll` |
| Inspection | `page.screenshot`, `page.snapshot`, `page.text`, `page.html` |
| Monitoring | `page.network`, `page.console` |
| Waiting | `page.wait` |

**Planned (5):** `assert.exists`, `assert.text`, `assert.url`, `assert.network`, `test.run`

## Example flow

```
browser.launch  →  page.create  →  page.navigate  →  page.find  →  page.type  →  page.click  →  page.wait  →  page.screenshot  →  browser.close
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
| `PERSIST_RECORDING` | `false` | Persist recordings/reports to Postgres on flush |
| `DB_PORT` | `5433` | Documented default host port for local Docker Postgres |
| `HEALTH_PORT` | — | Optional HTTP health server (8081 in Docker) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `oltest` / `oltest` / `olteststack` | Docker Compose Postgres credentials |

## Project structure

```
src/
├── core/          # Types, errors, registry, config, recording
├── cdp/           # Puppeteer CDP adapter
├── db/            # Drizzle schema, migrations runner, persistence
├── domain/        # Business logic (browser, page, elements)
├── health/        # Optional HTTP health endpoint
└── mcp/           # MCP server, tool registration
```

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start MCP server (stdio) |
| `bun run build` | Compile TypeScript to `dist/` |
| `bun run typecheck` | Type-check without emit |
| `bun run test` | Run tests |
| `bun run docker:up` | Start Postgres via Docker Compose |
| `bun run docker:down` | Stop Docker Compose services |
| `bun run db:migrate` | Apply Drizzle SQL migrations |
| `bun run db:generate` | Generate migrations from schema |
| `bun run db:studio` | Open Drizzle Studio (DB GUI) |

## Documentation

Agent-focused guides for MCP setup, tool reference, workflows, and Cursor skills:

- [Guides index](docs/guides/README.md)
- [MCP Server Setup](docs/guides/mcp-server-setup.md) — install, configure Cursor/Claude, troubleshoot
- [MCP Tools Reference](docs/guides/mcp-tools-reference.md) — schemas, examples, error codes
- [Agent Workflows](docs/guides/agent-workflows.md) — recommended patterns for AI agents
- [Skills](docs/guides/skills.md) — Cursor Agent Skills for browser testing

**Cursor setup:** project skills (`.cursor/skills/`) and subagents (`.cursor/agents/`) ship with the repo; OLTestStack rules live at user level (`~/.cursor/rules/olteststack-mcp-usage.mdc`, `olteststack-typescript.mdc`) — see [Guides index](docs/guides/README.md#project-cursor-setup).

## What's next

Phases 5–12 add user actions (`page.click`, `page.type`), inspection, monitoring, waiting, assertions, recording reports, and `test.run` orchestration. See `docs/plans/v1-implementation-plan.md`.
