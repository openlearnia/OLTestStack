# Session Dashboard

Browse persisted test reports and recorded event timelines from PostgreSQL.

## When it is available

The dashboard is served on the **health HTTP server** (same port as `/health`):

| Environment | URL |
|-------------|-----|
| Local `bun run dev:http` | [http://localhost:8081/dashboard](http://localhost:8081/dashboard) |
| Docker app (`docker:app`) | [http://localhost:8091/dashboard](http://localhost:8091/dashboard) |
| Dashboard-only script | [http://localhost:8081/dashboard](http://localhost:8081/dashboard) |

Enable with `HEALTH_PORT` (or `MCP_TRANSPORT=http`). Dashboard is on by default when either is set. Disable with `DASHBOARD_ENABLED=false`.

## Prerequisites

1. Postgres running (`bun run docker:up`)
2. Migrations applied (`bun run db:migrate`)
3. `DATABASE_URL` pointing at your database
4. At least one persisted session (automatic when `DATABASE_URL` is set and `PERSIST_RECORDING` is not `false`)

The UI shows a friendly message when the database is empty or unreachable — no crash, no secrets exposed.

## Quick start

```bash
cp .env.example .env
bun run docker:up
bun run db:migrate

export DATABASE_URL=postgresql://oltest:oltest@localhost:5433/olteststack
export HEALTH_PORT=8081

# Full stack (MCP + dashboard)
bun run dev:http

# Or dashboard + health only (no MCP)
bun run dashboard
```

Open [http://localhost:8081/dashboard](http://localhost:8081/dashboard).

Docker full stack:

```bash
bun run docker:app
open http://localhost:8091/dashboard
```

## Session lifecycle

| Type | Badge | Expiry |
|------|-------|--------|
| Ephemeral (default) | **Expires in Xh** | Auto-deleted after `SESSION_TTL_HOURS` (default 24h) |
| Saved | **Saved** | Never expires |

Promote a session:

- Dashboard detail page → **Save session** button
- MCP tool `save_session` with `reportId` or `sessionId`
- API `POST /api/sessions/:id/save`

## Pages

| Page | Path | Description |
|------|------|-------------|
| Sessions list | `/dashboard/` | Paginated table with status, persistence badges, duration, counts |
| Session detail | `/dashboard/detail.html?id=<uuid>` | Timeline, assertions, screenshots, save button |

Features on the list page:

- Filter by status (`passed`, `failed`, `error`)
- Filter by persistence (`saved`, `expiring`)
- Search by test name
- Pagination (20 per page)

The detail page shows:

- Test metadata and execution window
- Persistence state (saved vs expires-in)
- Assertion pass/fail blocks
- Network and console errors
- Chronological recorded events
- Screenshot thumbnails (when files exist under `SCREENSHOT_DIR`)
- **Save session** for ephemeral reports

## REST API

### `GET /api/sessions`

List test reports (paginated).

Query parameters:

| Param | Default | Description |
|-------|---------|-------------|
| `page` | `1` | Page number |
| `limit` | `20` | Page size (max 100) |
| `status` | — | `passed`, `failed`, or `error` |
| `persistence` | — | `saved` or `expiring` |
| `search` | — | Case-insensitive test name substring |

Example:

```bash
curl 'http://localhost:8081/api/sessions?status=failed&persistence=expiring&search=login'
```

### `GET /api/sessions/:id`

Full report plus recorded events timeline.

```bash
curl http://localhost:8081/api/sessions/550e8400-e29b-41d4-a716-446655440000
```

### `GET /api/sessions/:id/events`

Events only for a report.

```bash
curl http://localhost:8081/api/sessions/550e8400-e29b-41d4-a716-446655440000/events
```

### `POST /api/sessions/:id/save`

Promote an ephemeral session to saved (clears TTL).

```bash
curl -X POST http://localhost:8081/api/sessions/550e8400-e29b-41d4-a716-446655440000/save \
  -H 'Content-Type: application/json' \
  -d '{"name":"Login regression"}'
```

### `GET /api/screenshots/:filename`

Read-only PNG serve from `SCREENSHOT_DIR` (basename only; path traversal blocked).

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `HEALTH_PORT` | — | Required for HTTP dashboard (8081 local, 8081 in container) |
| `APP_HOST_PORT` | `8091` | Docker host port mapped to `HEALTH_PORT` |
| `DASHBOARD_ENABLED` | `true` when `HEALTH_PORT` or `MCP_TRANSPORT=http` | Toggle dashboard + API |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `PERSIST_RECORDING` | `true` when `DATABASE_URL` set | Set `false` to disable writes |
| `SESSION_TTL_HOURS` | `24` | TTL for unsaved sessions before auto-delete |
| `SCREENSHOT_DIR` | `./screenshots` | Local screenshot files for `/api/screenshots` |

## Cleanup

Expired ephemeral sessions are removed automatically:

- Once on server startup (when `DATABASE_URL` is set)
- Every hour while the health server runs
- Manually: `bun run db:cleanup`

Associated screenshot files under `SCREENSHOT_DIR` are deleted with the report.

## Architecture

```
Health server (:HEALTH_PORT)
├── GET /health
├── GET /dashboard/*          → static UI (src/dashboard/public/)
├── GET /api/sessions         → Drizzle → test_reports
├── GET /api/sessions/:id     → report + recorded_events
├── POST /api/sessions/:id/save → promote to saved
└── GET /api/screenshots/:file → read-only from SCREENSHOT_DIR
```

Implementation lives in `src/dashboard/` (queries, routes, static assets) and is wired from `src/health/http.ts`.

## Related

- [MCP Server Setup](./mcp-server-setup.md) — persistence and Docker ports
- [Session TTL requirements](../../requirements/10-recording-test-reports/session-ttl.md)
- [Root README](../../README.md) — quick start and environment variables
