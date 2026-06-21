# Feature: Test Report Generation

> **Module:** [10-recording-test-reports](./REQUIREMENTS.md)  
> **Type:** Internal (invoked by `test.run` and browser close)

## Overview

Generate structured `TestReport` objects from the recording buffer. Aggregates actions, assertion outcomes, screenshots, network errors, and console errors into a single JSON document suitable for AI agents and human review. Triggered on `test.run` completion or explicit browser close.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-10-007 | The system SHALL generate a structured `TestReport` from the recording buffer. |
| FR-10-008 | TestReport SHALL include: `testName`, `status`, `actionsPerformed`, `assertionsPassed`, `assertionsFailed`, `screenshots`, `networkErrors`, `consoleErrors`, `executionTimeMs`, `startedAt`, `completedAt`. |
| FR-10-009 | `status` SHALL be one of: `passed`, `failed`, `error` (unexpected failure). |
| FR-10-010 | `actionsPerformed` SHALL be an ordered list of recorded action/navigation events. |
| FR-10-011 | `assertionsPassed` and `assertionsFailed` SHALL list assertion events with their messages. |
| FR-10-012 | `screenshots` SHALL list file paths of all captured screenshots. |
| FR-10-013 | `networkErrors` SHALL list failed network requests (status 0 or >= 400). |
| FR-10-014 | `consoleErrors` SHALL list console error-level messages. |
| FR-10-015 | TestReport SHALL be serializable to JSON. |
| FR-10-016 | TestReport MAY optionally be written to a file when requested. |
| FR-10-018 | Test report generation SHALL be triggered by `test.run` completion or explicit browser close. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-10-002 | Test report generation SHALL complete within 500 ms. |
| NFR-10-003 | Test reports SHALL be human-readable and AI-parseable JSON. |
| NFR-10-004 | Screenshot file paths in reports SHALL be absolute paths. |

---

## Data Models / Types

### TestReport

```typescript
interface TestReport {
  testName: string;
  status: 'passed' | 'failed' | 'error';
  startedAt: string;       // ISO 8601
  completedAt: string;     // ISO 8601
  executionTimeMs: number;
  actionsPerformed: RecordedEvent[];
  assertionsPassed: Array<{
    assertion: string;
    message: string;
    timestamp: string;
  }>;
  assertionsFailed: Array<{
    assertion: string;
    message: string;
    expected: unknown;
    actual: unknown;
    timestamp: string;
  }>;
  screenshots: string[];     // absolute file paths
  networkErrors: Array<{
    url: string;
    status: number;
    method: string;
    timestamp: string;
  }>;
  consoleErrors: Array<{
    message: string;
    source?: string;
    timestamp: string;
  }>;
}
```

### Status Derivation Rules

| Condition | `status` |
|-----------|----------|
| Any assertion failed | `failed` |
| Unhandled infrastructure error during test | `error` |
| All assertions passed, no errors | `passed` |

---

## MCP Command Spec

This feature does not expose standalone MCP commands. Report generation is invoked internally:

```typescript
function generateReport(browserId: string, testName?: string): TestReport;
```

The resulting `TestReport` is returned by [`test.run`](../11-test-execution/test-run.md) or included in browser close cleanup.

### Test Report Example

```json
{
  "testName": "Login flow verification",
  "status": "passed",
  "startedAt": "2026-06-21T10:00:00.000Z",
  "completedAt": "2026-06-21T10:00:15.230Z",
  "executionTimeMs": 15230,
  "actionsPerformed": [
    { "timestamp": "2026-06-21T10:00:01.000Z", "type": "navigation", "pageId": "...", "payload": { "url": "https://app.example.com/login" } },
    { "timestamp": "2026-06-21T10:00:03.500Z", "type": "action", "pageId": "...", "payload": { "action": "type", "elementId": "...", "value": "user@example.com" } }
  ],
  "assertionsPassed": [
    { "assertion": "url", "message": "URL contains /dashboard", "timestamp": "2026-06-21T10:00:08.000Z" }
  ],
  "assertionsFailed": [],
  "screenshots": ["/path/to/screenshots/20260621_pageId.png"],
  "networkErrors": [],
  "consoleErrors": []
}
```

---

## Error Cases

| Condition | Behavior |
|-----------|----------|
| Empty recording buffer | Return report with empty arrays and `status: "passed"` |
| Unknown `browserId` | Throw `SESSION_NOT_FOUND` |
| Report generation failure | Return partial report with `status: "error"` |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-10-006 | Test with all passing assertions has `status: "passed"`. |
| AC-10-007 | Test with any failed assertion has `status: "failed"`. |
| AC-10-008 | `executionTimeMs` reflects wall-clock time from first to last event. |
| AC-10-001 | Click action during recorded session appears in `actionsPerformed`. |
| AC-10-002 | Failed assertion appears in `assertionsFailed` with expected/actual. |
| AC-10-003 | Screenshot captured during session appears in `screenshots` array. |
| AC-10-004 | Network request with status 500 appears in `networkErrors`. |
| AC-10-005 | Console.error message appears in `consoleErrors`. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Shared types, error model |
| [recording.md](./recording.md) | Recording buffer as input source |
| [11-test-execution](../11-test-execution/test-run.md) | Primary invocation path |

---

## Out of Scope (V2)

- Report export to HTML/PDF
- Report comparison / diff between runs
- Persistent report storage / database
- HAR file export
