# Feature: `page.network`

> **Module:** [07-network-console-monitoring](./REQUIREMENTS.md)  
> **MCP Command:** `page.network`

## Overview

Return captured network requests for a page. Capture begins automatically when a page is created and persists until page close. Enables AI agents to inspect API calls, filter by URL or timestamp, and detect failed requests during test execution.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-07-001 | The system SHALL provide `page.network` to return captured network requests for a page. |
| FR-07-002 | Network capture SHALL begin automatically when a page is created. |
| FR-07-003 | Each network entry SHALL include at minimum: `url`, `method`, `status`, `resourceType`, `timestamp`. |
| FR-07-004 | `page.network` SHALL support optional `filter` parameter to match URL substring. |
| FR-07-005 | `page.network` SHALL support optional `since` timestamp to return only requests after a point in time. |
| FR-07-006 | Network buffer SHALL retain up to 500 requests per page; oldest entries evicted on overflow. |
| FR-07-007 | Failed requests (status 0 or >= 400) SHALL be flagged with `failed: true`. |
| FR-07-014 | Network errors SHALL be automatically recorded when recording is enabled. |
| FR-07-015 | `page.network` SHALL NOT clear the buffer; data persists until page close. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-07-001 | Network event capture SHALL add < 5 ms overhead per event. |
| NFR-07-002 | `page.network` queries SHALL return within 100 ms. |
| NFR-07-003 | Memory for network buffer SHALL be bounded per page (max 500 entries per FR-07-006). |

---

## Data Models / Types

### NetworkEntry

```typescript
interface NetworkEntry {
  requestId: string;
  url: string;
  method: string;
  status: number;          // 0 if failed before response
  resourceType: string;    // document, xhr, fetch, script, image, etc.
  timestamp: string;       // ISO 8601
  failed: boolean;
  durationMs?: number;
}
```

### NetworkResult

```typescript
interface NetworkResult {
  requests: NetworkEntry[];
  count: number;
  errorCount: number;      // requests with failed: true
}
```

---

## MCP Command Spec

### `page.network`

**Description:** Return captured network requests for the page. Useful for inspecting API calls and detecting failed requests.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "filter": { "type": "string", "description": "URL substring filter" },
    "since": { "type": "string", "format": "date-time", "description": "Return requests after this timestamp" }
  },
  "required": ["pageId"],
  "additionalProperties": false
}
```

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "requests": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "requestId": { "type": "string" },
          "url": { "type": "string" },
          "method": { "type": "string" },
          "status": { "type": "integer" },
          "resourceType": { "type": "string" },
          "timestamp": { "type": "string", "format": "date-time" },
          "failed": { "type": "boolean" },
          "durationMs": { "type": "number" }
        },
        "required": ["requestId", "url", "method", "status", "resourceType", "timestamp", "failed"]
      }
    },
    "count": { "type": "integer" },
    "errorCount": { "type": "integer" }
  },
  "required": ["requests", "count", "errorCount"]
}
```

---

## Error Cases

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-07-001 | After navigating to a page, `page.network` returns the document request with status 200. |
| AC-07-002 | A page making a failing XHR shows the request with `failed: true` and status >= 400. |
| AC-07-003 | `page.network` with `filter: "/api/"` returns only matching requests. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | Page lifecycle triggers capture start/stop |
| [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md) | `Network.enable`, request/response events |
| [10-recording-test-reports](../10-recording-test-reports/REQUIREMENTS.md) | Network error event recording |
| [09-assertions](../09-assertions/REQUIREMENTS.md) | `assert.network` reads from network buffer |
| [08-waiting-synchronization](../08-waiting-synchronization/page.wait.md) | `networkIdle` condition uses network buffer |

---

## Out of Scope (V2)

- Request/response body capture
- HAR file export
- Network throttling / offline simulation
- Request mocking / interception
- WebSocket message monitoring
- Performance timing waterfall visualization
- Wait for specific network request completion
