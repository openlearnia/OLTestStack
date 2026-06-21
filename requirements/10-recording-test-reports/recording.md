# Feature: Auto-Recording

> **Module:** [10-recording-test-reports](./REQUIREMENTS.md)  
> **Type:** Internal (transparent to MCP client)

## Overview

Automatically record all test activity during a browser session when recording is enabled. Captures actions, assertions, navigations, screenshots, network events, console messages, and errors into a per-browser event buffer. Provides the evidence trail consumed by test report generation.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-10-001 | The system SHALL automatically record all actions, assertions, navigations, screenshots, network errors, and console errors during a session when recording is enabled. |
| FR-10-002 | Recording SHALL be initialized when `browser.launch` is called with `recordingEnabled: true` (default). |
| FR-10-003 | Each recorded event SHALL include: `timestamp`, `type`, `pageId` (if applicable), `payload`. |
| FR-10-004 | Recorded event types SHALL include: `action`, `assertion`, `navigation`, `screenshot`, `network`, `console`, `error`. |
| FR-10-005 | Recording buffer SHALL be scoped to a `browserId` and accessible until browser close. |
| FR-10-006 | Recording SHALL NOT significantly impact command execution latency (< 10 ms overhead per event). |
| FR-10-017 | The recording buffer for a browser session SHALL be queryable internally by the Test Execution module. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-10-001 | Recording buffer SHALL not exceed 10 MB per browser session. |
| NFR-10-003 | Recorded events SHALL be human-readable and AI-parseable JSON. |

---

## Data Models / Types

### RecordedEvent

```typescript
interface RecordedEvent {
  timestamp: string;       // ISO 8601
  type: 'action' | 'assertion' | 'navigation' | 'screenshot' | 'network' | 'console' | 'error';
  pageId?: string;
  payload: Record<string, unknown>;
}
```

### RecordingContext

```typescript
interface RecordingContext {
  browserId: string;
  testName?: string;
  events: RecordedEvent[];
  startedAt: string;       // ISO 8601
}
```

---

## MCP Command Spec

This feature does not expose standalone MCP commands. Recording is transparent to the MCP client — events are captured automatically when domain modules invoke the internal API.

### Internal API

```typescript
// Called by domain modules (05–09, 03, etc.)
function recordEvent(browserId: string, event: RecordedEvent): void;

// Query buffer (used by test.run and report generation)
function getRecordingContext(browserId: string): RecordingContext | undefined;
```

---

## Error Cases

| Condition | Behavior |
|-----------|----------|
| Recording disabled | `recordEvent` is a no-op; buffer remains empty |
| Unknown `browserId` | Silently discard or log warning; do not throw |
| Buffer size exceeds 10 MB | Drop oldest non-error events; preserve all `error` and `assertion` events |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-10-001 | Click action during recorded session appears in `actionsPerformed` after report generation. |
| AC-10-002 | Failed assertion appears in recording buffer with expected/actual payload. |
| AC-10-003 | Screenshot captured during session produces a `screenshot` event in the buffer. |
| AC-10-004 | Network request with status 500 produces a `network` event in the buffer. |
| AC-10-005 | Console.error message produces a `console` event in the buffer. |
| AC-10-009 | Recording disabled via `browser.launch` produces empty recording buffer. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | `RecordedEvent` type, session registry |
| [02-browser-session-management](../02-browser-session-management/REQUIREMENTS.md) | Recording context initialization on launch |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | Navigation event emission |
| [05-user-actions](../05-user-actions/REQUIREMENTS.md) | Action event emission |
| [06-screenshots-inspection](../06-screenshots-inspection/REQUIREMENTS.md) | Screenshot event emission |
| [07-network-console-monitoring](../07-network-console-monitoring/REQUIREMENTS.md) | Network/console event emission |
| [09-assertions](../09-assertions/REQUIREMENTS.md) | Assertion event emission |

---

## Out of Scope (V2)

- Session replay (re-execute recorded actions)
- Video recording
- Real-time streaming of events to MCP client
- Persistent event storage / database
