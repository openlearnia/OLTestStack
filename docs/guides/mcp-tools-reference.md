# MCP Tools Reference

Complete reference for OLTestStack MCP tools. All tools return a JSON envelope as MCP text content:

**Success:**

```json
{
  "ok": true,
  "data": { }
}
```

**Error:**

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { }
  }
}
```

## Status summary

| Status | Count | Tools |
|--------|-------|-------|
| **Implemented** | 19 | Browser (2), Page (4), Elements (2), Actions (4), Inspection (4), Monitoring (2), Wait (1) |
| **Planned** | 5 | Assertions (4), Test (1) |
| **Total (V1)** | 22 | See [planned tools](#planned-tools) below |

---

## Implemented tools

### `browser.launch`

Launch a new Chromium browser instance.

**Input schema**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `headless` | boolean | no | `true` | Run without visible window |
| `recordingEnabled` | boolean | no | `true` | Enable session event recording |
| `viewport.width` | integer (≥320) | no | `1280` | Viewport width |
| `viewport.height` | integer (≥240) | no | `720` | Viewport height |
| `userAgent` | string | no | — | Custom user agent string |

**Example input**

```json
{
  "headless": true,
  "recordingEnabled": true,
  "viewport": { "width": 1280, "height": 720 }
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "browserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "createdAt": "2026-06-21T12:00:00.000Z"
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Unknown fields, invalid viewport values |
| `INTERNAL_ERROR` | Chromium failed to launch (binary missing, permissions) |

**Agent workflow:** Always the first step. Store `browserId` for all subsequent commands. Call `browser.close` in cleanup.

---

### `browser.close`

Close a browser and all its pages. Flushes recordings to PostgreSQL when `PERSIST_RECORDING=true`.

**Input schema**

| Field | Type | Required |
|-------|------|----------|
| `browserId` | string (UUID) | yes |

**Example input**

```json
{
  "browserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "closed": true
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Missing or malformed `browserId` |
| `SESSION_NOT_FOUND` | Browser already closed or unknown ID |
| `INTERNAL_ERROR` | CDP close failure |

**Agent workflow:** Always call in a `finally` block. Idempotent from the agent's perspective only if the browser still exists.

---

### `page.create`

Open a new tab in an existing browser.

**Input schema**

| Field | Type | Required |
|-------|------|----------|
| `browserId` | string (UUID) | yes |

**Example input**

```json
{
  "browserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "browserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Missing or malformed `browserId` |
| `SESSION_NOT_FOUND` | Browser not found |
| `BROWSER_CRASHED` | Browser disconnected or crashed |
| `INTERNAL_ERROR` | CDP page creation failure |

**Agent workflow:** Call once per tab under test. Store `pageId` for all page-scoped commands.

---

### `page.navigate`

Navigate a page to a URL. Waits for load by default. **Invalidates all previously discovered elements.**

**Input schema**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pageId` | string (UUID) | yes | — | Target page |
| `url` | string (URI) | yes | — | Fully qualified `http://`, `https://`, or `file://` URL |
| `waitUntil` | enum | no | `"load"` | `"load"` \| `"domcontentloaded"` \| `"networkidle"` |
| `timeoutMs` | integer (≥1000) | no | `30000` | Navigation timeout |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "url": "https://example.com",
  "waitUntil": "load",
  "timeoutMs": 30000
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "url": "https://example.com/",
    "title": "Example Domain",
    "statusCode": 200
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Bad URL, missing scheme, unknown fields |
| `SESSION_NOT_FOUND` | Page or browser not found |
| `BROWSER_CRASHED` | Browser crashed during navigation |
| `NAVIGATION_FAILED` | Page failed to load (DNS, 4xx/5xx, etc.) |
| `TIMEOUT` | Navigation exceeded `timeoutMs` |

**Agent workflow:** After every successful navigate, call `page.elements` or `page.find` before interacting. Navigation events are recorded when `recordingEnabled` is true.

---

### `page.reload`

Reload the current page. **Invalidates all previously discovered elements.**

**Input schema**

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `pageId` | string (UUID) | yes | — |
| `waitUntil` | enum | no | `"load"` |
| `timeoutMs` | integer (≥1000) | no | `30000` |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "url": "https://example.com/",
    "title": "Example Domain"
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Malformed input |
| `SESSION_NOT_FOUND` | Page not found |
| `TIMEOUT` | Reload exceeded timeout |
| `INTERNAL_ERROR` | CDP reload failure |

**Agent workflow:** Treat like navigation — rediscover elements after reload.

---

### `page.close`

Close a single tab. The browser stays open if other pages exist.

**Input schema**

| Field | Type | Required |
|-------|------|----------|
| `pageId` | string (UUID) | yes |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "closed": true
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Malformed `pageId` |
| `SESSION_NOT_FOUND` | Page already closed |
| `INTERNAL_ERROR` | CDP close failure |

---

### `page.elements`

List visible interactive elements on the page via the accessibility tree. Registers elements in the session for later targeting with `page.click`, `page.type`, and related action tools.

**Input schema**

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `pageId` | string (UUID) | yes | — |
| `includeHidden` | boolean | no | `false` |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "includeHidden": false
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "elements": [
      {
        "elementId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
        "role": "textbox",
        "text": "Email",
        "visible": true,
        "tag": "input"
      },
      {
        "elementId": "d4e5f6a7-b8c9-0123-def0-234567890123",
        "role": "button",
        "text": "Submit",
        "visible": true,
        "tag": "button"
      }
    ],
    "count": 2
  }
}
```

When more than 200 elements match, `truncated: true` is included and only the first 200 are returned.

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Malformed input |
| `SESSION_NOT_FOUND` | Page not found |
| `INTERNAL_ERROR` | Accessibility tree extraction failed |

**Agent workflow:** Use for page reconnaissance — understand what is clickable or typeable before choosing targets. Prefer this when you need the full interactive surface.

---

### `page.find`

Find a single interactive element by text query. Matches visible text, role, or aria-label (case-insensitive substring). Registers the matched element in the session.

**Input schema**

| Field | Type | Required |
|-------|------|----------|
| `pageId` | string (UUID) | yes |
| `query` | string (min 1 char) | yes |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "query": "Submit"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "element": {
      "elementId": "d4e5f6a7-b8c9-0123-def0-234567890123",
      "role": "button",
      "text": "Submit",
      "visible": true,
      "tag": "button"
    },
    "matchCount": 1
  }
}
```

