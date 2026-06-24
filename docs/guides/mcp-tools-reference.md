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
| **Implemented** | 27 | All V1 tools — browser, page, elements, actions, inspection, monitoring, wait, assertions, session_export, save_session, send_report, test_run |
| **Planned** | 0 | — |
| **Total (V1)** | 27 | Complete |

---

## Implemented tools

### `browser_launch`

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

**Agent workflow:** Always the first step. Store `browserId` for all subsequent commands. Call `browser_close` in cleanup.

---

### `browser_close`

Close a browser and all its pages. Flushes recordings to PostgreSQL when `PERSIST_RECORDING=true` (default when `DATABASE_URL` is set). Unsaved sessions expire after `SESSION_TTL_HOURS` (default 24h). Failed or error sessions are auto-promoted to **saved** (no TTL) when `AUTO_SAVE_FAILED=true` or `AUTO_SAVE_FAILED_SESSIONS=true` (also default when `DATABASE_URL` is set). Applies to manual close and `test_run` cleanup.

**Input schema**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `browserId` | string (UUID) | yes | Active browser session |
| `testName` | string | no | Optional report name when persisting to PostgreSQL |

**Example input**

```json
{
  "browserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "testName": "Login regression"
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

### `page_create`

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

### `page_navigate`

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

**Agent workflow:** After every successful navigate, call `page_elements` or `page_find` before interacting. Navigation events are recorded when `recordingEnabled` is true.

---

### `page_reload`

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

### `page_close`

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

### `page_elements`

List visible interactive elements on the page via the accessibility tree. Registers elements in the session for later targeting with `page_click`, `page_type`, and related action tools.

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

### `page_find`

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
    "matchCount": 3,
    "selectedReason": "toolbar/filter region",
    "candidates": [
      {
        "element": { "elementId": "...", "role": "textbox", "text": "Name", "visible": true, "tag": "input" },
        "reason": "toolbar/filter region"
      },
      {
        "element": { "elementId": "...", "role": "columnheader", "text": "Name", "visible": true, "tag": "div" },
        "reason": "column header (deprioritized vs filter inputs)"
      }
    ]
  }
}
```

When `matchCount > 1`, the best-ranked match is returned (not DOM order). Ranking prefers `input`/`textarea` over labels and column headers, and toolbar/floating-filter regions over grid headers. Check `selectedReason` and optional `candidates` (up to 5) when ambiguous — e.g. query `"Name"` on a data grid may match both a filter input and a column header.

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Empty query or malformed input |
| `SESSION_NOT_FOUND` | Page not found |
| `ELEMENT_NOT_FOUND` | No visible element matches the query |
| `INTERNAL_ERROR` | Tree extraction failed |

**Agent workflow:** Use when you know the label (e.g. "Login", "Email", "Submit"). Faster than scanning a full `page_elements` list for simple flows. On virtualized grids, prefer filter/toolbar queries (`"Name"`, `"Salary"`) and confirm `tag` is `input` before calling `page_type`.

---

### `page_click`

Click an interactive element by `elementId`. Scrolls into view and waits for the element to be actionable. When recording is enabled, the optional `query` field (or the query from a prior `page_find`) is stored on the action event for `session_export` replay scripts.

**Input schema**

| Field | Type | Required |
|-------|------|----------|
| `pageId` | string (UUID) | yes |
| `elementId` | string (UUID) | yes |
| `query` | string | no — recommended after `page_find` for replayable exports |

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

**Agent workflow:** Discover with `page_find` or `page_elements` first. Rediscover after navigation — stale `elementId` values fail.

---

### `page_type`

Type text into an input or textarea element. Clears existing value unless `append` is true. When recording is enabled, the optional `query` field (or the query from a prior `page_find`) is stored on the action event for `session_export` replay scripts.

