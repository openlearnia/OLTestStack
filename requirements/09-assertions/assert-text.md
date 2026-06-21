# Feature: `assert.text`

> **Module:** [09-assertions](./REQUIREMENTS.md)  
> **MCP Command:** `assert.text`

## Overview

Verify that the page contains specified text. Searches visible page text using the same source as `page.text`. Supports `contains` (default) and `equals` matching modes. Used to validate rendered content, labels, and messages.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-09-002 | The system SHALL provide `assert.text` to verify the page contains specified text. |
| FR-09-005 | Passing assertions SHALL return `{ passed: true, assertion: string, message: string }`. |
| FR-09-006 | Failing assertions SHALL return error code `ASSERTION_FAILED` with expected vs actual details. |
| FR-09-007 | All assertions SHALL be recorded when recording is enabled (pass or fail). |
| FR-09-008 | `assert.text` SHALL search visible page text (same source as `page.text`). |
| FR-09-009 | `assert.text` SHALL support `match: "contains" \| "equals"` (default `contains`). |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-09-001 | Assertions SHALL complete within 1 second (excluding implicit waits). |
| NFR-09-002 | Assertion failure messages SHALL be AI-readable with clear expected vs actual values. |
| NFR-09-003 | Assertions SHALL NOT modify page state. |

---

## Data Models / Types

### AssertionPassResult (text variant)

```typescript
interface AssertTextPassResult {
  passed: true;
  assertion: 'text';
  message: string;
}
```

### AssertionFailDetails

```typescript
interface AssertionFailDetails {
  assertion: 'text';
  expected: { text: string; match: 'contains' | 'equals' };
  actual: { textSnippet: string };   // truncated visible text for context
  message: string;
}
```

---

## MCP Command Spec

### `assert.text`

**Description:** Assert that the page contains specified text.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "contains": { "type": "string", "minLength": 1 },
    "match": {
      "type": "string",
      "enum": ["contains", "equals"],
      "default": "contains"
    }
  },
  "required": ["pageId", "contains"],
  "additionalProperties": false
}
```

**Output Schema (pass):**

```json
{
  "type": "object",
  "properties": {
    "passed": { "type": "boolean", "const": true },
    "assertion": { "type": "string", "const": "text" },
    "message": { "type": "string" }
  },
  "required": ["passed", "assertion", "message"]
}
```

---

## Error Cases

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |
| `ASSERTION_FAILED` | Text not found (details include expected text and text snippet) |
| `INVALID_INPUT` | Empty or missing `contains` value |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-09-003 | `assert.text` with `contains: "Welcome"` passes on page containing that text. |
| AC-09-007 | Assertion failure includes `expected` and `actual` in error details. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model (`ASSERTION_FAILED`, `SESSION_NOT_FOUND`) |
| [06-screenshots-inspection](../06-screenshots-inspection/REQUIREMENTS.md) | Visible text extraction (`page.text` source) |
| [10-recording-test-reports](../10-recording-test-reports/recording.md) | Assertion pass/fail event recording |

---

## Out of Scope (V2)

- Soft assertions (continue on failure, report all at end)
- Regex or fuzzy text matching
- Custom JavaScript assertion predicates
- Visual regression assertions (pixel diff)