When `matchCount > 1`, the first visible match is returned.

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Empty query or malformed input |
| `SESSION_NOT_FOUND` | Page not found |
| `ELEMENT_NOT_FOUND` | No visible element matches the query |
| `INTERNAL_ERROR` | Tree extraction failed |

**Agent workflow:** Use when you know the label (e.g. "Login", "Email", "Submit"). Faster than scanning a full `page.elements` list for simple flows.

---

### `page.click`

Click an interactive element by `elementId`. Scrolls into view and waits for the element to be actionable.

**Input schema**

| Field | Type | Required |
|-------|------|----------|
| `pageId` | string (UUID) | yes |
| `elementId` | string (UUID) | yes |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "elementId": "d4e5f6a7-b8c9-0123-def0-234567890123"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "clicked": true,
    "elementId": "d4e5f6a7-b8c9-0123-def0-234567890123"
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Malformed input |
| `SESSION_NOT_FOUND` | Page not found |
| `ELEMENT_NOT_FOUND` | Unknown or stale `elementId` |
| `TIMEOUT` | Element not actionable within timeout |
| `INTERNAL_ERROR` | CDP click failure |

**Agent workflow:** Discover with `page.find` or `page.elements` first. Rediscover after navigation — stale `elementId` values fail.

---

### `page.type`

Type text into an input or textarea element. Clears existing value unless `append` is true.

