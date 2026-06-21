# Feature: `assert.exists`

> **Module:** [09-assertions](./REQUIREMENTS.md)  
> **MCP Command:** `assert.exists`

## Overview

Verify that an element matching a text query exists and is visible on the page. Returns the matched `elementId` on success; returns `ASSERTION_FAILED` with expected vs actual details on failure. Used by AI agents to validate UI state during test flows.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-09-001 | The system SHALL provide `assert.exists` to verify an element matching a query exists on the page. |
| FR-09-005 | Passing assertions SHALL return `{ passed: true, assertion: string, message: string }`. |
| FR-09-006 | Failing assertions SHALL return error code `ASSERTION_FAILED` with expected vs actual details. |
| FR-09-007 | All assertions SHALL be recorded when recording is enabled (pass or fail). |
| FR-09-001a | `assert.exists` SHALL require the matched element to be visible, not merely present in the DOM. |
| FR-09-001b | On pass, the response SHALL include the matched `elementId`. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-09-001 | Assertions SHALL complete within 1 second (excluding implicit waits). |
| NFR-09-002 | Assertion failure messages SHALL be AI-readable with clear expected vs actual values. |
| NFR-09-003 | Assertions SHALL NOT modify page state. |

---

## Data Models / Types

### AssertionPassResult (exists variant)

```typescript
interface AssertExistsPassResult {
  passed: true;
  assertion: 'exists';
  message: string;
  elementId: string;       // UUID of matched element
}
```

### AssertionFailDetails

```typescript
interface AssertionFailDetails {
  assertion: 'exists';
  expected: { query: string; visible: true };
  actual: { found: false } | { found: true; visible: false };
  message: string;
}
```

---

## MCP Command Spec

### `assert.exists`

**Description:** Assert that an element matching the query exists and is visible on the page.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "query": { "type": "string", "minLength": 1 }
  },
  "required": ["pageId", "query"],
  "additionalProperties": false
}
```

**Output Schema (pass):**

```json
{
  "type": "object",
  "properties": {
    "passed": { "type": "boolean", "const": true },
    "assertion": { "type": "string", "const": "exists" },
    "message": { "type": "string" },
    "elementId": { "type": "string", "format": "uuid" }
  },
  "required": ["passed", "assertion", "message", "elementId"]
}
```

---

## Error Cases

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |
| `ASSERTION_FAILED` | No visible element matches query |
| `INVALID_INPUT` | Empty or missing query |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-09-001 | `assert.exists` with query matching a visible button returns `passed: true` and an `elementId`. |
| AC-09-002 | `assert.exists` with nonexistent query returns `ASSERTION_FAILED`. |
| AC-09-007 | Assertion failure includes `expected` and `actual` in error details. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model (`ASSERTION_FAILED`, `SESSION_NOT_FOUND`) |
| [04-element-discovery-targeting](../04-element-discovery-targeting/REQUIREMENTS.md) | Element lookup via `page.find` semantics |
| [10-recording-test-reports](../10-recording-test-reports/recording.md) | Assertion pass/fail event recording |

---

## Out of Scope (V2)

- Soft assertions (continue on failure, report all at end)
- Assertion negation (`assert.notExists`)
- Custom JavaScript assertion predicates
- Snapshot assertion (full page state diff)
