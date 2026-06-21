# page.close

> **Module:** `03-page-session-management`  
> **MCP Command:** `page.close`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [02-browser-session-management](../02-browser-session-management/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview / Purpose

Close a single page/tab within a browser session, remove it from the session registry, invalidate all element references for that page, and update the parent browser's `pageIds` list. The browser session remains active for other pages.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-03-004 | The system SHALL provide `page.close` to close a page/tab. |
| FR-03-010 | `page.close` SHALL remove the page from the session registry and invalidate element IDs. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-03-001 | `page.close` SHALL complete within 1 second. |

---

## Data Models / Types

### PageCloseInput

```typescript
interface PageCloseInput {
  pageId: string;   // UUID v4
}
```

### PageCloseResult

```typescript
interface PageCloseResult {
  closed: true;
}
```

### Registry Effects

| Resource | Action on close |
|----------|-----------------|
| `PageSession` | Removed from registry |
| Parent `BrowserSession.pageIds` | Updated to remove closed page |
| Element references for page | Invalidated and cleared |
| CDP target | Closed |
| Browser session | Retained (unless last page — browser stays open) |

---

## MCP Command Spec

### `page.close`

**Description:** Close a page/tab. The browser remains open if other pages exist. Example: `{ "pageId": "a1b2c3d4-..." }`.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" }
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
    "closed": { "type": "boolean", "const": true }
  },
  "required": ["closed"]
}
```

**Success Response Example:**

```json
{
  "ok": true,
  "data": { "closed": true }
}
```

**Error Cases:**

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found (already closed) |
| `INTERNAL_ERROR` | CDP target close failed |

**Error Response Example:**

```json
{
  "ok": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Page session 'a1b2c3d4-...' not found. It may have been closed. Call page.create to open a new page.",
    "details": { "pageId": "a1b2c3d4-..." }
  }
}
```

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-03-004 | `page.close` removes page from registry; subsequent operations return `SESSION_NOT_FOUND`. |
| AC-03-016 | Closing one page does not affect other pages in the same browser. |
| AC-03-017 | Parent browser's `pageIds` no longer includes the closed page. |
| AC-03-018 | Calling `page.close` twice on the same ID returns `SESSION_NOT_FOUND` on the second call. |
| AC-03-019 | Browser session remains valid after closing its last page. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [session-registry.md](../01-core-architecture/session-registry.md) | Delete page entry, update parent browser |
| [error-model.md](../01-core-architecture/error-model.md) | `SESSION_NOT_FOUND` code |
| [page.create.md](./page.create.md) | Requires an existing page to close |
| [browser.close.md](../02-browser-session-management/browser.close.md) | Also closes pages via cascade |
| 13-cdp-integration | CDP target close |

---

## Out of Scope (V2)

- Close-all-pages command
- Close page with beforeunload dialog handling
- Auto-close idle pages