**Input schema**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pageId` | string (UUID) | yes | — | Target page |
| `elementId` | string (UUID) | yes | — | Typeable element from discovery |
| `value` | string | yes | — | Text to type |
| `append` | boolean | no | `false` | Append instead of replace |
| `delay` | integer (≥0) | no | `0` | Per-keystroke delay in ms |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "elementId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "value": "user@example.com"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "typed": true,
    "elementId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "value": "user@example.com"
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Non-typeable element (e.g. button), malformed input |
| `SESSION_NOT_FOUND` | Page not found |
| `ELEMENT_NOT_FOUND` | Unknown or stale `elementId` |
| `INTERNAL_ERROR` | CDP type failure |

**Agent workflow:** Target `textbox`, `searchbox`, or `textarea` roles. Use `page.find` with field labels like "Email" or "Password".

---

### `page.press`

Press a keyboard key on the page (Enter, Tab, Escape, arrows, modifier combos).

**Input schema**

| Field | Type | Required |
|-------|------|----------|
| `pageId` | string (UUID) | yes |
| `key` | string (min 1 char) | yes |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "key": "Enter"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "pressed": true,
    "key": "Enter"
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Unrecognized key name |
| `SESSION_NOT_FOUND` | Page not found |
| `INTERNAL_ERROR` | CDP key press failure |

**Agent workflow:** Use after focusing an input to submit forms (`Enter`) or dismiss dialogs (`Escape`).

---

### `page.scroll`

Scroll the page in a direction. Default amount is one viewport height/width.

**Input schema**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pageId` | string (UUID) | yes | — | Target page |
| `direction` | enum | yes | — | `"up"` \| `"down"` \| `"left"` \| `"right"` |
| `amount` | integer (≥1) | no | viewport size | Scroll distance in pixels |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "direction": "down"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "scrolled": true,
    "direction": "down",
    "amount": 720
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Invalid direction or amount |
| `SESSION_NOT_FOUND` | Page not found |
| `INTERNAL_ERROR` | CDP scroll failure |

**Agent workflow:** Scroll to reveal off-screen elements, then call `page.elements` or `page.find` again.

---

### `page.screenshot`

Capture a PNG screenshot of the page viewport or full scrollable page. Saves to `SCREENSHOT_DIR`.

**Input schema**

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `pageId` | string (UUID) | yes | — |
| `fullPage` | boolean | no | `false` |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "fullPage": true
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "file": "./screenshots/2026-06-21T12-00-00-000Z_b2c3d4e5-f6a7-8901-bcde-f12345678901.png",
    "width": 1280,
    "height": 2400,
    "fullPage": true
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Malformed input |
| `SESSION_NOT_FOUND` | Page not found |
| `INTERNAL_ERROR` | Capture or file write failure |

**Agent workflow:** Capture on success and failure for evidence. Screenshot events are recorded when `recordingEnabled` is true.

---

### `page.snapshot`

Get a comprehensive page snapshot: URL, title, DOM summary, and interactive elements.

**Input schema**

| Field | Type | Required |
|-------|------|----------|
| `pageId` | string (UUID) | yes |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "url": "https://example.com/",
    "title": "Example Domain",
    "domSummary": {
      "nodeCount": 42,
      "formCount": 1,
      "linkCount": 3,
      "imageCount": 0
    },
    "elements": [
      {
        "elementId": "d4e5f6a7-b8c9-0123-def0-234567890123",
        "role": "button",
        "text": "Submit",
        "visible": true,
        "tag": "button"
      }
    ]
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Malformed input |
| `SESSION_NOT_FOUND` | Page not found |
| `INTERNAL_ERROR` | Snapshot extraction failed |

**Agent workflow:** One-call page reconnaissance when you need URL, title, and elements together. Registers elements for subsequent actions.

---

### `page.text`

Extract visible text content from the page (whitespace-normalized). Truncated at 50,000 characters.

**Input schema**

