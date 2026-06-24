# Session Script Export & Playback

> **Status:** V1.1 MVP implemented  
> **Related:** [recording.md](../../requirements/10-recording-test-reports/recording.md), [session-script-playback.md](../../requirements/10-recording-test-reports/session-script-playback.md)

## Problem

Today OLTestStack records browser activity into an in-memory `RecordedEvent` buffer and flushes evidence to Postgres on `browser_close`. Agents can run explicit step arrays via `test_run`, but there is no way to **save a live session as a replay file** and **play it back** without re-specifying every step.

The user wants: record → export script → replay — essentially V2 session replay, but available now as a minimal MVP.

---

## Current State (before this feature)

| Capability | Status |
|------------|--------|
| In-memory event recording | ✅ `InMemoryRecordingService` per `browserId` |
| Event types | `action`, `assertion`, `navigation`, `screenshot`, `network`, `console`, `error` |
| Postgres persistence | ✅ On `browser_close` via `flushRecordingToDatabase` |
| Structured test reports | ✅ `generateReport()` from events |
| Explicit step execution | ✅ `test_run` with `steps[]` |
| Script export | ❌ |
| Script playback | ❌ |

### Key gap: elementIds vs queries

Recorded **click/type** actions store `elementId`, not the `query` the agent used in `page_find`. Replay requires **queries** (accessibility text/role matching), because elementIds are ephemeral and invalidated on navigation.

---

## Proposed Script Format

**File extension:** `.olteststack.json`  
**Version:** `1.0`

```json
{
  "version": "1.0",
  "name": "Login flow",
  "goal": "Verify login redirects to dashboard",
  "url": "https://app.example.com/login",
  "recordedAt": "2026-06-21T10:00:00.000Z",
  "browserId": "optional-uuid-from-export",
  "steps": [
    { "action": "navigate", "url": "https://app.example.com/login" },
    { "action": "type", "query": "Email", "value": "user@example.com" },
    { "action": "click", "query": "Sign In" },
    { "action": "assert.url", "url": "/dashboard", "match": "contains" }
  ],
  "exportWarnings": ["Skipped click at ...: could not resolve query"]
}
```

Steps reuse the existing `test_run` step schema (`TestStep` discriminated union) — no parallel format.

---

## Record → Export

### Auto-capture (existing)

Recording is already transparent when `recordingEnabled: true` (default on `browser_launch`). Every MCP tool call emits events.

### Explicit export (new MCP tool)

**`session_export`** — converts the live recording buffer to a `SessionScript`.

| Input | Required | Description |
|-------|----------|-------------|
| `browserId` | yes | Active browser session |
| `name` | no | Script name (default: `session-<prefix>`) |
| `goal` | no | Stored in script metadata |

**Output:** `{ script, eventCount, stepCount, skippedCount }`

Call **before** `browser_close` while the session is still open.

### Event → step mapping

| RecordedEvent | Executable step |
|---------------|-----------------|
| `navigation` | `{ action: "navigate", url }` |
| `action: click` | `{ action: "click", query }` — query from registry lookup or payload |
| `action: type` | `{ action: "type", query, value }` |
| `action: press` | `{ action: "press", key }` |
| `action: scroll` | `{ action: "scroll", direction }` |
| `assertion: exists` | `{ action: "assert.exists", query }` |
| `assertion: text` | `{ action: "assert.text", contains, match }` |
| `assertion: url` | `{ action: "assert.url", url, match }` |
| `assertion: network` | `{ action: "assert.network", url, status }` |
| `screenshot` | `{ action: "screenshot", fullPage? }` |
| `network`, `console`, `error` | Skipped (evidence only, not replayable) |

**Query resolution:** at export time, look up `elementId` in the session registry and derive query from `element.text` or `element.role`. Unresolvable steps are skipped with warnings in `exportWarnings`.

---

## Playback

Extend **`test_run`** (no separate `script_playback` tool in MVP):

| Input | Description |
|-------|-------------|
| `script` | Inline `SessionScript` object |
| `scriptFile` | Path to `.olteststack.json` on the MCP server filesystem |
| `steps` | Existing explicit steps (unchanged) |

Precedence: `scriptFile` → `script` → `steps`. Top-level `url` / `name` override script metadata when provided.

Example playback:

```json
{
  "goal": "Replay saved login",
  "scriptFile": "scripts/example-login.olteststack.json"
}
```

Or inline:

```json
{
  "goal": "Replay saved login",
  "script": {
    "version": "1.0",
    "name": "Login flow",
    "steps": [ ... ]
  }
}
```

---

## Limitations (MVP)

1. **Stale elementIds** — if the element registry was invalidated (navigation/reload) before export, click/type steps may be skipped.
2. **Single page** — `test_run` uses one page; multi-tab sessions are not replayed faithfully.
3. **Filesystem scripts** — `scriptFile` reads from the MCP server host, not the Cursor client.
4. **Evidence-only events** — network/console/error events are not converted to steps.

**V1.2 additions:** query capture at record time, `${VAR_NAME}` variable substitution in `test_run`, and auto-inserted wait steps on export (from event timestamps).

---

## Phasing

| Phase | Scope |
|-------|-------|
| **V1.1 MVP** | `session_export`, `test_run` + `script`/`scriptFile`, `.olteststack.json` format, example script |
| **V1.2 (done)** | Store `query` in action recording at emit time; variable substitution; auto-insert wait steps on export; post-close DB export via `reportId`; auto-save failed sessions |
| **V2** | Full session replay with timing, multi-page, HAR/network assertions from buffer, script diff |

---

## Example Flow

```
1. browser_launch({ recordingEnabled: true })
2. page_create → page_navigate → page_find → page_click → assert_text ...
3. session_export({ browserId, name: "Login flow", goal: "..." })
   → save response.script to scripts/my-flow.olteststack.json
4. browser_close({ browserId })
   → reportId in dashboard (or use session list API)
5. session_export({ reportId, goal: "..." })  // optional: export after close
6. test_run({ goal: "Replay login", scriptFile: "scripts/my-flow.olteststack.json" })
   → TestReport with pass/fail
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/domain/recording/script-types.ts` | `SessionScript` type |
| `src/domain/recording/events-to-script.ts` | Event → step converter |
| `src/domain/recording/resolve-variables.ts` | `${VAR_NAME}` substitution for script replay |
| `src/domain/recording/session-export.ts` | `session_export` handler (live + DB) |
| `src/domain/recording/export-from-db.ts` | Post-close export from `recorded_events` |
| `src/db/load-recorded-events.ts` | Load and map persisted events |
| `src/domain/recording/load-script.ts` | Load/validate script files |
| `src/domain/test/step-schema.ts` | Shared Zod step schema |
| `src/domain/test/run-test.ts` | Extended with script playback |
| `scripts/example-login.olteststack.json` | Example script |
