# `page.type`

> **Module:** `05-user-actions`  
> **MCP Command:** `page.type`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [04-element-discovery-targeting](../04-element-discovery-targeting/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [10-recording-test-reports](../10-recording-test-reports/REQUIREMENTS.md), [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview / Purpose

Enter text into an input or textarea element identified by `elementId`. Clears the existing value before typing unless `append: true` is specified. Supports optional per-keystroke delay for simulating human typing. Emits a recorded event when session recording is enabled.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-05-002 | The system SHALL provide `page.type` to enter text into an input element. |
| FR-05-006 | `page.type` SHALL clear existing input value before typing unless `append: true` is specified. |
| FR-05-007 | `page.type` SHALL support `append: boolean` (default `false`) and `delay: number` (ms between keystrokes, default 0). |
| FR-05-010 | All actions SHALL emit a recorded event when recording is enabled. |
| FR-05-011 | Actions on stale/invalid `elementId` SHALL return `ELEMENT_NOT_FOUND`. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-05-001 | `page.type` SHALL complete within 2 seconds (excluding explicit delays). |
| NFR-05-002 | Actions SHALL be idempotent where possible (typing into an already-focused input is safe). |
| NFR-05-003 | Action commands SHALL not block other MCP commands on different sessions. |

---

## Data Models / Types

### TypeResult

```typescript
interface TypeResult {
  typed: true;
  elementId: string;       // UUID of target element
  value: string;           // final value after typing
}
```

---

## MCP Command Spec

### `page.type`

**Description:** Type text into an input or textarea element.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "elementId": { "type": "string", "format": "uuid" },
    "value": { "type": "string" },
    "append": { "type": "boolean", "default": false },
    "delay": { "type": "integer", "minimum": 0, "default": 0 }
  },
  "required": ["pageId", "elementId", "value"],
  "additionalProperties": false
}
```

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "typed": { "type": "boolean", "const": true },
    "elementId": { "type": "string", "format": "uuid" },
    "value": { "type": "string" }
  },
  "required": ["typed", "elementId", "value"]
}
```

**Success Response Example:**

```json
{
  "ok": true,
  "data": {
    "typed": true,
    "elementId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "value": "hello@example.com"
  }
}
```

**Error Cases:**

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |
| `ELEMENT_NOT_FOUND` | `elementId` invalid or not an input element |
| `INVALID_INPUT` | Element is not typeable (e.g., button) |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-05-002 | `page.type` with value "hello" fills an input field with "hello". |
| AC-05-003 | `page.type` with `append: true` appends to existing value. |
| AC-05-007 | Action on invalid `elementId` returns `ELEMENT_NOT_FOUND`. |
| AC-05-009 | `page.type` on a button element returns `INVALID_INPUT`. |
| AC-05-010 | `delay` parameter spaces keystrokes by the specified milliseconds. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [01-core-architecture/error-model.md](../01-core-architecture/error-model.md) | Error envelope and codes |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | Valid `pageId` |
| [04-element-discovery-targeting](../04-element-discovery-targeting/REQUIREMENTS.md) | Valid `elementId` resolution |
| [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md) | `Input.insertText`, `Input.dispatchKeyEvent` |
| [10-recording-test-reports/recording.md](../10-recording-test-reports/recording.md) | Action event emission |

---

## Out of Scope (V2)

- File upload simulation
- Rich text editor / contenteditable support
- Select dropdown option selection (use `page.click` in V1)
- Auto-fill / autocomplete handling
- Masked password field special handling