| Field | Type | Required |
|-------|------|----------|
| `pageId` | string (UUID) | yes |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "text": "Example Domain\nThis domain is for use in illustrative examples...",
    "length": 187
  }
}
```

When text exceeds 50,000 characters, `truncated: true` is included.

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Malformed input |
| `SESSION_NOT_FOUND` | Page not found |
| `INTERNAL_ERROR` | Text extraction failed |

**Agent workflow:** Quick content check without parsing HTML. Use `page.find` or assertion tools (when available) for targeted verification.

---

### `page.html`

Extract the full outer HTML of the page document. Truncated at 500,000 characters.

**Input schema**

| Field | Type | Required |
|-------|------|----------|
| `pageId` | string (UUID) | yes |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "html": "<!DOCTYPE html><html>...</html>",
    "length": 1256
  }
}
```

When HTML exceeds 500,000 characters, `truncated: true` is included.

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Malformed input |
| `SESSION_NOT_FOUND` | Page not found |
| `INTERNAL_ERROR` | HTML extraction failed |

**Agent workflow:** Use for structural inspection. Prefer `page.text` or `page.snapshot` for agent-readable summaries.

---

### `page.network`

Return captured network requests for the page. Supports optional URL filter and since timestamp. Monitoring starts automatically on `page.create`.

**Input schema**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pageId` | string (UUID) | yes | — | Target page |
| `filter` | string | no | — | Substring match on request URL |
| `since` | string (date-time) | no | — | Only entries after this ISO timestamp |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "filter": "/api/"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "requests": [
      {
        "requestId": "req-001",
        "url": "https://example.com/api/users",
        "method": "GET",
        "status": 200,
        "resourceType": "fetch",
        "timestamp": "2026-06-21T12:00:01.000Z",
        "failed": false,
        "durationMs": 142
      }
    ],
    "count": 1,
    "errorCount": 0
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Malformed `since` timestamp |
| `SESSION_NOT_FOUND` | Page not found |

**Agent workflow:** Verify API calls after form submit or navigation. Check `errorCount` for failed requests.

---

### `page.console`

Return captured browser console messages (logs, warnings, errors). Monitoring starts automatically on `page.create`.

**Input schema**

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `pageId` | string (UUID) | yes | — |
| `level` | enum | no | `"all"` |

`level` values: `"all"` \| `"error"` \| `"warn"` \| `"log"` \| `"info"` \| `"debug"`

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "level": "error"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "messages": [
      {
        "level": "error",
        "message": "Uncaught TypeError: ...",
        "timestamp": "2026-06-21T12:00:02.000Z",
        "source": "https://example.com/app.js"
      }
    ],
    "count": 1,
    "errorCount": 1,
    "warnCount": 0
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Invalid level |
| `SESSION_NOT_FOUND` | Page not found |

**Agent workflow:** Check after interactions for JS errors. Filter by `"error"` to reduce noise.

---

### `page.wait`

Wait for a condition: element appearance, URL match, network idle, or fixed timeout.

**Input schema**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pageId` | string (UUID) | yes | — | Target page |
| `condition` | enum | yes | — | `"element"` \| `"url"` \| `"networkIdle"` \| `"timeout"` |
| `query` | string | when `element` | — | Element search query (same as `page.find`) |
| `value` | string | when `url` | — | Expected URL or substring |
| `match` | enum | no | `"contains"` | `"equals"` \| `"contains"` (URL condition only) |
| `durationMs` | integer (≥100) | when `timeout` | — | Fixed wait duration |
| `timeoutMs` | integer (≥1000) | no | `30000` | Max wait time for polling conditions |

**Example input (element)**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "condition": "element",
  "query": "Submit"
}
```

**Example input (URL)**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "condition": "url",
  "value": "/dashboard",
  "match": "contains"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "satisfied": true,
    "condition": "url",
    "elapsedMs": 842,
    "url": "https://example.com/dashboard"
  }
}
```

