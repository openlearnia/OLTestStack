---
name: session-record-export
description: >-
  Record a live browser session, export it as a replayable .olteststack.json
  script via session_export, and replay with test_run. Use when converting
  ad-hoc agent flows into repeatable server-side tests.
disable-model-invocation: true
---

# Session Record → Export → Replay

Convert an exploratory agent session into a repeatable test script.

## Prerequisites

- OLTestStack MCP server connected (all **38** tools)
- `browser_launch` with `recordingEnabled: true` (default)
- Optional: `DATABASE_URL` for post-close export via `reportId`

## Workflow

### 1. Record (agent-driven)

```text
browser_launch          → browserId
page_create             → pageId
page_navigate           → target URL
page_click_query / page_type_query / page_wait / assert_*  → interactions
```

Recording captures navigation, actions, assertions, screenshots, network, console, and errors automatically.

**Query capture:** Use `page_click_query` / `page_type_query`, or pass `query` from `page_find` into `page_click` / `page_type` — exported scripts use text queries, not stale `elementId`s.

### 2. Export (live session)

Call `session_export` while the browser session is still open:

```json
{
  "browserId": "<browserId>",
  "name": "Login flow",
  "goal": "Verify login redirects to dashboard"
}
```

Save `data.script` to a file, e.g. `scripts/my-flow.olteststack.json`.

### 3. Close and persist

```json
{ "browserId": "<browserId>", "testName": "Login flow" }
```

When persistence is enabled, `browser_close` returns `reportId`.

### 4. Export (post-close, optional)

Rebuild script from PostgreSQL recorded events:

```json
{
  "reportId": "<reportId>",
  "goal": "Verify login redirects to dashboard"
}
```

Use `session_get` to inspect persisted events before export.

### 5. Replay (server-side)

Single script:

```json
{
  "goal": "Replay login flow",
  "scriptFile": "scripts/my-flow.olteststack.json",
  "variables": { "EMAIL": "user@example.com", "PASSWORD": "secret" }
}
```

Suite (multiple scripts):

```json
{
  "goal": "Smoke suite",
  "scripts": ["scripts/login.olteststack.json", "scripts/crud.olteststack.json"]
}
```

Or `suiteFile` pointing to a suite manifest. Scripts support `${VAR}` substitution via `variables`.

Validate before replay: `script_lint` with `{ "scriptFile": "..." }`.

`test_run` returns a structured `TestReport` with status, events, and timing. Supports `softFailures` for soft asserts.

### 6. Promote session (optional)

```json
{ "reportId": "<reportId>" }
```

`save_session` removes TTL on ephemeral sessions (default 24h).

## Tips

- Re-discover elements after navigation before exporting — exported click/type steps use text queries.
- Unresolvable actions are skipped with warnings in `exportWarnings`.
- For local fixtures, use `file:///absolute/path/to/fixtures/sample-app/index.html` in the script `url` field.
- See `scripts/example-login.olteststack.json` and `fixtures/sample-app/login.olteststack.json` for format examples.
- `send_report` captures full debug state with `debugId` when replay fails.

## Error recovery

| Error | Action |
|-------|--------|
| `SESSION_NOT_FOUND` on export | Export before `browser_close`; use `reportId` after close |
| Empty script / few steps | Ensure `recordingEnabled: true`; use query tools for actions |
| Replay `failed` status | Check `report.events`; run `script_lint`; fix script queries |

## Related

- [MCP Tools Reference](../../../docs/guides/mcp-tools-reference.md) — `session_export`, `test_run`, `session_get`
- [Agent Workflows](../../../docs/guides/agent-workflows.md) — recording and session scripts
