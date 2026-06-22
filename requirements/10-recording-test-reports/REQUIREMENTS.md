# Module 10 — Recording & Test Reports

> **Module ID:** `10-recording-test-reports`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [02-browser-session-management](../02-browser-session-management/REQUIREMENTS.md)  
> **Depended on by:** [11-test-execution](../11-test-execution/REQUIREMENTS.md), all action/monitoring modules (05–09)

## Overview

Automatically record all test activity during a browser session and generate structured test reports. Provides the evidence trail that AI agents and humans need to understand what happened during a test run. Neither feature exposes standalone MCP commands — recording is transparent; report generation is invoked by `test.run` or browser close.

---

## Feature Index

| Feature | Type | Requirements |
|---------|------|--------------|
| Auto-recording | Internal | [recording.md](./recording.md) |
| Test report generation | Internal | [test-report.md](./test-report.md) |
| Session TTL & save | MCP + API | [session-ttl.md](./session-ttl.md) |
| Session script export & playback | MCP | [session-script-playback.md](./session-script-playback.md) |

---

## Module-Wide Out of Scope (V2)

- Full-fidelity session replay (timing, multi-page)
- Video recording
- HAR file export
- Report export to HTML/PDF
- Real-time streaming of events to MCP client
- Report comparison / diff between runs

## V1 Persistence (PostgreSQL)

When `DATABASE_URL` is set, recorded events and generated test reports are written to PostgreSQL on browser close (or `test.run` completion) **by default**. Set `PERSIST_RECORDING=false` to opt out. Active `browserId` / `pageId` sessions remain in the in-memory registry for MCP latency.

New persisted sessions are **ephemeral** (`saved=false`, `expires_at = now + SESSION_TTL_HOURS`, default 24h). Call MCP `save_session` or the dashboard save API to promote them to saved (no expiry). See [session-ttl.md](./session-ttl.md).

- **Docker:** `docker compose up -d postgres` (host port **5433**)
- **Schema:** `test_reports`, `recorded_events`; optional `browser_sessions` / `page_sessions` audit tables
- **Migrations:** `bun run db:migrate` (Drizzle Kit)
- **Cleanup:** `bun run db:cleanup` or automatic on startup + hourly
- **Connection:** `DATABASE_URL=postgresql://oltest:oltest@localhost:5433/olteststack` (dev defaults in `.env.example`)
