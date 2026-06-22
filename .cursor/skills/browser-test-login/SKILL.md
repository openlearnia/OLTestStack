---
name: browser-test-login
description: >-
  Tests login, sign-in, and authentication flows using OLTestStack MCP tools.
  Use when asked to verify login forms, credentials, redirects, or session
  establishment. Requires olteststack MCP server connected.
disable-model-invocation: true
---

# Browser Test — Login Flow

## Prerequisites

- OLTestStack MCP server connected (19 implemented tools)
- Target login URL (`https://`, `http://`, or `file://`)
- Test credentials (or local fixture: `fixtures/sample-app/index.html` accepts any values)

## Stateless ID pattern

Every tool call requires explicit IDs from prior responses:

| ID | Source |
|----|--------|
| `browserId` | `browser_launch` |
| `pageId` | `page_create` |
| `elementId` | `page_find` or `page_elements` |

Track IDs in the current session only. Re-launch after `SESSION_NOT_FOUND` or MCP restart.

## Workflow

```
launch → create page → navigate → find fields → type → click → wait → verify → screenshot → close
```

### 1. Launch

```json
{ "headless": true }
```

Store `browserId` from `data.browserId`.

### 2. Create page

```json
{ "browserId": "<browserId>" }
```

Store `pageId`. Network and console monitoring start automatically.

### 3. Navigate

```json
{
  "pageId": "<pageId>",
  "url": "https://app.example.com/login",
  "waitUntil": "load",
  "timeoutMs": 30000
}
```

Navigation **invalidates** all prior `elementId` values.

### 4. Discover fields

Use `page_find` for each control:

```json
{ "pageId": "<pageId>", "query": "Email" }
{ "pageId": "<pageId>", "query": "Password" }
{ "pageId": "<pageId>", "query": "Submit" }
```

If `ELEMENT_NOT_FOUND`, call `page_elements` and pick controls by role (`textbox`, `button`).

### 5. Interact

```json
{ "pageId": "<pageId>", "elementId": "<emailId>", "value": "user@example.com" }
{ "pageId": "<pageId>", "elementId": "<passwordId>", "value": "secret" }
{ "pageId": "<pageId>", "elementId": "<submitId>" }
```

Last call is `page_click`.

### 6. Synchronize

Prefer `page_wait` over arbitrary delays:

```json
{ "pageId": "<pageId>", "condition": "url", "value": "/dashboard", "match": "contains" }
```

Or `{ "condition": "networkIdle" }` for SPA/API-driven redirects.

### 7. Verify

`assert.*` tools are **not yet implemented**. Verify with:

- `page_wait` (URL condition)
- `page_text` or `page_snapshot` for welcome content
- `page_find` for post-login UI elements

### 8. Evidence

```json
{ "pageId": "<pageId>", "fullPage": true }
{ "pageId": "<pageId>", "level": "error" }
```

Screenshot and console calls respectively.

### 9. Cleanup (required)

Always call `browser_close` in a finally block:

```json
{ "browserId": "<browserId>" }
```

## Error recovery

| Error | Action |
|-------|--------|
| `SESSION_NOT_FOUND` | `browser_launch` → `page_create` → resume from navigate |
| `ELEMENT_NOT_FOUND` | `page_elements` → refine query → `page_find` again |
| `TIMEOUT` | Increase `timeoutMs` or use `waitUntil: "domcontentloaded"` |
| `BROWSER_CRASHED` | New `browser_launch`; discard old IDs |
| `INVALID_INPUT` | Read `error.details.field` and fix payload |

## Response envelope

Check every response:

- Success: `{ "ok": true, "data": { ... } }`
- Error: `{ "ok": false, "error": { "code", "message", "details" } }`

## Related docs

- [Agent Workflows](../../../docs/guides/agent-workflows.md)
- [MCP Tools Reference](../../../docs/guides/mcp-tools-reference.md)
- [MCP Server Setup](../../../docs/guides/mcp-server-setup.md)
