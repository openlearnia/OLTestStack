# Recording Integration

> **Module:** `01-core-architecture`  
> **Feature:** Cross-cutting recording event emission  
> **Depends on:** [types.md](./types.md), [session-registry.md](./session-registry.md)  
> **Depended on by:** All domain modules (02–11), [10-recording-test-reports](../10-recording-test-reports/REQUIREMENTS.md)

## Overview / Purpose

Define how domain operations emit events to the Recording module when recording is enabled on a browser session. Recording provides the evidence trail that powers structured test reports in module 10.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-01-013 | All domain operations (actions, assertions, navigation) SHALL emit events to the Recording module when recording is enabled. |
| FR-01-014 | Recording SHALL be enabled by default for every `BrowserSession` and MAY be disabled via `browser.launch` options. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01-010 | Event emission SHALL not add more than 10 ms overhead at p95 for non-navigation commands. |
| NFR-01-011 | Recording buffers SHALL be released when the parent browser session is closed. |

---

## Data Models / Types

### RecordedEvent

See [types.md](./types.md#recordedevent).

```typescript
interface RecordedEvent {
  timestamp: string;       // ISO 8601
  type: 'action' | 'assertion' | 'navigation' | 'screenshot' | 'network' | 'console' | 'error';
  pageId?: string;
  payload: Record<string, unknown>;
}
```

### Recording Context (per BrowserSession)

```typescript
interface RecordingContext {
  browserId: string;
  enabled: boolean;
  events: RecordedEvent[];
}
```

### Events Emitted by Scope Modules

| Module | Event Types | Trigger |
|--------|-------------|---------|
| 03-page-session-management | `navigation` | `page.navigate`, `page.reload` |
| 05-user-actions | `action` | click, type, press, scroll |
| 06-screenshots-inspection | `screenshot` | screenshot capture |
| 07-network-console-monitoring | `network`, `console` | request/response, log entries |
| 09-assertions | `assertion` | assert commands |
| All modules | `error` | unrecoverable operation failure |

---

## MCP Command Spec

This feature does not define MCP commands. Recording is controlled via the `recordingEnabled` option on [browser.launch](../02-browser-session-management/browser.launch.md).

When `recordingEnabled: false`, domain modules SHALL skip event emission but otherwise operate normally.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-01-019 | `browser.launch` with default options creates a session with recording enabled. |
| AC-01-020 | `browser.launch` with `recordingEnabled: false` suppresses all event emission. |
| AC-01-021 | `page.navigate` emits a `navigation` event with URL and title in payload when recording is enabled. |
| AC-01-022 | Closing a browser releases the recording buffer for garbage collection. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [types.md](./types.md) | `RecordedEvent` interface |
| [session-registry.md](./session-registry.md) | Recording context scoped to `BrowserSession` |
| 02-browser-session-management | Initializes recording context at launch |
| 10-recording-test-reports | Consumes events for report generation |

---

## Out of Scope (V2)

- Selective recording (record only assertions, skip actions)
- Streaming recording events to external sinks in real time
- Recording replay / session playback
- Video capture
