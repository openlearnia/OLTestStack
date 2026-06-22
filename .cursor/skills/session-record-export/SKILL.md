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

- OLTestStack MCP server connected (all **25** tools)
- `browser_launch` with `recordingEnabled: true` (default)

## Workflow

### 1. Record (agent-driven)

```text
browser_launch          → browserId
page_create             → pageId
page_navigate           → target URL
page_find / page_click / page_type / page_wait / assert_*  → interactions
```

Recording captures navigation, actions, assertions, screenshots, network, console, and errors automatically.

### 2. Export (before close)

Call `session_export` while the browser session is still open:

```json
{
  "browserId": "<browserId>",
  "name": "Login flow",
  "goal": "Verify login redirects to dashboard"
}
```

Save `data.script` to a file, e.g. `scripts/my-flow.olteststack.json`.

### 3. Replay (server-side)

```json
{
  "goal": "Replay login flow",
  "scriptFile": "scripts/my-flow.olteststack.json"
}
```

Or pass an inline `script` object. `test_run` returns a structured `TestReport` with status, events, and timing.

### 4. Cleanup

Always call `browser_close` after export (export does not close the session).

## Tips

- Re-discover elements after navigation before exporting — exported click/type steps use text queries, not stale `elementId`s.
- Unresolvable actions are skipped with warnings in `exportWarnings`.
- For local fixtures, use `file:///absolute/path/to/fixtures/sample-app/index.html` in the script `url` field.
- See `scripts/example-login.olteststack.json` and `fixtures/sample-app/login.olteststack.json` for format examples.

## Error recovery

| Error | Action |
|-------|--------|
| `SESSION_NOT_FOUND` on export | Export before `browser_close`; re-launch if session expired |
| Empty script / few steps | Ensure `recordingEnabled: true` and perform actions before export |
| Replay `failed` status | Check `report.events` for assertion failures; fix script queries |

## Related

- [MCP Tools Reference](../../../docs/guides/mcp-tools-reference.md) — `session_export`, `test_run`
- [Agent Workflows](../../../docs/guides/agent-workflows.md) — recording and session scripts
