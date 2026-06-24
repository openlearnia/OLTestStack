# Agent Workflows

How AI agents should use the OLTestStack MCP server for reliable browser testing. These patterns apply to all **38 implemented tools** (underscore names only).

## Recommended workflow pattern

The canonical test flow follows session lifecycle → discovery → interaction → verification → evidence → cleanup:

```text
launch → create page → navigate → discover elements → interact → wait → verify → screenshot → close
```

### Phase mapping

| Step | Tool(s) |
|------|---------|
| Launch browser | `browser_launch` |
| Open tab | `page_create` |
| Go to URL | `page_navigate` |
| Discover UI | `page_elements`, `page_find` |
| Interact | `page_click`, `page_click_query`, `page_type`, `page_type_query`, `page_select`, `page_upload`, `page_press`, `page_scroll` |
| Synchronize | `page_wait` (`element`, `elementHidden`, `url`, `networkIdle`, `networkRequest`) |
| Verify | `assert_*`, `page_assert_state` (`negate`, `soft` supported) |
| Capture evidence | `page_screenshot` (`url`, `returnInline`), `page_snapshot`, `page_text`, `page_html` |
| Observe | `page_network`, `page_console` |
| Frames / cookies | `page_frame`, `page_cookies` |
| Session introspection | `session_status`, `session_get`, `session_list` |
| Export session | `session_export` (`browserId` live or `reportId` post-close) |
| Promote session | `save_session` |
| Debug dump | `send_report` |
| Lint script | `script_lint` |
| Run scripted test | `test_run` (`script`, `scriptFile`, `scripts[]`, `suiteFile`, `${VAR}` variables) |
| Cleanup | `browser_close` (returns `reportId` when persistence enabled) |

## Stateless command pattern

Every MCP tool call is **stateless at the protocol level**. The server maintains in-memory sessions, but the agent must pass explicit IDs on every call:

```text
browserId  — from browser_launch
pageId     — from page_create
elementId  — from page_elements or page_find
reportId   — from browser_close (when persistence enabled)
```

### Rules

1. **Never assume IDs persist across server restarts.** If the MCP process restarts, re-launch.
2. **Always pass IDs from the latest success response.** Do not reuse IDs from earlier conversations unless you confirmed the session is still active.
3. **One browser per test flow** unless you intentionally need parallel browsers. Each `browser_launch` is independent.
4. **Close what you open.** Call `browser_close` in cleanup even after failures.

### Minimal state the agent should track

```text
browserId: string | null
pageId: string | null
elementIds: Map<label, string>   // e.g. "submit" → uuid
```

## Element discovery best practices

### `page_elements` vs `page_find`

| Use `page_elements` when… | Use `page_find` when… |
|---------------------------|------------------------|
| You need the full interactive surface | You know the label or role to search for |
| The page is unfamiliar | You are targeting one known control |
| You need to compare multiple candidates | Speed matters and the query is unique |
| You want to detect unexpected UI changes | You already validated the page layout |

### After navigation or reload

Element IDs are **invalidated** on `page_navigate` and `page_reload`. Always rediscover:

```text
page_navigate  →  page_elements (or page_find)  →  interact
```

Skipping rediscovery causes `ELEMENT_NOT_FOUND` on `page_click` and `page_type`.

### Query tools for grids

Prefer **`page_click_query`** / **`page_type_query`** over find+click for data grids and toolbars. Use `preferRegion` (`toolbar`, `filter`, `grid-header`, `grid-body`) to disambiguate. Pass `query` from `page_find` into `page_click` / `page_type` so recordings capture replayable queries.

### Query tips for `page_find`

- Matching is **case-insensitive substring** on visible text, role, and aria-label
- `"Submit"` matches a button labeled "Submit"
- `"email"` matches an input with aria-label "Email"
- If multiple elements match, the first visible match wins (`matchCount` tells you if ambiguity exists)
- Use `page_elements` when `matchCount > 1` and you need to disambiguate

### Truncation

`page_elements` returns at most **200** elements. When `truncated: true`, narrow scope (navigate to a sub-route) or use `page_find` for specific controls.

### Hidden elements

Pass `includeHidden: true` to `page_elements` only when you intentionally need off-screen or `display:none` controls. Default behavior filters to visible elements.

## When to use `page_wait`

Use `page_wait` to reduce flakiness after actions that trigger async updates:

| Condition | Use when |
|-----------|----------|
| `element` | A control appears after async render (SPA, lazy load) |
| `elementHidden` | A spinner/overlay must disappear before interacting |
| `url` | Post-login redirect or client-side routing |
| `networkIdle` | XHR/fetch must finish before verifying (API-driven UI) |
| `networkRequest` | A specific API call must complete (URL substring + status) |
| `timeout` | Fixed delay as last resort |

**Example:** After `page_click` on Submit, wait for URL change before screenshot:

```json
{
  "pageId": "<pageId>",
  "condition": "url",
  "value": "/dashboard",
  "match": "contains"
}
```

For slow initial loads, also use `page_navigate`'s `waitUntil` (`load`, `domcontentloaded`, `networkidle`) and increase `timeoutMs`.

## Recording and test reports

### Auto-recording

`browser_launch` enables recording by default (`recordingEnabled: true`). The server captures events such as:

