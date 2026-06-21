# Feature: `assert.url`

> **Module:** [09-assertions](./REQUIREMENTS.md)  
> **MCP Command:** `assert.url`

## Overview

Verify that the current page URL matches an expected value. Supports `contains` (default) and `equals` matching modes. Used to validate navigation outcomes, redirects, and route changes during test flows.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-09-003 | The system SHALL provide `assert.url` to verify the current page URL. |
| FR-09-005 | Passing assertions SHALL return `{ passed: true, assertion: string, message: string }`. |
| FR-09-006 | Failing assertions SHALL return error code `ASSERTION_FAILED` with expected vs actual details. |
| FR-09-007 | All assertions SHALL be recorded when recording is enabled (pass or fail). |
| FR-09-010 | `assert.url` SHALL support `match: "equals" \| "contains"` (default `contains`). |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-09-001 | Assertions SHALL complete within 1 second (excluding implicit waits). |
| NFR-09-002 | Assertion failure messages SHALL be AI-readable with clear expected vs actual values. |
| NFR-09-003 | Assertions SHALL NOT modify page state. |

---

## Data Models / Types

### AssertionPassResult (url variant)

```typescript
interface AssertUrlPassResult {
  passed: true;
  assertion: 'url';
  message: string;
}
```

### AssertionFailDetails

```typescript
interface AssertionFailDetails {
  assertion: 'url';
  expected: { url: string; match: 'equals' | 'contains' };
  actual: { url: string };
  message: string;
}
```

---

## MCP Command Spec

### `assert.url`

**Description:** Assert that the current page URL matches the expected value.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "url": { "type": "string", "minLength": 1 },
    "match": {
      "type": "string",
      "enum": ["equals", "contains"],
      "default": "contains"
    }
  },
  "required": ["pageId", "url"],
  "additionalProperties": false
}
```

**Output Schema (pass):**

```json
{
  "type": "object",
  "properties": {
    "passed": { "type": "boolean", "const": true },
    "assertion": { "type": "string", "const": "url" },
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
| `ASSERTION_FAILED` | URL mismatch (details include expected and actual URL) |
| `INVALID_INPUT` | Empty or missing `url` value |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-09-004 | `assert.url` with `url: "/login"` passes when current URL contains `/login`. |
| AC-09-007 | Assertion failure includes `expected` and `actual` in error details. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model (`ASSERTION_FAILED`, `SESSION_NOT_FOUND`) |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | Current URL retrieval for the page session |
| [10-recording-test-reports](../10-recording-test-reports/recording.md) | Assertion pass/fail event recording |

---

## Out of Scope (V2)

- Soft assertions (continue on failure, report all at end)
- URL query parameter–specific assertions
- Custom JavaScript assertion predicates
