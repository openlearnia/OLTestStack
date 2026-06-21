# page.navigate

> **Module:** `03-page-session-management`  
> **MCP Command:** `page.navigate`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [02-browser-session-management](../02-browser-session-management/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** All interaction modules (04–11), [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview / Purpose

Load a URL in an existing page session, wait for the specified load event, update page metadata (`url`, `title`), invalidate stale element references, and emit a navigation recording event when recording is enabled.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-03-002 | The system SHALL provide `page.navigate` to load a URL in a page. |
| FR-03-006 | `page.navigate` SHALL wait for `load` event by default before returning success. |
| FR-03-007 | `page.navigate` SHALL update `PageSession.url` and `PageSession.title` on success. |
| FR-03-009 | `page.navigate` to a new URL SHALL invalidate all element IDs for that page. |
| FR-03-011 | `page.navigate` SHALL accept an optional `waitUntil` parameter: `load` (default), `domcontentloaded`, `networkidle`. |
| FR-03-012 | `page.navigate` SHALL accept an optional `timeoutMs` parameter (default: 30000). |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-03-002 | Navigation timeout defaults SHALL be configurable via `DEFAULT_NAVIGATION_TIMEOUT_MS`. |

---

## Data Models / Types

### PageNavigateOptions

```typescript
interface PageNavigateOptions {
  pageId: string;
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';  // default: 'load'
  timeoutMs?: number;                                          // default: 30000
}
```

### PageNavigateResult

```typescript
interface PageNavigateResult {
  url: string;
  title: string;
  statusCode?: number;
}
```

---

## MCP Command Spec

### `page.navigate`

**Description:** Navigate a page to a URL. Waits for the page to load before returning. Invalidates previously discovered elements — call `page.elements` after navigation. Example: `{ "pageId": "...", "url": "https://example.com" }`.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "url": { "type": "string", "format": "uri" },
    "waitUntil": {
      "type": "string",
      "enum": ["load", "domcontentloaded", "networkidle"],
      "default": "load"
    },
    "timeoutMs": { "type": "integer", "minimum": 1000, "default": 30000 }
  },
  "required": ["pageId", "url"],
  "additionalProperties": false
}
```

**Output Schema (wrapped in success envelope):**

```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string" },
    "title": { "type": "string" },
    "statusCode": { "type": "integer" }
  },
  "required": ["url", "title"]
}
```

**Success Response Example:**

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

**Error Cases:**

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |
| `NAVIGATION_FAILED` | URL unreachable, DNS failure, or HTTP error page |
| `TIMEOUT` | Navigation exceeded `timeoutMs` |
| `INVALID_INPUT` | Malformed URL |

**Error Response Examples:**

```json
{
  "ok": false,
  "error": {
    "code": "TIMEOUT",
    "message": "Navigation to 'https://slow.example.com' timed out after 30000 ms.",
    "details": { "pageId": "...", "url": "https://slow.example.com", "elapsedMs": 30000 }
  }
}
```

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid URL 'not-a-url'. Provide a fully qualified URL including scheme (https://).",
    "details": { "field": "url", "value": "not-a-url" }
  }
}
```

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-03-002 | `page.navigate` to `https://example.com` returns correct URL and title. |
| AC-03-005 | Navigation timeout returns `TIMEOUT` error with elapsed time in details. |
| AC-03-006 | Invalid URL returns `INVALID_INPUT` with descriptive message. |
| AC-03-010 | Element IDs from before navigation are invalid after successful navigation. |
| AC-03-011 | `PageSession.url` and `PageSession.title` are updated in registry after success. |
| AC-03-012 | Navigation emits a `navigation` recording event when recording is enabled. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [session-registry.md](../01-core-architecture/session-registry.md) | Page lookup, metadata update, element invalidation |
| [error-model.md](../01-core-architecture/error-model.md) | `NAVIGATION_FAILED`, `TIMEOUT`, `INVALID_INPUT` codes |
| [configuration.md](../01-core-architecture/configuration.md) | `DEFAULT_NAVIGATION_TIMEOUT_MS` |
| [recording-integration.md](../01-core-architecture/recording-integration.md) | Emits `navigation` event |
| [page.create.md](./page.create.md) | Requires valid `pageId` |
| 13-cdp-integration | CDP Page navigation API |
| 10-recording-test-reports | Stores navigation events |

---

## Out of Scope (V2)

- Page history / back-forward navigation (`page.goBack`, `page.goForward`)
- Authentication flows (HTTP basic auth dialogs)
- Download handling
- Service worker / SPA routing special cases beyond `networkidle`