**Input schema**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pageId` | string (UUID) | yes | — | Target page |
| `elementId` | string (UUID) | yes | — | Typeable element from discovery |
| `value` | string | yes | — | Text to type |
| `query` | string | no | — | Find query for replayable exports (recommended) |
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

**Agent workflow:** Target `textbox`, `searchbox`, or `textarea` roles. Use `page_find` with field labels like "Email" or "Password".

---

### `page_press`

Press a keyboard key on the page (Enter, Tab, Escape, arrows, modifier combos). When `elementId` is provided, the element is focused before the key is dispatched — required for grid keyboard navigation and to avoid keys landing on unrelated controls (e.g. a page-level `<select>`).

**Input schema**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pageId` | string (UUID) | yes | Target page |
| `key` | string (min 1 char) | yes | Key name or combo (e.g. `"Enter"`, `"ArrowDown"`, `"Control+a"`) |
| `elementId` | string (UUID) | no | Element to focus before pressing — pass the `elementId` from `page_find`/`page_click` |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "key": "ArrowDown",
  "elementId": "c3d4e5f6-a7b8-9012-cdef-123456789012"
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
| `ELEMENT_NOT_FOUND` | Unknown or stale `elementId` |
| `INTERNAL_ERROR` | CDP key press failure |

**Agent workflow:** After `page_find` + `page_click` on a grid cell, pass the same `elementId` to `page_press` so arrow keys reach the grid — omitting `elementId` dispatches to whatever currently has focus (often wrong on complex pages). Use bare `page_press` only when the target is already focused.

---

### `page_scroll`

Scroll the page in a direction. Default amount is one viewport height/width. With `elementId`, scrolls the nearest overflow container (`overflow: auto|scroll`) around that element — use for virtualized grid bodies instead of window scroll.

**Input schema**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pageId` | string (UUID) | yes | — | Target page |
| `direction` | enum | yes | — | `"up"` \| `"down"` \| `"left"` \| `"right"` |
| `amount` | integer (≥1) | no | viewport size | Scroll distance in pixels |
| `elementId` | string (UUID) | no | — | Anchor element; scrolls its nearest scrollable ancestor |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "direction": "down",
  "amount": 120,
  "elementId": "c3d4e5f6-a7b8-9012-cdef-123456789012"
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
| `ELEMENT_NOT_FOUND` | Unknown or stale `elementId` |
| `INTERNAL_ERROR` | CDP scroll failure |

**Agent workflow:** On virtualized grids, `page_find` a cell or viewport region, then `page_scroll` with that `elementId` to move the grid body — not the window. Re-run `page_elements` or `page_find` after scrolling to refresh virtualized rows.

---

### `page_screenshot`

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

### `page_snapshot`

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

### `page_text`

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

**Agent workflow:** Quick content check without parsing HTML. Use `page_find` or `assert_text` for targeted verification.

---

### `page_html`

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

**Agent workflow:** Use for structural inspection. Prefer `page_text` or `page_snapshot` for agent-readable summaries.

---

### `page_network`

Return captured network requests for the page. Supports optional URL filter and since timestamp. Monitoring starts automatically on `page_create`.

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

### `page_console`

Return captured browser console messages (logs, warnings, errors). Monitoring starts automatically on `page_create`.

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

### `page_wait`

Wait for a condition: element appearance, URL match, network idle, or fixed timeout.

**Input schema**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pageId` | string (UUID) | yes | — | Target page |
| `condition` | enum | yes | — | `"element"` \| `"url"` \| `"networkIdle"` \| `"timeout"` |
| `query` | string | when `element` | — | Element search query (same as `page_find`) |
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

### `assert_exists`

Assert that an element matching a query exists and is visible, or that a known `elementId` is visible. Returns `elementId` on pass; `ASSERTION_FAILED` with expected/actual on failure.

**Input schema**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pageId` | string (UUID) | yes | Target page |
| `query` | string (min 1 char) | one of query/elementId | Text query (same semantics as `page_find`) |
| `elementId` | string (UUID) | one of query/elementId | Previously discovered element |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "query": "Submit"
}
```

**Example output (pass)**

```json
{
  "ok": true,
  "data": {
    "passed": true,
    "assertion": "exists",
    "message": "Element matching 'Submit' exists and is visible",
    "elementId": "d4e5f6a7-b8c9-0123-def0-234567890123"
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Missing both `query` and `elementId` |
| `SESSION_NOT_FOUND` | Page not found |
| `ASSERTION_FAILED` | No visible match (includes `expected` and `actual` in details) |

---

### `assert_text`

Assert that visible page text contains or equals a string (same source as `page_text`).

**Input schema**

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `pageId` | string (UUID) | yes | — |
| `contains` | string (min 1 char) | yes | — |
| `match` | enum | no | `"contains"` |

`match` values: `"contains"` \| `"equals"`

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "contains": "Welcome"
}
```