- `navigation` — after `page_navigate` and `page_reload`
- `action` — after `page_click`, `page_type`, `page_press`, `page_scroll`
- `screenshot` — after `page_screenshot`
- `assertion` — after `assert_*` tools
- `network`, `console`, `error` — captured during session

Recording is **in-memory** during the session (10 MB cap per browser; oldest non-error/non-assertion events dropped when full).

### Persisting reports (optional)

When `PERSIST_RECORDING=true` and `DATABASE_URL` is set:

1. Events accumulate in memory during the browser session
2. On `browser_close`, the server flushes a test report to PostgreSQL
3. Report includes status (`passed` / `failed` / `error`), events, and timing

Setup:

```bash
cp .env.example .env
docker compose up -d postgres
bun run db:migrate
export PERSIST_RECORDING=true
export DATABASE_URL=postgresql://oltest:oltest@localhost:5433/olteststack
```

Full Docker stack (MCP HTTP on host **8092**, health/dashboard on **8091**):

```bash
docker compose run --rm migrate
docker compose up -d --build
```

Inspect reports with `bun run db:studio` or query the database directly.

### `test_run` and `session_export`

**`session_export`** converts a recording into a `.olteststack.json` replay script. Pass `browserId` while the session is open, or `reportId`/`sessionId` after `browser_close` to rebuild from PostgreSQL `recorded_events`.

**`test_run`** executes explicit steps, a saved script, or a suite and returns a structured `TestReport`:

```json
{
  "goal": "Replay login",
  "scriptFile": "fixtures/sample-app/login.olteststack.json",
  "variables": { "EMAIL": "user@example.com" }
}
```

Suites: pass `scripts: ["a.olteststack.json", "b.olteststack.json"]` or `suiteFile`. Scripts support `${VAR}` substitution. Use `script_lint` to validate before replay. Assert tools support `negate` and `soft`; `test_run` honors `softFailures`.

Goal-only `test_run` (no steps/script) returns agent-driven guidance with suggested tools.

### Record → export → replay workflow

```text
browser_launch
  → page_create
  → page_navigate
  → (agent interactions: find, type, click, assert, wait, …)
  → session_export({ browserId, name, goal })   → save data.script (optional; can export after close)
  → browser_close
  → session_export({ reportId, goal })          → optional post-close export from DB

# Later, replay without re-specifying every step:
test_run({ goal: "Replay", scriptFile: "scripts/my-flow.olteststack.json" })
```

Failed runs: set `AUTO_SAVE_FAILED_SESSIONS=true` to auto-promote persisted sessions on close, or call `save_session({ reportId })` manually before TTL expiry.

See the `session-record-export` skill in `.cursor/skills/` for a step-by-step guide.

## Error recovery patterns

| Error | Agent action |
|-------|--------------|
| `SESSION_NOT_FOUND` | `browser_launch` → `page_create` → resume from navigate |
| `ELEMENT_NOT_FOUND` | `page_elements` → refine query → `page_find` again |
| `TIMEOUT` on navigate or wait | Retry with higher `timeoutMs` or change `waitUntil` / wait condition |
| `BROWSER_CRASHED` | New `browser_launch`; do not reuse old IDs |
| `INVALID_INPUT` | Read `error.details.field` and fix the payload |

## Example workflows

### Smoke test

```text
browser_launch
  → page_create
  → page_navigate (https://example.com)
  → page_elements (verify count > 0)
  → browser_close
```

### Login form test (full flow)

```text
browser_launch
  → page_create
  → page_navigate (file://.../fixtures/sample-app/index.html)
  → page_type_query ("Email", value)
  → page_type_query ("Password", value)
  → page_click_query ("Submit")
  → page_wait (networkIdle or url)
  → page_screenshot (fetch data.url or returnInline)
  → page_console (level: error)
  → browser_close (capture reportId if persistence on)
```

### CRUD create flow

```text
browser_launch
  → page_create
  → page_navigate (app list view)
  → page_click_query ("Add", preferRegion: toolbar)
  → page_type_query ("Name", value)
  → page_click_query ("Save")
  → page_wait (networkIdle)
  → page_network (filter: /api/items)
  → page_find (item name)   → confirm visible
  → page_screenshot
  → browser_close
```

### Full login test with assertions

```text
browser_launch
  → page_create
  → page_navigate (/login)
  → page_find ("Email")     → page_type
  → page_find ("Password")  → page_type
  → page_find ("Submit")    → page_click
  → page_wait (url contains /dashboard)
  → assert_url (/dashboard)
  → page_screenshot
  → browser_close
```

## Anti-patterns

| Don't | Do instead |
|-------|------------|
| Reuse `elementId` after navigate | Rediscover elements |
| Skip `browser_close` | Always cleanup |
| Call `page_find` before navigate | Navigate first |
| Hard-code UUIDs across sessions | Read IDs from each response |
| Log to stdout from wrappers | Keep stdout clean for MCP |
| Use `timeout` wait as first choice | Prefer `element`, `url`, or `networkIdle` |

## Related guides

- [MCP Tools Reference](./mcp-tools-reference.md)
- [MCP Server Setup](./mcp-server-setup.md)
- [Skills](./skills.md) — reusable workflow instructions for Cursor agents
