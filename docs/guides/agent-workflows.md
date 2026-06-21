# Agent Workflows

How AI agents should use the OLTestStack MCP server for reliable browser testing. These patterns apply today with all **19 implemented tools** — only structured assertions and `test.run` orchestration remain planned.

## Recommended workflow pattern

The canonical test flow follows session lifecycle → discovery → interaction → verification → evidence → cleanup:

```text
launch → create page → navigate → discover elements → interact → wait → verify → screenshot → close
```

### Phase mapping (current vs future)

| Step | Tool(s) | Status |
|------|---------|--------|
| Launch browser | `browser.launch` | ✅ Implemented |
| Open tab | `page.create` | ✅ Implemented |
| Go to URL | `page.navigate` | ✅ Implemented |
| Discover UI | `page.elements`, `page.find` | ✅ Implemented |
| Interact | `page.click`, `page.type`, `page.press`, `page.scroll` | ✅ Implemented |
| Synchronize | `page.wait` | ✅ Implemented |
| Verify | `assert.exists`, `assert.text`, `assert.url`, `assert.network` | 🔜 Phase 9 |
| Capture evidence | `page.screenshot`, `page.snapshot`, `page.text`, `page.html` | ✅ Implemented |
| Observe | `page.network`, `page.console` | ✅ Implemented |
| Cleanup | `browser.close` | ✅ Implemented |

Until Phase 9, agents verify outcomes with `page.text`, `page.snapshot`, or `page.wait` (URL condition) instead of `assert.*` tools.

## Stateless command pattern

Every MCP tool call is **stateless at the protocol level**. The server maintains in-memory sessions, but the agent must pass explicit IDs on every call:

```text
browserId  — from browser.launch
pageId     — from page.create
elementId  — from page.elements or page.find
```

### Rules

1. **Never assume IDs persist across server restarts.** If the MCP process restarts, re-launch.
2. **Always pass IDs from the latest success response.** Do not reuse IDs from earlier conversations unless you confirmed the session is still active.
3. **One browser per test flow** unless you intentionally need parallel browsers. Each `browser.launch` is independent.
4. **Close what you open.** Call `browser.close` in cleanup even after failures.

### Minimal state the agent should track

```text
browserId: string | null
pageId: string | null
elementIds: Map<label, string>   // e.g. "submit" → uuid
```

## Element discovery best practices

### `page.elements` vs `page.find`

| Use `page.elements` when… | Use `page.find` when… |
|---------------------------|------------------------|
| You need the full interactive surface | You know the label or role to search for |
| The page is unfamiliar | You are targeting one known control |
| You need to compare multiple candidates | Speed matters and the query is unique |
| You want to detect unexpected UI changes | You already validated the page layout |

### After navigation or reload

Element IDs are **invalidated** on `page.navigate` and `page.reload`. Always rediscover:

```text
page.navigate  →  page.elements (or page.find)  →  interact
```

Skipping rediscovery causes `ELEMENT_NOT_FOUND` on `page.click` and `page.type`.

### Query tips for `page.find`

- Matching is **case-insensitive substring** on visible text, role, and aria-label
- `"Submit"` matches a button labeled "Submit"
- `"email"` matches an input with aria-label "Email"
- If multiple elements match, the first visible match wins (`matchCount` tells you if ambiguity exists)
- Use `page.elements` when `matchCount > 1` and you need to disambiguate

### Truncation

`page.elements` returns at most **200** elements. When `truncated: true`, narrow scope (navigate to a sub-route) or use `page.find` for specific controls.

### Hidden elements

Pass `includeHidden: true` to `page.elements` only when you intentionally need off-screen or `display:none` controls. Default behavior filters to visible elements.

## When to use `page.wait`

Use `page.wait` to reduce flakiness after actions that trigger async updates:

| Condition | Use when |
|-----------|----------|
| `element` | A control appears after async render (SPA, lazy load) |
| `url` | Post-login redirect or client-side routing |
| `networkIdle` | XHR/fetch must finish before verifying (API-driven UI) |
| `timeout` | Fixed delay as last resort |

