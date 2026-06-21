# `page.press`

> **Module:** `05-user-actions`  
> **MCP Command:** `page.press`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [10-recording-test-reports](../10-recording-test-reports/REQUIREMENTS.md), [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview / Purpose

Press a keyboard key on the page. Supports standard keys (Enter, Tab, Escape, arrows, Backspace, Delete) and modifier combinations (Shift+Tab, Control+A, etc.). Operates at the page level without requiring an `elementId`. Emits a recorded event when session recording is enabled.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-05-003 | The system SHALL provide `page.press` to press a keyboard key on the page. |
| FR-05-008 | `page.press` SHALL support standard keys: Enter, Tab, Escape, ArrowUp/Down/Left/Right, Backspace, Delete, and modifier combinations (Shift+Tab, Control+A, etc.). |
| FR-05-010 | All actions SHALL emit a recorded event when recording is enabled. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-05-001 | `page.press` SHALL complete within 2 seconds. |
| NFR-05-003 | Action commands SHALL not block other MCP commands on different sessions. |

---

## Data Models / Types

### PressResult

```typescript
interface PressResult {
  pressed: true;
  key: string;             // normalized key name as dispatched
}
```

---

## MCP Command Spec

### `page.press`

**Description:** Press a keyboard key on the page.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "key": { "type": "string", "minLength": 1 }
  },
  "required": ["pageId", "key"],
  "additionalProperties": false
}
```

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "pressed": { "type": "boolean", "const": true },
    "key": { "type": "string" }
  },
  "required": ["pressed", "key"]
}
```

**Success Response Example:**

```json
{
  "ok": true,
  "data": {
    "pressed": true,
    "key": "Enter"
  }
}
```

**Error Cases:**

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |
| `INVALID_INPUT` | Unrecognized key name |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-05-004 | `page.press` with key "Enter" submits a focused form. |
| AC-05-011 | `page.press` with key "Tab" moves focus to the next focusable element. |
| AC-05-012 | Unrecognized key name returns `INVALID_INPUT`. |
| AC-05-013 | Modifier combinations like "Control+A" select all text in a focused input. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [01-core-architecture/error-model.md](../01-core-architecture/error-model.md) | Error envelope and codes |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | Valid `pageId` |
| [13-cdp-integration/input-actions.md](../13-cdp-integration/input-actions.md) | `Input.dispatchKeyEvent` |
| [10-recording-test-reports/recording.md](../10-recording-test-reports/recording.md) | Action event emission |

---

## Out of Scope (V2)

- Key hold / repeat simulation
- IME / international keyboard input
- OS-level shortcut interception
- Gamepad or non-keyboard input devices