**Example output (pass)**

```json
{
  "ok": true,
  "data": {
    "passed": true,
    "assertion": "text",
    "message": "Page text contains 'Welcome'"
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Empty `contains` |
| `SESSION_NOT_FOUND` | Page not found |
| `ASSERTION_FAILED` | Text mismatch (includes text snippet in `actual`) |

---

### `assert_url`

Assert that the current page URL contains or equals an expected value.

**Input schema**

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `pageId` | string (UUID) | yes | — |
| `url` | string (min 1 char) | yes | — |
| `match` | enum | no | `"contains"` |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "url": "/dashboard"
}
```

**Example output (pass)**

```json
{
  "ok": true,
  "data": {
    "passed": true,
    "assertion": "url",
    "message": "URL contains '/dashboard'"
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Empty `url` |
| `SESSION_NOT_FOUND` | Page not found |
| `ASSERTION_FAILED` | URL mismatch (expected and actual URL in details) |

---

### `assert_network`

Assert that a network request matching a URL substring occurred with the expected status. Searches the page network buffer.

**Input schema**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pageId` | string (UUID) | yes | Target page |
| `url` | string (min 1 char) | yes | URL substring to match |
| `status` | integer or string | yes | Exact code (200) or range (`2xx`) |

**Example input**

```json
{
  "pageId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "url": "/api/users",
  "status": 200
}
```

**Example output (pass)**

