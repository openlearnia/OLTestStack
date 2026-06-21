# `page.wait`

> **Module:** `08-waiting-synchronization`  
> **MCP Command:** `page.wait`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [04-element-discovery-targeting](../04-element-discovery-targeting/REQUIREMENTS.md), [07-network-console-monitoring](../07-network-console-monitoring/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [05-user-actions](../05-user-actions/REQUIREMENTS.md), [09-assertions](../09-assertions/REQUIREMENTS.md), [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview / Purpose

Wait for a condition to be satisfied before proceeding. Supports waiting for elements to appear, URLs to change, network activity to settle, or fixed timeouts. Enables AI agents to synchronize test actions with dynamic page state. Returns condition-specific metadata on success or `TIMEOUT` if the deadline is exceeded.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-08-001 | The system SHALL provide `page.wait` with multiple condition types. |
| FR-08-002 | `page.wait` condition `element` SHALL wait until an element matching `query` appears on the page. |
| FR-08-003 | `page.wait` condition `url` SHALL wait until the page URL matches (or contains) the specified value. |
| FR-08-004 | `page.wait` condition `networkIdle` SHALL wait until no network requests are in-flight for 500 ms. |
| FR-08-005 | `page.wait` condition `timeout` SHALL wait for a fixed duration in milliseconds. |
| FR-08-006 | All wait conditions SHALL accept `timeoutMs` (default 30000) as maximum wait duration. |
| FR-08-007 | `page.wait` SHALL return success with condition-specific metadata on satisfaction. |
| FR-08-008 | `page.wait` SHALL return `TIMEOUT` error if condition not met within `timeoutMs`. |
| FR-08-009 | `page.wait` condition `element` on success SHALL return the matched `elementId`. |
| FR-08-010 | `page.wait` condition `url` SHALL support `match: "equals" | "contains"` (default `contains`). |
| FR-08-011 | Polling interval for element/url conditions SHALL be 100 ms. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-08-001 | Wait polling SHALL not block other MCP commands on different sessions. |
| NFR-08-002 | `networkIdle` detection SHALL use the network buffer from Module 07. |
| NFR-08-003 | Default timeout SHALL be configurable via `DEFAULT_WAIT_TIMEOUT_MS`. |

---

## Data Models / Types

### WaitCondition

```typescript
type WaitCondition =
  | { type: 'element'; query: string }
  | { type: 'url'; value: string; match?: 'equals' | 'contains' }
  | { type: 'networkIdle' }
  | { type: 'timeout'; durationMs: number };
```

### WaitResult

```typescript
interface WaitResult {
  satisfied: true;
  condition: string;       // condition type
  elapsedMs: number;
  elementId?: string;      // for element condition
  url?: string;            // for url condition
}
```

---

## MCP Command Spec

### `page.wait`

**Description:** Wait for a condition to be satisfied before proceeding. Supports waiting for elements, URL changes, network idle, or fixed timeouts.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "condition": {
      "type": "string",
      "enum": ["element", "url", "networkIdle", "timeout"]
    },
    "query": {
      "type": "string",
      "description": "Required when condition=element. Text query to match."
    },
    "value": {
      "type": "string",
      "description": "Required when condition=url. Expected URL or substring."
    },
    "match": {
      "type": "string",
      "enum": ["equals", "contains"],
      "default": "contains",
      "description": "URL matching mode when condition=url."
    },
    "durationMs": {
      "type": "integer",
      "minimum": 100,
      "description": "Required when condition=timeout. Fixed wait duration."
    },
    "timeoutMs": {
      "type": "integer",
      "minimum": 1000,
      "default": 30000,
      "description": "Maximum wait time before returning TIMEOUT error."
    }
  },
  "required": ["pageId", "condition"],
  "additionalProperties": false
}
```

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "satisfied": { "type": "boolean", "const": true },
    "condition": { "type": "string" },
    "elapsedMs": { "type": "integer" },
    "elementId": { "type": "string", "format": "uuid" },
    "url": { "type": "string" }
  },
  "required": ["satisfied", "condition", "elapsedMs"]
}
```

**Condition-Specific Validation:**

| Condition | Required Params |
|-----------|----------------|
| `element` | `query` |
| `url` | `value` |
| `networkIdle` | none |
| `timeout` | `durationMs` |

**Success Response Example (element condition):**

```json
{
  "ok": true,
  "data": {
    "satisfied": true,
    "condition": "element",
    "elapsedMs": 420,
    "elementId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
  }
}
```

**Error Cases:**

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |
| `TIMEOUT` | Condition not met within `timeoutMs` |
| `INVALID_INPUT` | Missing required parameter for condition type (e.g., `query` for element) |

**Error Response Example:**

```json
{
  "ok": false,
  "error": {
    "code": "TIMEOUT",
    "message": "Element matching 'Loading complete' did not appear within 30000ms.",
    "details": { "pageId": "a1b2c3d4-...", "condition": "element", "elapsedMs": 30000 }
  }
}
```

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-08-001 | `page.wait` with condition `element` and query "Loading complete" returns when element appears. |
| AC-08-002 | `page.wait` with condition `url` and value "/dashboard" succeeds after navigation. |
| AC-08-003 | `page.wait` with condition `networkIdle` succeeds after all XHR requests complete. |
| AC-08-004 | `page.wait` with condition `timeout` and durationMs 1000 waits approximately 1 second. |
| AC-08-005 | Waiting for nonexistent element beyond timeout returns `TIMEOUT` with elapsed time. |
| AC-08-006 | Element condition returns `elementId` of matched element on success. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [01-core-architecture/configuration.md](../01-core-architecture/configuration.md) | `DEFAULT_WAIT_TIMEOUT_MS` |
| [01-core-architecture/error-model.md](../01-core-architecture/error-model.md) | `TIMEOUT` error envelope |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | URL tracking for url condition |
| [04-element-discovery-targeting/page.find.md](../04-element-discovery-targeting/page.find.md) | Element query matching for element condition |
| [07-network-console-monitoring/page.network.md](../07-network-console-monitoring/page.network.md) | Network buffer for networkIdle condition |
| [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md) | Page URL change events |

---

## Out of Scope (V2)

- Custom JavaScript predicate waits
- Wait for specific network request (wait for `/api/data` to complete)
- Wait for console message
- Wait for element to disappear (negative wait)
- Retry-with-backoff wrapper command
- Global wait timeout configuration per test run
