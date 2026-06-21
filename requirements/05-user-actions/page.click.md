# `page.click`

> **Module:** `05-user-actions`  
> **MCP Command:** `page.click`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [04-element-discovery-targeting](../04-element-discovery-targeting/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [10-recording-test-reports](../10-recording-test-reports/REQUIREMENTS.md), [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview / Purpose

Click an interactive element identified by `elementId`. Scrolls the element into view if off-screen, waits up to 5 seconds for the element to become actionable (visible and enabled), then dispatches a click event. Emits a recorded event when session recording is enabled.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-05-001 | The system SHALL provide `page.click` to click an element by `elementId`. |
| FR-05-005 | `page.click` SHALL scroll the element into view before clicking if not visible in viewport. |
| FR-05-010 | All actions SHALL emit a recorded event when recording is enabled. |
| FR-05-011 | Actions on stale/invalid `elementId` SHALL return `ELEMENT_NOT_FOUND`. |
| FR-05-012 | `page.click` SHALL wait for element to be actionable (visible and enabled) up to 5 seconds before failing. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-05-001 | `page.click` SHALL complete within 2 seconds (excluding explicit delays). |
| NFR-05-002 | Actions SHALL be idempotent where possible (clicking an already-focused input is safe). |
| NFR-05-003 | Action commands SHALL not block other MCP commands on different sessions. |

---

## Data Models / Types

### ClickResult

```typescript
interface ClickResult {
  clicked: true;
  elementId: string;       // UUID of clicked element
}
```

---

## MCP Command Spec

### `page.click`

**Description:** Click an interactive element.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "elementId": { "type": "string", "format": "uuid" }
  },
  "required": ["pageId", "elementId"],
  "additionalProperties": false
}
```

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "clicked": { "type": "boolean", "const": true },
    "elementId": { "type": "string", "format": "uuid" }
  },
  "required": ["clicked", "elementId"]
}
```

**Success Response Example:**

```json
{
  "ok": true,
  "data": {
    "clicked": true,
    "elementId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
  }
}
```

**Error Cases:**

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |
| `ELEMENT_NOT_FOUND` | `elementId` invalid or element not actionable |
| `TIMEOUT` | Element not actionable within 5 seconds |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-05-001 | `page.click` on a button triggers the button's click handler. |
| AC-05-006 | Click on off-screen element scrolls it into view first. |
| AC-05-007 | Action on invalid `elementId` returns `ELEMENT_NOT_FOUND`. |
| AC-05-008 | Click on disabled element returns `ELEMENT_NOT_FOUND` or `TIMEOUT` after wait period. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [01-core-architecture/error-model.md](../01-core-architecture/error-model.md) | Error envelope and codes |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | Valid `pageId` |
| [04-element-discovery-targeting](../04-element-discovery-targeting/REQUIREMENTS.md) | Valid `elementId` resolution |
| [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md) | `Input.dispatchMouseEvent` |
| [10-recording-test-reports/recording.md](../10-recording-test-reports/recording.md) | Action event emission |

---

## Out of Scope (V2)

- Drag and drop
- Hover / mouse move
- Right-click / context menu
- Double-click / multi-click
- Touch/gesture events (mobile)
