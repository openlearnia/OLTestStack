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
| `browserId` | `browser.launch` | `page.create`, `browser.close` |
| `pageId` | `page.create` | All `page.*` tools |
| `elementId` | `page.find`, `page.elements`, `page.snapshot` | `page.click`, `page.type` |

IDs invalidate on `page.navigate` and `page.reload`. Always re-discover elements after navigation.

## Implemented tools (19)

### Browser (2)

| Tool | Purpose |
|------|---------|
| `browser.launch` | Start Chromium; returns `browserId` |
| `browser.close` | Close browser; flush recordings if `PERSIST_RECORDING=true` |

### Page (4)

| Tool | Purpose |
|------|---------|
| `page.create` | Open tab; returns `pageId` |
| `page.navigate` | Go to URL; invalidates elements |
| `page.reload` | Reload page; invalidates elements |
| `page.close` | Close single tab |

### Elements (2)

| Tool | Purpose |
|------|---------|
| `page.elements` | List interactive elements (max 200) |
| `page.find` | Find element by text/role/aria-label query |

### Actions (4)

| Tool | Purpose |
|------|---------|
| `page.click` | Click by `elementId` |
| `page.type` | Type into input/textarea |
| `page.press` | Keyboard key (Enter, Tab, Escape, …) |
| `page.scroll` | Scroll viewport |

### Inspection (4)

| Tool | Purpose |
|------|---------|
| `page.screenshot` | PNG capture to `SCREENSHOT_DIR` |
| `page.snapshot` | URL, title, DOM summary, elements |
| `page.text` | Visible text extraction |
| `page.html` | Full outer HTML |

### Monitoring (2)

| Tool | Purpose |
|------|---------|
| `page.network` | Captured requests (optional URL filter) |
| `page.console` | Console messages (optional level filter) |

### Waiting (1)

| Tool | Purpose |
|------|---------|
| `page.wait` | Wait for element, URL, networkIdle, or timeout |

## Planned (not registered)

| Tool | Phase |
|------|-------|
| `assert.exists`, `assert.text`, `assert.url`, `assert.network` | 9 |
| `test.run` | 11 |

Until Phase 9, verify with `page.text`, `page.snapshot`, `page.wait`, or `page.find`.

## Canonical workflow

```text
browser.launch → page.create → page.navigate → page.find/page.elements
  → page.type/page.click → page.wait → page.screenshot → browser.close
```

Always call `browser.close` in cleanup, even after failures.

## Error codes

| Code | Recovery |
|------|----------|
| `INVALID_INPUT` | Fix field per `error.details` |
| `SESSION_NOT_FOUND` | Re-launch browser |
| `ELEMENT_NOT_FOUND` | Re-discover with `page.elements` |
| `TIMEOUT` | Increase `timeoutMs` |
| `BROWSER_CRASHED` | New `browser.launch` |
| `NAVIGATION_FAILED` | Check URL and network |

## Project skills

| Skill | Use for |
|-------|---------|
| `browser-test-login` | Login/sign-in flows |
| `browser-test-crud` | Create/read/update/delete flows |
| `olteststack-mcp` | General MCP reference (this file) |

## Documentation

- [Guides index](../../../docs/guides/README.md)
- [MCP Server Setup](../../../docs/guides/mcp-server-setup.md)
- [MCP Tools Reference](../../../docs/guides/mcp-tools-reference.md)
- [Agent Workflows](../../../docs/guides/agent-workflows.md)
- [Skills guide](../../../docs/guides/skills.md)
