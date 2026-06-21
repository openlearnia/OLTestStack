# Feature: `assert.network`

> **Module:** [09-assertions](./REQUIREMENTS.md)  
> **MCP Command:** `assert.network`

## Overview

Verify that a network request matching a URL substring and status code occurred during the page session. Searches the network event buffer populated by network monitoring. Supports exact status codes (e.g., `200`) and range patterns (e.g., `2xx`).

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-09-004 | The system SHALL provide `assert.network` to verify a network request occurred with expected status. |
| FR-09-005 | Passing assertions SHALL return `{ passed: true, assertion: string, message: string }`. |
| FR-09-006 | Failing assertions SHALL return error code `ASSERTION_FAILED` with expected vs actual details. |
| FR-09-007 | All assertions SHALL be recorded when recording is enabled (pass or fail). |
| FR-09-011 | `assert.network` SHALL search the network buffer for a request matching URL substring and status code. |
| FR-09-012 | `assert.network` status SHALL accept exact match or range (e.g., `200` or `2xx`). |
| FR-09-004a | On pass, the response SHALL include the first matching `matchedRequest` details. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-09-001 | Assertions SHALL complete within 1 second (excluding implicit waits). |
| NFR-09-002 | Assertion failure messages SHALL be AI-readable with clear expected vs actual values. |
| NFR-09-003 | Assertions SHALL NOT modify page state. |

---

## Data Models / Types

### AssertionPassResult (network variant)

```typescript
interface AssertNetworkPassResult {
  passed: true;
  assertion: 'network';
  message: string;
  matchedRequest: {
    url: string;
    status: number;
    method: string;
  };
}
```

### AssertionFailDetails

```typescript
interface AssertionFailDetails {
  assertion: 'network';
  expected: { url: string; status: number | string };
  actual: { matchingRequests: number };   // count of partial URL matches, if any
  message: string;
}
```

---

## MCP Command Spec

### `assert.network`

**Description:** Assert that a network request matching URL and status occurred.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "url": { "type": "string", "minLength": 1, "description": "URL substring to match" },
    "status": {
      "oneOf": [
        { "type": "integer", "minimum": 100, "maximum": 599 },
        { "type": "string", "pattern": "^[1-5]xx$" }
      ],
      "description": "Exact status code (200) or range (2xx)"
    }
  },
  "required": ["pageId", "url", "status"],
  "additionalProperties": false
}
```

**Output Schema (pass):**

```json
{
  "type": "object",
  "properties": {
    "passed": { "type": "boolean", "const": true },
    "assertion": { "type": "string", "const": "network" },
    "message": { "type": "string" },
    "matchedRequest": {
      "type": "object",
      "properties": {
        "url": { "type": "string" },
        "status": { "type": "integer" },
        "method": { "type": "string" }
      },
      "required": ["url", "status", "method"]
    }
  },
  "required": ["passed", "assertion", "message", "matchedRequest"]
}
```

---

## Error Cases

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |
| `ASSERTION_FAILED` | No matching request found in network buffer |
| `INVALID_INPUT` | Invalid status format (not integer 100–599 or `Nxx` pattern) |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-09-005 | `assert.network` with `url: "/api/users"`, `status: 200` passes after such request occurs. |
| AC-09-006 | `assert.network` with `status: "2xx"` matches any 200–299 response. |
| AC-09-007 | Assertion failure includes `expected` and `actual` in error details. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model (`ASSERTION_FAILED`, `SESSION_NOT_FOUND`, `INVALID_INPUT`) |
| [07-network-console-monitoring](../07-network-console-monitoring/REQUIREMENTS.md) | Network event buffer for request lookup |
| [10-recording-test-reports](../10-recording-test-reports/recording.md) | Assertion pass/fail event recording |

---

## Out of Scope (V2)

- Soft assertions (continue on failure, report all at end)
- Request body or header matching
- Performance assertions (response time < X ms)
- HAR file export
