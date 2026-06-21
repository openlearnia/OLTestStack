# `page.console`

> **Module:** `07-network-console-monitoring`  
> **MCP Command:** `page.console`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [10-recording-test-reports](../10-recording-test-reports/REQUIREMENTS.md), [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview / Purpose

Return captured browser console messages for a page. Console capture begins automatically when a page is created. Enables AI agents to review JavaScript logs, warnings, and errors during test execution. Uncaught exceptions are captured as `error`-level messages. Buffer persists until page close; queries do not clear captured data.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-07-008 | The system SHALL provide `page.console` to return captured console messages for a page. |
| FR-07-009 | Console capture SHALL begin automatically when a page is created. |
| FR-07-010 | Each console entry SHALL include: `level` (log, warn, error, info, debug), `message`, `timestamp`, `source` (URL:line). |
| FR-07-011 | `page.console` SHALL support optional `level` filter: `error`, `warn`, `log`, `all` (default `all`). |
| FR-07-012 | Console buffer SHALL retain up to 200 messages per page. |
| FR-07-013 | Uncaught JavaScript exceptions SHALL be captured as console `error` level messages. |
| FR-07-014 | Console errors SHALL be automatically recorded when recording is enabled. |
| FR-07-015 | `page.console` SHALL NOT clear the buffer; data persists until page close. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-07-001 | Console event capture SHALL add < 5 ms overhead per event. |
| NFR-07-002 | `page.console` queries SHALL return within 100 ms. |
| NFR-07-003 | Memory for console buffers SHALL be bounded per page (see FR-07-012). |

---

## Data Models / Types

### ConsoleEntry

```typescript
interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: string;       // ISO 8601
  source?: string;         // e.g., "https://app.com/main.js:42"
}
```

### ConsoleResult

```typescript
interface ConsoleResult {
  messages: ConsoleEntry[];
  count: number;
  errorCount: number;
  warnCount: number;
}
```

---

## MCP Command Spec

### `page.console`

**Description:** Return captured console messages (logs, warnings, errors) for the page.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "level": {
      "type": "string",
      "enum": ["all", "error", "warn", "log", "info", "debug"],
      "default": "all"
    }
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
    "messages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "level": { "type": "string" },
          "message": { "type": "string" },
          "timestamp": { "type": "string", "format": "date-time" },
          "source": { "type": "string" }
        },
        "required": ["level", "message", "timestamp"]
      }
    },
    "count": { "type": "integer" },
    "errorCount": { "type": "integer" },
    "warnCount": { "type": "integer" }
  },
  "required": ["messages", "count", "errorCount", "warnCount"]
}
```

**Success Response Example:**

```json
{
  "ok": true,
  "data": {
    "messages": [
      {
        "level": "error",
        "message": "Uncaught TypeError: Cannot read property 'x' of undefined",
        "timestamp": "2026-06-21T10:00:02.000Z",
        "source": "https://app.example.com/main.js:42"
      }
    ],
    "count": 1,
    "errorCount": 1,
    "warnCount": 0
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
| AC-07-004 | `console.error("test")` in page JS appears in `page.console` with level `error`. |
| AC-07-005 | Uncaught exception appears as console error with stack trace in message. |
| AC-07-006 | `page.console` with `level: "error"` filters out log/warn messages. |
| AC-07-009 | Buffer retains at most 200 messages; oldest evicted on overflow. |
| AC-07-010 | Response includes accurate `errorCount` and `warnCount` tallies. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [01-core-architecture/error-model.md](../01-core-architecture/error-model.md) | Error envelope and codes |
| [03-page-session-management/page.create.md](../03-page-session-management/page.create.md) | Page lifecycle triggers capture start |
| [13-cdp-integration/event-monitoring.md](../13-cdp-integration/event-monitoring.md) | `Runtime.consoleAPICalled`, `Log.entryAdded` |
| [10-recording-test-reports/recording.md](../10-recording-test-reports/recording.md) | Console error event recording |

---

## Out of Scope (V2)

- Console log streaming (real-time push)
- Log level configuration per page
- Source map resolution for minified stacks
- Console message grouping / deduplication
- Performance mark/measure capture