```json
{
  "ok": true,
  "data": {
    "passed": true,
    "assertion": "network",
    "message": "Network request to 'https://example.com/api/users' returned status 200",
    "matchedRequest": {
      "url": "https://example.com/api/users",
      "status": 200,
      "method": "GET"
    }
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Invalid status format |
| `SESSION_NOT_FOUND` | Page not found |
| `ASSERTION_FAILED` | No matching request in buffer |

---

### `session_export`

Export a browser session recording as a replayable `.olteststack.json` script.

- **Live session:** pass `browserId` while the browser is still open (in-memory buffer).
- **After close:** pass `reportId` or `sessionId` to rebuild the script from PostgreSQL `recorded_events` (requires `DATABASE_URL` and persistence enabled).

**Input schema**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `browserId` | string (UUID) | one of* | — | Active browser session (live buffer) |
| `reportId` | string (UUID) | one of* | — | Persisted report id (post-close DB export) |
| `sessionId` | string (UUID) | one of* | — | Alias for `reportId` |
| `name` | string | no | `session-<prefix>` or test name | Script name |
| `goal` | string | no | — | Natural-language goal stored in script metadata |

\* Provide exactly one of `browserId` (live) or `reportId`/`sessionId` (database).

**Example input (live)**

```json
{
  "browserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Login flow",
  "goal": "Verify login redirects to dashboard"
}
```

**Example input (post-close)**

```json
{
  "reportId": "550e8400-e29b-41d4-a716-446655440000",
  "goal": "Replay failed login from dashboard"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "script": {
      "version": "1.0",
      "name": "Login flow",
      "goal": "Verify login redirects to dashboard",
      "url": "https://example.com/login",
      "recordedAt": "2026-06-21T10:00:00.000Z",
      "steps": [
        { "action": "type", "query": "Email", "value": "user@example.com" },
        { "action": "click", "query": "Sign In" },
        { "action": "assert.url", "url": "/dashboard", "match": "contains" }
      ]
    },
    "eventCount": 12,
    "stepCount": 3,
    "skippedCount": 0
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `SESSION_NOT_FOUND` | Browser not found (live), or `reportId`/`sessionId` not in database |
| `INVALID_INPUT` | Recording disabled (live), no identifiers, mixed live/db inputs, or no `recorded_events` for report |
| `INTERNAL_ERROR` | Database export requested but persistence disabled or DB unavailable |

**Note:** Save `data.script` to a `.olteststack.json` file (e.g. under `scripts/`) for replay via `test_run`. After `browser_close`, use the persisted `reportId` from the dashboard with `reportId` or `sessionId`.

---

### `save_session`

Promote an ephemeral persisted session to **saved** (no TTL). Unsaved sessions are auto-deleted after `SESSION_TTL_HOURS` unless saved manually or auto-promoted on failed/error close (see `AUTO_SAVE_FAILED` / `AUTO_SAVE_FAILED_SESSIONS`).

**Input schema**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reportId` | string (UUID) | one of* | Persisted test report id |
| `sessionId` | string (UUID) | one of* | Alias for `reportId` |
| `name` | string | no | Optional display name update |

\* Provide `reportId` or `sessionId`.

**Example input**

```json
{
  "reportId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Login regression"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "reportId": "550e8400-e29b-41d4-a716-446655440000",
    "testName": "Login regression",
    "saved": true,
    "savedAt": "2026-06-21T10:05:00.000Z",
    "expiresAt": null,
    "expiresInHours": null
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `SESSION_NOT_FOUND` | Report id not in database |
| `INVALID_INPUT` | Missing `reportId`/`sessionId` |
| `INTERNAL_ERROR` | `DATABASE_URL` not configured |

---

### `send_report`

Dump full in-memory browser session state as a structured debug report. Generates a unique `debugId`, logs a summary line to stderr as `[olteststack:debug]`, and writes JSON to `SCREENSHOT_DIR/debug/{debugId}.json`.

**Input schema**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `browserId` | string (UUID) | yes | — | Active browser session |
| `includeScreenshots` | boolean | no | `false` | Capture fresh PNG per open page |
| `note` | string | no | — | Optional user context stored in report |

**Example input**

```json
{
  "browserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "note": "Submit button click did not navigate"
}
```

**Example output**

```json
{
  "ok": true,
  "data": {
    "debugId": "dbg_550e8400-e29b-41d4-a716-446655440000",
    "browserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "recordedAt": "2026-06-23T10:00:00.000Z",
    "reportFile": "./screenshots/debug/dbg_550e8400-e29b-41d4-a716-446655440000.json",
    "report": {
      "browserSession": { "browserId": "...", "recordingEnabled": true, "pageIds": [] },
      "pages": [],
      "events": [],
      "eventCount": 0,
      "registrySnapshot": { "pages": [] },
      "note": "Submit button click did not navigate"
    }
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `SESSION_NOT_FOUND` | Browser not found or already closed |
| `INVALID_INPUT` | Malformed input |
| `BROWSER_CRASHED` | `includeScreenshots: true` but browser disconnected |

---

### `test_run`

Execute a complete browser test with explicit steps, an inline script, or a script file — then return a structured `TestReport`. Launches browser, runs steps, generates report, and closes browser. Goal-only (no steps/script/scriptFile) returns agent-driven guidance.

**Input schema**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `goal` | string (min 1 char) | yes | — | Test objective (used as report name) |
| `name` | string | no | `goal` | Override report test name |
| `url` | string (URI) | no | — | Initial navigation URL (overrides script URL) |
| `steps` | array | no | — | Explicit step sequence |
| `script` | object | no | — | Inline `.olteststack.json` replay script |
| `scriptFile` | string | no | — | Path to script file on MCP server host |
| `variables` | object (string → string) | no | — | Values for `${VAR_NAME}` placeholders in steps and `url` |
| `headless` | boolean | no | `true` | Browser headless mode |
| `stopOnFailure` | boolean | no | `true` | Halt on first step failure |
| `timeoutMs` | integer (≥5000) | no | `60000` | Overall test timeout |

**Step actions:** `navigate`, `click`, `type`, `press`, `scroll`, `wait`, `screenshot`, `assert.exists`, `assert.text`, `assert.url`, `assert.network`

**Example input (explicit steps)**

```json
{
  "goal": "Verify login redirects to dashboard",
  "url": "https://app.example.com/login",
  "steps": [
    { "action": "type", "query": "Email", "value": "user@example.com" },
    { "action": "type", "query": "Password", "value": "secret" },
    { "action": "click", "query": "Sign In" },
    { "action": "assert.url", "url": "/dashboard" },
    { "action": "assert.text", "contains": "Welcome" }
  ]
}
```

**Example input (script file replay)**

```json
{
  "goal": "Replay saved login flow",
  "scriptFile": "scripts/example-login.olteststack.json"
}
```

**Example input (script replay with variables)**

Scripts may use `${VAR_NAME}` placeholders in `url`, step `value` fields, navigate URLs, and assertion strings. Supply values via `variables`:

```json
{
  "goal": "Replay login against staging",
  "variables": {
    "BASE_URL": "https://staging.example.com",
    "EMAIL": "user@example.com",
    "PASSWORD": "secret"
  },
  "script": {
    "version": "1.0",
    "name": "Login flow",
    "url": "${BASE_URL}/login",
    "steps": [
      { "action": "type", "query": "Email", "value": "${EMAIL}" },
      { "action": "type", "query": "Password", "value": "${PASSWORD}" },
      { "action": "click", "query": "Sign In" },
      { "action": "assert.url", "url": "/dashboard", "match": "contains" }
    ]
  }
}
```

Escape a literal `${...}` in script text with `$$` (e.g. `$${PRICE}` stays `${PRICE}`). Missing variables return `INVALID_INPUT` with the variable name.

**Example output**

```json
{
  "ok": true,
  "data": {
    "report": {
      "testName": "Verify login redirects to dashboard",
      "status": "passed",
      "startedAt": "2026-06-21T10:00:00.000Z",
      "completedAt": "2026-06-21T10:00:15.000Z",
      "executionTimeMs": 15000,
      "actionsPerformed": [],
      "assertionsPassed": [],
      "assertionsFailed": [],
      "screenshots": [],
      "networkErrors": [],
      "consoleErrors": []
    }
  }
}
```

**Error cases**

| Code | When |
|------|------|
| `INVALID_INPUT` | Malformed input or steps |
| `INTERNAL_ERROR` | Browser launch failed |
| `TIMEOUT` | Test exceeded `timeoutMs` (report status `"error"`) |

**Note:** Step and assertion failures are captured in the report (`status: "failed"`), not as MCP errors. Screenshots are captured after each assertion step.

---

## Example: login test scenario

This flow exercises core V1 tools — either step-by-step or via `test_run`.

Target: `fixtures/sample-app/index.html` (local login form with Email, Password, Submit).

### Full agent sequence

```text
1. browser_launch        → browserId
2. page_create           → pageId (starts network/console monitoring)
3. page_navigate         → file:///path/to/OLTestStack/fixtures/sample-app/index.html
4. page_find "Email"     → elementId for email field
5. page_type             → fill email
6. page_find "Password"  → elementId for password field
7. page_type             → fill password
8. page_find "Submit"    → elementId for submit button
9. page_click            → click Submit
10. page_wait            → wait for navigation or network idle
11. page_screenshot      → capture evidence
12. browser_close        → cleanup
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

Assertion tools (`assert_exists`, `assert_url`, etc.) provide structured pass/fail checks. Use `test_run` for orchestrated multi-step flows with a generated report.

---

## Error code reference

| Code | Meaning | Typical recovery |
|------|---------|------------------|
| `INVALID_INPUT` | Schema validation failed | Fix field names, types, or required fields |
| `SESSION_NOT_FOUND` | Unknown `browserId` or `pageId` | Re-launch browser and create page |
| `ELEMENT_NOT_FOUND` | Query matched nothing | Call `page_elements`, try different query |
| `NAVIGATION_FAILED` | Page failed to load | Check URL, network, server status |
| `TIMEOUT` | Operation exceeded timeout | Increase `timeoutMs` or change `waitUntil` |
| `BROWSER_CRASHED` | Chromium disconnected | `browser_launch` again |
| `ASSERTION_FAILED` | Assertion did not pass (Phase 9+) | Inspect page state, fix test or app |
| `INTERNAL_ERROR` | Unexpected server error | Check stderr logs, retry |

---

## Related guides

- [MCP Server Setup](./mcp-server-setup.md)
- [Agent Workflows](./agent-workflows.md)
- [Skills](./skills.md)
