---
name: olteststack-mcp
description: >-
  General guide for the OLTestStack AI Browser Testing Framework MCP server.
  Use when configuring, invoking, or troubleshooting olteststack MCP tools,
  browser automation, or Chromium-driven test flows.
disable-model-invocation: true
---

# OLTestStack MCP Server

MCP server exposing high-level browser automation tools. Internally drives Chromium via Puppeteer/CDP; externally presents flat, stateless command payloads.

## Transport: stdio vs HTTP

| Transport | Command | Best for |
|-----------|---------|----------|
| **stdio** (default) | `bun run dev` | Cursor, Claude Desktop — client spawns subprocess, no ports |
| **HTTP** (port 8082) | `bun run dev:http` | Docker, remote hosts, CI, multiple clients |

Health endpoint (HTTP mode): `http://127.0.0.1:8081/health`

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

Every tool returns:

```json
{ "ok": true, "data": { } }
```

or

```json
{ "ok": false, "error": { "code": "ERROR_CODE", "message": "...", "details": { } } }
```

Always check `ok` before reading `data`.

## Stateless ID pattern

| ID | From | Required by |
|----|------|-------------|
| `browserId` | `browser_launch` | `page_create`, `browser_close`, `session_export` |
| `pageId` | `page_create` | All `page_*` tools |
| `elementId` | `page_find`, `page_elements`, `page_snapshot` | `page_click`, `page_type` |

IDs invalidate on `page_navigate` and `page_reload`. Always re-discover elements after navigation.

## Implemented tools (25)

### Browser (2)

| Tool | Purpose |
|------|---------|
| `browser_launch` | Start Chromium; returns `browserId` |
| `browser_close` | Close browser; flush recordings if `PERSIST_RECORDING=true` |

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

### Actions (4)

| Tool | Purpose |
|------|---------|
| `page_click` | Click by `elementId` |
| `page_type` | Type into input/textarea |
| `page_press` | Keyboard key (Enter, Tab, Escape, …) |
| `page_scroll` | Scroll viewport |

### Inspection (4)

| Tool | Purpose |
|------|---------|
| `page_screenshot` | PNG capture to `SCREENSHOT_DIR` |
| `page_snapshot` | URL, title, DOM summary, elements |
| `page_text` | Visible text extraction |
| `page_html` | Full outer HTML |

### Monitoring (2)

| Tool | Purpose |
|------|---------|
| `page_network` | Captured requests (optional URL filter) |
| `page_console` | Console messages (optional level filter) |

### Waiting (1)

| Tool | Purpose |
|------|---------|
| `page_wait` | Wait for element, URL, networkIdle, or timeout |

### Assertions (4)

| Tool | Purpose |
|------|---------|
| `assert_exists` | Element visible by query or elementId |
| `assert_text` | Page text contains/equals expected |
| `assert_url` | URL contains/equals expected |
| `assert_network` | Request matching URL and status |

### Session & test (2)

| Tool | Purpose |
|------|---------|
| `session_export` | Export recording buffer as `.olteststack.json` script |
| `test_run` | Execute steps/script and return `TestReport` |

## Canonical workflow

```text
browser_launch → page_create → page_navigate → page_find/page_elements
  → page_type/page_click → page_wait → assert_* → page_screenshot → browser_close
```

Record → export → replay:

```text
(agent-driven session) → session_export → save script → test_run(scriptFile) → browser_close
```

Always call `browser_close` in cleanup, even after failures.

## Error codes

| Code | Recovery |
|------|----------|
| `INVALID_INPUT` | Fix field per `error.details` |
| `SESSION_NOT_FOUND` | Re-launch browser |
| `ELEMENT_NOT_FOUND` | Re-discover with `page_elements` |
| `TIMEOUT` | Increase `timeoutMs` |
| `BROWSER_CRASHED` | New `browser_launch` |
| `NAVIGATION_FAILED` | Check URL and network |

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
