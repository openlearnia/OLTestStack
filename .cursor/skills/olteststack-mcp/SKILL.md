---
name: olteststack-mcp
description: >-
  General guide for the OLTestStack AI Browser Testing Framework MCP server.
  Use when configuring, invoking, or troubleshooting olteststack MCP tools,
  browser automation, or Chromium-driven test flows.
disable-model-invocation: true
---

# OLTestStack MCP Server

MCP server exposing **38** high-level browser automation tools (underscore names only). Internally drives Chromium via Puppeteer/CDP; externally presents flat, stateless command payloads.

## Transport: stdio vs HTTP

| Transport | Command | MCP endpoint | Health / dashboard |
|-----------|---------|--------------|-------------------|
| **stdio** (default) | `bun run dev` | subprocess JSON-RPC | optional via `HEALTH_PORT` |
| **HTTP** (local) | `bun run dev:http` | `http://127.0.0.1:8082/mcp` | `http://127.0.0.1:8081/health`, `/dashboard` |
| **HTTP** (Docker) | `docker compose up -d --build` | `http://localhost:8092/mcp` | `http://localhost:8091/health`, `/dashboard` |

Docker: no profiles — `docker compose run --rm migrate` then `docker compose up -d --build`.

Configure Cursor stdio in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "olteststack": {
      "command": "bun",
      "args": ["run", "dev"],
      "cwd": "/path/to/OLTestStack"
    }
  }
}
```

**Stdio rule:** MCP uses stdout for JSON-RPC. Diagnostics go to stderr only.

## Response envelope

Every tool returns `{ "ok": true, "data": { } }` or `{ "ok": false, "error": { "code", "message", "details" } }`.

Always check `ok` before reading `data`.

## Stateless ID pattern

| ID | From | Required by |
|----|------|-------------|
| `browserId` | `browser_launch` | `page_create`, `browser_close`, `session_export`, `send_report` |
| `pageId` | `page_create` | All `page_*` tools |
| `elementId` | `page_find`, `page_elements`, `page_snapshot` | `page_click`, `page_type`, `page_press`, `page_select`, `page_upload` |
| `reportId` | `browser_close` (when persistence on), dashboard | `session_export`, `session_get`, `save_session` |

IDs invalidate on `page_navigate` and `page_reload`. Always re-discover elements after navigation.

**Query capture:** Pass `query` from `page_find` into `page_click` / `page_type`, or use `page_click_query` / `page_type_query` — recordings store the query for `session_export` replay scripts.

## Implemented tools (38)

### Browser (2)

| Tool | Purpose |
|------|---------|
| `browser_launch` | Start Chromium; returns `browserId` |
| `browser_close` | Close browser; returns `reportId` when persistence enabled |

### Page (4)

| Tool | Purpose |
|------|---------|
| `page_create` | Open tab; returns `pageId` |
| `page_navigate` | Go to URL; invalidates elements |
| `page_reload` | Reload page; invalidates elements |
| `page_close` | Close single tab |

### Elements (2)

| Tool | Purpose |
|------|---------|
| `page_elements` | List interactive elements (max 200) |
| `page_find` | Find element by text/role/aria-label query |

### Actions (8)

| Tool | Purpose |
|------|---------|
| `page_click` | Click by `elementId` (optional `query` for replay) |
| `page_click_query` | Find + click atomically; `preferRegion` for grids |
| `page_type` | Type into input/textarea (optional `query` for replay) |
| `page_type_query` | Find + type atomically; `preferRegion` for grids |
| `page_select` | Select option on native select/combobox |
| `page_upload` | Upload file to file input |
| `page_press` | Keyboard key — pass `elementId` when focus matters |
| `page_scroll` | Scroll viewport |

Prefer `page_click_query` / `page_type_query` over find+click for data grids; use `preferRegion` (`toolbar`, `filter`, `grid-header`, `grid-body`).

### Inspection (4)

| Tool | Purpose |
|------|---------|
| `page_screenshot` | PNG capture; returns `url` when health server up; `returnInline: true` for MCP image |
| `page_snapshot` | URL, title, DOM summary, elements |
| `page_text` | Visible text extraction |
| `page_html` | Full outer HTML |

**Screenshots:** When health/dashboard HTTP is enabled, `data.url` is fetchable (local `8081`, Docker `8091`). Set `returnInline: true` for inline PNG in MCP response (under 1MB). Fall back to `data.file` on disk for stdio-only.

### Monitoring (2)

| Tool | Purpose |
|------|---------|
| `page_network` | Captured requests (optional URL filter) |
| `page_console` | Console messages (optional level filter) |

### Waiting (1)

| Tool | Purpose |
|------|---------|
| `page_wait` | `element`, `elementHidden`, `url`, `networkIdle`, `networkRequest`, `timeout` |

### Assertions (4)

| Tool | Purpose |
|------|---------|
| `assert_exists` | Element visible by query or elementId; `negate`, `soft` |
| `assert_text` | Page text contains/equals; `negate`, `soft` |
| `assert_url` | URL contains/equals; `negate`, `soft` |
| `assert_network` | Request matching URL and status; `negate`, `soft` |

### Frames, cookies, batch assert (3)

| Tool | Purpose |
|------|---------|
| `page_frame` | Switch iframe context |
| `page_cookies` | Get/set/delete cookies |
| `page_assert_state` | Batch assertions in one call |

### Session & test (8)

| Tool | Purpose |
|------|---------|
| `session_status` | Live session health and metadata |
| `session_get` | Fetch persisted session by `reportId`/`sessionId` |
| `session_list` | List persisted sessions (dashboard API shape) |
| `session_export` | Export recording as `.olteststack.json` script (`browserId` live or `reportId` post-close) |
| `save_session` | Promote ephemeral DB session to saved (no TTL) |
| `send_report` | Dump full session debug state with `debugId` |
| `script_lint` | Validate `.olteststack.json` script before `test_run` |
| `test_run` | Execute steps/script/suite; `${VAR}` substitution; `scripts[]`, `suiteFile` |

## Canonical workflow

```text
browser_launch → page_create → page_navigate → page_find/page_elements
  → page_type_query/page_click_query → page_wait → assert_* → page_screenshot → browser_close
