# Session TTL & save_session

Ephemeral session persistence for test reports stored in PostgreSQL.

## Behavior

| State | `saved` | `expires_at` | Cleanup |
|-------|---------|--------------|---------|
| New session (default) | `false` | `now() + SESSION_TTL_HOURS` | Deleted when past `expires_at` |
| After `save_session` or dashboard Save | `true` | `null` | Kept indefinitely |

- **Persistence:** When `DATABASE_URL` is set, reports are written on `browser_close` and `test_run` completion unless `PERSIST_RECORDING=false`.
- **TTL:** Default 24 hours (`SESSION_TTL_HOURS=24`).
- **Promotion:** MCP tool `save_session` or `POST /api/sessions/:id/save` sets `saved=true`, `saved_at=now()`, clears `expires_at`.

## MCP tool

```json
{ "reportId": "550e8400-e29b-41d4-a716-446655440000" }
```

`sessionId` is accepted as an alias for `reportId`. Optional `name` renames `test_name`.

## Cleanup

- `bun run db:cleanup` — manual one-shot delete of expired rows (+ screenshot files under `SCREENSHOT_DIR`)
- On server startup — once when `DATABASE_URL` is set
- Hourly interval — while the health/dashboard server is running

`recorded_events` rows cascade-delete with their parent `test_reports` row.

## Dashboard

- **Saved** badge vs **Expires in Xh** for ephemeral sessions
- Filter: All / Saved / Expiring
- Detail page **Save session** button calls the save API

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_TTL_HOURS` | `24` | TTL for unsaved persisted sessions |
| `PERSIST_RECORDING` | `true` when `DATABASE_URL` set | Set `false` to disable writes |
| `DATABASE_URL` | — | Required for persistence and dashboard data |

## Schema (migration `0001_blue_greymalkin`)

```sql
ALTER TABLE test_reports ADD COLUMN saved boolean DEFAULT false NOT NULL;
ALTER TABLE test_reports ADD COLUMN expires_at timestamptz;
ALTER TABLE test_reports ADD COLUMN saved_at timestamptz;
```

Indexes: `test_reports_expires_at_idx`, `test_reports_saved_idx`.
