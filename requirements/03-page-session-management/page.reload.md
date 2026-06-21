# page.reload

> **Module:** `03-page-session-management`  
> **MCP Command:** `page.reload`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [02-browser-session-management](../02-browser-session-management/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** All interaction modules (04–11)

## Overview / Purpose

Refresh the current page in a page session, wait for the specified load event, update page metadata, and invalidate all element references for that page. Equivalent to a browser refresh on the current URL.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-03-003 | The system SHALL provide `page.reload` to refresh the current page. |
| FR-03-008 | `page.reload` SHALL invalidate all element IDs for that page. |

### Inherited Navigation Behavior

`page.reload` shares wait and timeout semantics with `page.navigate`:

| ID | Requirement |
|----|-------------|
| FR-03-006 | `page.reload` SHALL wait for `load` event by default before returning success. |
| FR-03-007 | `page.reload` SHALL update `PageSession.url` and `PageSession.title` on success. |
| FR-03-011 | `page.reload` SHALL accept an optional `waitUntil` parameter: `load` (default), `domcontentloaded`, `networkidle`. |
| FR-03-012 | `page.reload` SHALL accept an optional `timeoutMs` parameter (default: 30000). |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-03-002 | Reload timeout defaults SHALL be configurable via `DEFAULT_NAVIGATION_TIMEOUT_MS`. |

---

## Data Models / Types

### PageReloadOptions

```typescript
interface PageReloadOptions {
  pageId: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';  // default: 'load'
  timeoutMs?: number;                                          // default: 30000
}
```

### PageReloadResult

```typescript
interface PageReloadResult {
  url: string;
  title: string;
}
```

---

## MCP Command Spec

### `page.reload`

**Description:** Reload the current page. Invalidates all previously discovered elements — call `page.elements` after reload. Example: `{ "pageId": "..." }`.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "waitUntil": {
      "type": "string",
      "enum": ["load", "domcontentloaded", "networkidle"],
      "default": "load"
    },
    "timeoutMs": { "type": "integer", "minimum": 1000, "default": 30000 }
  },
  "required": ["pageId"],
  "additionalProperties": false
}
```

**Output Schema (wrapped in success envelope):**

```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string" },
    "title": { "type": "string" }
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
    "title": "Example Domain"
  }
}
```

**Error Cases:**

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |
| `NAVIGATION_FAILED` | Reload failed (e.g., page has no URL) |
| `TIMEOUT` | Reload exceeded `timeoutMs` |

**Error Response Example:**

```json
{
  "ok": false,
  "error": {
    "code": "TIMEOUT",
    "message": "Page reload timed out after 30000 ms.",
    "details": { "pageId": "...", "elapsedMs": 30000 }
  }
}
```

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-03-003 | `page.reload` refreshes content and invalidates previous element IDs. |
| AC-03-013 | Reload on `about:blank` page returns updated metadata without error. |
| AC-03-014 | Element IDs discovered before reload return `ELEMENT_NOT_FOUND` after reload. |
| AC-03-015 | Reload timeout returns `TIMEOUT` with elapsed time in details. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [session-registry.md](../01-core-architecture/session-registry.md) | Page lookup, metadata update, element invalidation |
| [error-model.md](../01-core-architecture/error-model.md) | `NAVIGATION_FAILED`, `TIMEOUT` codes |
| [configuration.md](../01-core-architecture/configuration.md) | `DEFAULT_NAVIGATION_TIMEOUT_MS` |
| [recording-integration.md](../01-core-architecture/recording-integration.md) | Emits `navigation` event |
| [page.create.md](./page.create.md) | Requires valid `pageId` |
| [page.navigate.md](./page.navigate.md) | Shared wait/timeout semantics |
| 13-cdp-integration | CDP Page reload API |

---

## Out of Scope (V2)

- Hard reload (bypass cache) vs soft reload distinction
- Reload with custom headers
- Partial reload / hot module replacement detection
