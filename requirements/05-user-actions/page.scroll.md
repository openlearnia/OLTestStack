# `page.scroll`

> **Module:** `05-user-actions`  
> **MCP Command:** `page.scroll`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [10-recording-test-reports](../10-recording-test-reports/REQUIREMENTS.md), [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview / Purpose

Scroll the page in a specified direction. Accepts `up`, `down`, `left`, or `right` with an optional pixel amount (default: one viewport height/width). Operates at the page level to reveal off-screen content. Emits a recorded event when session recording is enabled.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-05-004 | The system SHALL provide `page.scroll` to scroll the page in a direction. |
| FR-05-009 | `page.scroll` SHALL accept `direction`: `up`, `down`, `left`, `right`, and optional `amount` in pixels (default: one viewport height/width). |
| FR-05-010 | All actions SHALL emit a recorded event when recording is enabled. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-05-001 | `page.scroll` SHALL complete within 2 seconds. |
| NFR-05-003 | Action commands SHALL not block other MCP commands on different sessions. |

---

## Data Models / Types

### ScrollResult

```typescript
interface ScrollResult {
  scrolled: true;
  direction: 'up' | 'down' | 'left' | 'right';
  amount: number;          // pixels scrolled
}
```

---

## MCP Command Spec

### `page.scroll`

**Description:** Scroll the page in a direction.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "direction": {
      "type": "string",
      "enum": ["up", "down", "left", "right"]
    },
    "amount": { "type": "integer", "minimum": 1, "default": 720 }
  },
  "required": ["pageId", "direction"],
  "additionalProperties": false
}
```

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "scrolled": { "type": "boolean", "const": true },
    "direction": { "type": "string" },
    "amount": { "type": "integer" }
  },
  "required": ["scrolled", "direction", "amount"]
}
```

**Success Response Example:**

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

**Error Cases:**

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-05-005 | `page.scroll` with direction "down" scrolls the page downward. |
| AC-05-014 | Default `amount` equals one viewport height for vertical directions. |
| AC-05-015 | Custom `amount` scrolls exactly the specified number of pixels. |
| AC-05-016 | Scrolling at page boundary does not error; returns success with applied amount. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [01-core-architecture/error-model.md](../01-core-architecture/error-model.md) | Error envelope and codes |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | Valid `pageId` |
| [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md) | CDP scroll / mouse wheel dispatch |
| [10-recording-test-reports/recording.md](../10-recording-test-reports/recording.md) | Action event emission |

---

## Out of Scope (V2)

- Scroll to specific element
- Smooth scroll animation control
- Infinite scroll detection / auto-load
- Scroll within nested scrollable containers
- Touch/gesture scroll simulation (mobile)
