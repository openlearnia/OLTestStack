# `page.network`

> **Module:** `07-network-console-monitoring`  
> **MCP Command:** `page.network`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [09-assertions/assert-network.md](../09-assertions/assert-network.md), [10-recording-test-reports](../10-recording-test-reports/REQUIREMENTS.md), [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview / Purpose

Return captured network requests for a page. Network capture begins automatically when a page is created. Enables AI agents to inspect API calls, detect failed requests, and verify expected traffic during test execution. Buffer persists until page close; queries do not clear captured data.

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
| NFR-07-003 | Memory for network buffers SHALL be bounded per page (see FR-07-006). |

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

**Success Response Example:**

```json
{
  "ok": true,
  "data": {
    "requests": [
      {
        "requestId": "req-001",
        "url": "https://app.example.com/api/users",
        "method": "GET",
        "status": 200,
        "resourceType": "fetch",
        "timestamp": "2026-06-21T10:00:01.000Z",
        "failed": false,
        "durationMs": 142
      }
    ],
    "count": 1,
    "errorCount": 0
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
| AC-07-001 | After navigating to a page, `page.network` returns the document request with status 200. |
| AC-07-002 | A page making a failing XHR shows the request with `failed: true` and status >= 400. |
| AC-07-003 | `page.network` with `filter: "/api/"` returns only matching requests. |
| AC-07-007 | Buffer retains at most 500 requests; oldest evicted on overflow. |
| AC-07-008 | `since` parameter returns only requests after the specified timestamp. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [01-core-architecture/error-model.md](../01-core-architecture/error-model.md) | Error envelope and codes |
| [03-page-session-management/page.create.md](../03-page-session-management/page.create.md) | Page lifecycle triggers capture start |
| [13-cdp-integration/event-monitoring.md](../13-cdp-integration/event-monitoring.md) | `Network.enable`, request/response events |
| [10-recording-test-reports/recording.md](../10-recording-test-reports/recording.md) | Network error event recording |
| [09-assertions/assert-network.md](../09-assertions/assert-network.md) | Reads from network buffer |

---

## Out of Scope (V2)

- Request/response body capture
- HAR file export
- Network throttling / offline simulation
- Request mocking / interception
- WebSocket message monitoring
- Performance timing waterfall visualization