For `condition: "element"`, `elementId` is included in the response. For `condition: "timeout"`, only `satisfied`, `condition`, and `elapsedMs` are returned.

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Missing required field for condition (e.g. `query` for `element`) |
| `SESSION_NOT_FOUND` | Page not found |
| `TIMEOUT` | Condition not satisfied within `timeoutMs` |
| `INTERNAL_ERROR` | CDP polling failure |

**Agent workflow:** Prefer over arbitrary sleeps. Use `url` after login redirects, `networkIdle` after API-driven UI updates, `element` for async-rendered controls.

---

## Planned tools

The following **5 tools** are specified in `requirements/` and scheduled per `docs/plans/v1-implementation-plan.md`. They are **not registered** in the server today.

| Tool | Phase | Description |
|------|-------|-------------|
| `assert.exists` | 9 | Assert an element exists |
| `assert.text` | 9 | Assert page contains text |
| `assert.url` | 9 | Assert current URL matches |
| `assert.network` | 9 | Assert a network request occurred |
| `test.run` | 11 | Execute a step sequence and return a structured test report |

---

## Example: login test scenario

This flow uses **currently available tools** end-to-end.

Target: `fixtures/sample-app/index.html` (local login form with Email, Password, Submit).

### Full agent sequence

```text
1. browser.launch        → browserId
2. page.create           → pageId (starts network/console monitoring)
3. page.navigate         → file:///path/to/OLTestStack/fixtures/sample-app/index.html
4. page.find "Email"     → elementId for email field
5. page.type             → fill email
6. page.find "Password"  → elementId for password field
7. page.type             → fill password
8. page.find "Submit"    → elementId for submit button
9. page.click            → click Submit
10. page.wait            → wait for navigation or network idle
11. page.screenshot      → capture evidence
12. browser.close        → cleanup
```

**Example agent sequence:**

```json
// 1. Launch
{ "headless": true }

// 2. Create page
{ "browserId": "<from step 1>" }

// 3. Navigate
{
  "pageId": "<from step 2>",
  "url": "file:///Users/you/OLTestStack/fixtures/sample-app/index.html"
}

// 4. Find and type email
{ "pageId": "<from step 2>", "query": "Email" }
{ "pageId": "<from step 2>", "elementId": "<email elementId>", "value": "user@example.com" }

// 5. Find and type password
{ "pageId": "<from step 2>", "query": "Password" }
{ "pageId": "<from step 2>", "elementId": "<password elementId>", "value": "secret" }

// 6. Click submit and wait
{ "pageId": "<from step 2>", "query": "Submit" }
{ "pageId": "<from step 2>", "elementId": "<submit elementId>" }
{ "pageId": "<from step 2>", "condition": "networkIdle" }

// 7. Screenshot and close
{ "pageId": "<from step 2>" }
{ "browserId": "<from step 1>" }
```

Assertion tools (`assert.url`, etc.) land in Phase 9 for structured pass/fail checks.

---

## Error code reference

| Code | Meaning | Typical recovery |
|------|---------|------------------|
| `INVALID_INPUT` | Schema validation failed | Fix field names, types, or required fields |
| `SESSION_NOT_FOUND` | Unknown `browserId` or `pageId` | Re-launch browser and create page |
| `ELEMENT_NOT_FOUND` | Query matched nothing | Call `page.elements`, try different query |
| `NAVIGATION_FAILED` | Page failed to load | Check URL, network, server status |
| `TIMEOUT` | Operation exceeded timeout | Increase `timeoutMs` or change `waitUntil` |
| `BROWSER_CRASHED` | Chromium disconnected | `browser.launch` again |
| `ASSERTION_FAILED` | Assertion did not pass (Phase 9+) | Inspect page state, fix test or app |
| `INTERNAL_ERROR` | Unexpected server error | Check stderr logs, retry |

---

## Related guides

- [MCP Server Setup](./mcp-server-setup.md)
- [Agent Workflows](./agent-workflows.md)
- [Skills](./skills.md)
