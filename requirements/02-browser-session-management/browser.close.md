# browser.close

> **Module:** `02-browser-session-management`  
> **MCP Command:** `browser.close`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview / Purpose

Terminate a running browser instance, cascade-close all associated page sessions, disconnect CDP, and release OS resources. Removes the browser from the session registry.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-02-002 | The system SHALL provide `browser.close` to terminate a browser and release all associated resources. |
| FR-02-004 | `browser.close` SHALL cascade-close all child `PageSession` entries and disconnect CDP. |
| FR-02-007 | The system SHALL detect unexpected browser process termination and mark the session as crashed. |
| FR-02-008 | Attempting operations on a closed or crashed browser SHALL return `SESSION_NOT_FOUND` or `BROWSER_CRASHED`. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-02-002 | `browser.close` SHALL release all OS resources (process, file handles) within 2 seconds. |

---

## Data Models / Types

### BrowserCloseInput

```typescript
interface BrowserCloseInput {
  browserId: string;   // UUID v4
}
```

### BrowserCloseResult

```typescript
interface BrowserCloseResult {
  closed: true;
}
```

### Cascade-Delete Effects

| Resource | Action on close |
|----------|-----------------|
| `BrowserSession` | Removed from registry |
| Child `PageSession` entries | Removed from registry |
| Element references | Invalidated for all child pages |
| CDP connection | Disconnected |
| Recording buffer | Released (see [recording-integration.md](../01-core-architecture/recording-integration.md)) |
| Browser OS process | Terminated |

---

## MCP Command Spec

### `browser.close`

**Description:** Close a browser and all its pages. Always call this when finished with a session to avoid orphan processes. Example: `{ "browserId": "f47ac10b-..." }`.

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
| `SESSION_NOT_FOUND` | `browserId` not in registry (already closed) |
| `INTERNAL_ERROR` | Process kill failed |

**Error Response Example:**

```json
{
  "ok": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Browser session 'f47ac10b-...' not found. It may have already been closed.",
    "details": { "browserId": "f47ac10b-..." }
  }
}
```

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-02-003 | `browser.close` removes the session from the registry; subsequent lookups fail. |
| AC-02-004 | Closing a browser with open pages closes all pages without orphan processes. |
| AC-02-006 | Killing the browser process externally causes the next operation to return `BROWSER_CRASHED`. |
| AC-02-009 | Calling `browser.close` twice on the same ID returns `SESSION_NOT_FOUND` on the second call. |
| AC-02-010 | All child page IDs are invalid after browser close. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [session-registry.md](../01-core-architecture/session-registry.md) | Cascade-delete browser and pages |
| [error-model.md](../01-core-architecture/error-model.md) | `SESSION_NOT_FOUND`, `BROWSER_CRASHED` codes |
| [browser.launch.md](./browser.launch.md) | Requires an active browser session |
| 03-page-session-management | Child pages closed as part of cascade |
| 13-cdp-integration | CDP disconnect and process termination |
| 10-recording-test-reports | Finalize recording buffer on close |

---

## Out of Scope (V2)

- Graceful shutdown with save-state / export cookies
- Close-all-browsers bulk command
- Delayed or scheduled browser shutdown
- Browser crash auto-recovery and relaunch