**Example:** After `page.click` on Submit, wait for URL change before screenshot:

```json
{
  "pageId": "<pageId>",
  "condition": "url",
  "value": "/dashboard",
  "match": "contains"
}
```

For slow initial loads, also use `page.navigate`'s `waitUntil` (`load`, `domcontentloaded`, `networkidle`) and increase `timeoutMs`.

## Recording and test reports

### Auto-recording

`browser.launch` enables recording by default (`recordingEnabled: true`). The server captures events such as:

- `navigation` — after `page.navigate` and `page.reload`
- `action` — after `page.click`, `page.type`, `page.press`, `page.scroll`
- `screenshot` — after `page.screenshot`
- `assertion`, `network`, `console`, `error` — as those tools are wired in later phases

Recording is **in-memory** during the session. It does not slow MCP calls meaningfully.

### Persisting reports (optional)

When `PERSIST_RECORDING=true` and `DATABASE_URL` is set:

1. Events accumulate in memory during the browser session
2. On `browser.close`, the server flushes a test report to PostgreSQL
3. Report includes status (`passed` / `failed` / `error`), events, and timing

Setup:

```bash
cp .env.example .env
bun run docker:up
bun run db:migrate
export PERSIST_RECORDING=true
export DATABASE_URL=postgresql://oltest:oltest@localhost:5433/olteststack
```

Inspect reports with `bun run db:studio` or query the database directly.

### `test.run` (planned — Phase 11)

`test.run` will execute explicit step sequences and return a structured `TestReport` in one call. Until then, agents orchestrate individual tools and rely on `browser.close` for report flush when persistence is enabled.

## Error recovery patterns

| Error | Agent action |
|-------|--------------|
| `SESSION_NOT_FOUND` | `browser.launch` → `page.create` → resume from navigate |
| `ELEMENT_NOT_FOUND` | `page.elements` → refine query → `page.find` again |
| `TIMEOUT` on navigate or wait | Retry with higher `timeoutMs` or change `waitUntil` / wait condition |
| `BROWSER_CRASHED` | New `browser.launch`; do not reuse old IDs |
| `INVALID_INPUT` | Read `error.details.field` and fix the payload |

## Example workflows

### Smoke test

```text
browser.launch
  → page.create
  → page.navigate (https://example.com)
  → page.elements (verify count > 0)
  → browser.close
```

### Login form test (full flow)

```text
browser.launch
  → page.create
  → page.navigate (file://.../fixtures/sample-app/index.html)
  → page.find ("Email")     → page.type
  → page.find ("Password")  → page.type
  → page.find ("Submit")    → page.click
  → page.wait (networkIdle or url)
  → page.screenshot
  → page.console (level: error)
  → browser.close
```

### CRUD create flow

```text
browser.launch
  → page.create
  → page.navigate (app list view)
  → page.find ("Add")       → page.click
  → page.find ("Name")      → page.type
  → page.find ("Save")      → page.click
  → page.wait (networkIdle)
  → page.network (filter: /api/items)
  → page.find (item name)   → confirm visible
  → page.screenshot
  → browser.close
```

### Full login test with assertions (when Phase 9 lands)

```text
browser.launch
  → page.create
  → page.navigate (/login)
  → page.find ("Email")     → page.type
  → page.find ("Password")  → page.type
  → page.find ("Submit")    → page.click
  → page.wait (url contains /dashboard)
  → assert.url (/dashboard)
  → page.screenshot
  → browser.close
```

## Anti-patterns

| Don't | Do instead |
|-------|------------|
| Reuse `elementId` after navigate | Rediscover elements |
| Skip `browser.close` | Always cleanup |
| Call `page.find` before navigate | Navigate first |
| Hard-code UUIDs across sessions | Read IDs from each response |
| Log to stdout from wrappers | Keep stdout clean for MCP |
| Use `timeout` wait as first choice | Prefer `element`, `url`, or `networkIdle` |

## Related guides

- [MCP Tools Reference](./mcp-tools-reference.md)
- [MCP Server Setup](./mcp-server-setup.md)
- [Skills](./skills.md) — reusable workflow instructions for Cursor agents