```

Record → export → replay:

```text
(agent-driven session) → session_export({ browserId }) → browser_close → reportId
  → session_export({ reportId })  // optional post-close from DB
  → test_run({ scriptFile }) or test_run({ scripts: [...] })
```

Always call `browser_close` in cleanup, even after failures.

## Error codes

| Code | Recovery |
|------|----------|
| `INVALID_INPUT` | Fix field per `error.details` |
| `SESSION_NOT_FOUND` | Re-launch browser |
| `ELEMENT_NOT_FOUND` | Re-discover with `page_elements` or use query tools |
| `TIMEOUT` | Increase `timeoutMs` |
| `BROWSER_CRASHED` | New `browser_launch` |
| `NAVIGATION_FAILED` | Check URL and network |

## Debugging

- `send_report` with `{ "browserId": "...", "note": "..." }` — full session state, returns `debugId`
- `session_get` with `{ "reportId": "..." }` — persisted events from PostgreSQL
- Stderr logs `[olteststack:debug]` for grep

## Project skills

| Skill | Use for |
|-------|---------|
| `browser-test-login` | Login/sign-in flows |
| `browser-test-crud` | Create/read/update/delete flows |
| `session-record-export` | Record → export → replay workflow |
| `olteststack-mcp` | General MCP reference (this file) |

## Documentation

- [Guides index](../../../docs/guides/README.md)
- [MCP Server Setup](../../../docs/guides/mcp-server-setup.md)
- [MCP Tools Reference](../../../docs/guides/mcp-tools-reference.md)
- [Agent Workflows](../../../docs/guides/agent-workflows.md)
- [Skills guide](../../../docs/guides/skills.md)
