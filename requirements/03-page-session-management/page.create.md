# page.create

> **Module:** `03-page-session-management`  
> **MCP Command:** `page.create`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [02-browser-session-management](../02-browser-session-management/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** All interaction modules (04–11)

## Overview / Purpose

Open a new tab/page within an existing browser session and register a `PageSession` in the session registry. Returns a `pageId` for navigation, element discovery, and interaction commands.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-03-001 | The system SHALL provide `page.create` to open a new tab/page in a browser and return a `pageId`. |
| FR-03-005 | `page.create` SHALL register a `PageSession` linked to the parent `browserId`. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-03-001 | `page.create` SHALL complete within 1 second. |
| NFR-03-003 | The system SHALL support at least 10 concurrent pages per browser without degradation. |

---

## Data Models / Types

### PageCreateInput

```typescript
interface PageCreateInput {
  browserId: string;   // UUID v4
}
```

### PageCreateResult

```typescript
interface PageCreateResult {
  pageId: string;
  browserId: string;
}
```

### PageSession (created in registry)

See [types.md](../01-core-architecture/types.md#pagesession). Initial `url` is typically `about:blank`; `title` is empty until navigation.

---

## MCP Command Spec

### `page.create`

**Description:** Create a new page (tab) in an existing browser. Returns a `pageId` for use with `page.navigate` and other page commands. Example: `{ "browserId": "f47ac10b-..." }`.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "browserId": { "type": "string", "format": "uuid" }
  },
  "required": ["browserId"],
  "additionalProperties": false
}
```

**Output Schema (wrapped in success envelope):**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "browserId": { "type": "string", "format": "uuid" }
  },
  "required": ["pageId", "browserId"]
}
```

**Success Response Example:**

```json
{
  "ok": true,
  "data": {
    "pageId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "browserId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  }
}
```

**Error Cases:**

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `browserId` not found or browser crashed |
| `BROWSER_CRASHED` | Browser process terminated unexpectedly |
| `INTERNAL_ERROR` | CDP target creation failed |

**Error Response Example:**

```json
{
  "ok": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Browser session 'f47ac10b-...' not found. Call browser.launch to start a new browser.",
    "details": { "browserId": "f47ac10b-..." }
  }
}
```

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-03-001 | `page.create` returns a unique `pageId` linked to the parent browser. |
| AC-03-007 | Creating 10 pages in one browser returns 10 distinct `pageId` values. |
| AC-03-008 | `page.create` on a closed browser returns `SESSION_NOT_FOUND`. |
| AC-03-009 | Parent browser's `pageIds` list includes the new page after creation. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [session-registry.md](../01-core-architecture/session-registry.md) | Creates `PageSession`, updates parent `pageIds` |
| [error-model.md](../01-core-architecture/error-model.md) | Response envelope and error codes |
| [browser.launch.md](../02-browser-session-management/browser.launch.md) | Requires valid `browserId` |
| 13-cdp-integration | CDP target/tab creation |

---

## Out of Scope (V2)

- Multi-tab orchestration commands (switch active tab, list all tabs)
- Page creation with pre-set URL (use `page.create` + `page.navigate` in V1)
- Iframe-as-page abstraction
