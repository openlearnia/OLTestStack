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

---

## Module-Wide Out of Scope (V2)

- Session replay (re-execute recorded actions)
- Video recording
- HAR file export
- Report export to HTML/PDF
- Real-time streaming of events to MCP client
- Report comparison / diff between runs

## V1 Persistence (PostgreSQL)

When `PERSIST_RECORDING=true`, recorded events and generated test reports are written to PostgreSQL on browser close (or `test.run` completion in Phase 11). Active `browserId` / `pageId` sessions remain in the in-memory registry for MCP latency.

- **Docker:** `docker compose up -d postgres` (host port **5433**)
- **Schema:** `test_reports`, `recorded_events`; optional `browser_sessions` / `page_sessions` audit tables
- **Migrations:** `bun run db:migrate` (Drizzle Kit)
- **Connection:** `DATABASE_URL=postgresql://oltest:oltest@localhost:5433/olteststack` (dev defaults in `.env.example`)
