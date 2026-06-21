# Feature: `test.run`

> **Module:** [11-test-execution](./REQUIREMENTS.md)  
> **MCP Command:** `test.run`

## Overview

High-level orchestration command that executes a complete browser test flow: launch browser → create page → navigate → interact → assert → capture evidence → generate report → close browser. Supports explicit step sequences or AI-agent-driven flows via individual MCP tool calls. Primary entry point for end-to-end testing.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-11-001 | The system SHALL provide `test.run` as a high-level orchestration command. |
| FR-11-002 | `test.run` input SHALL include a `goal` string describing the test objective in natural language. |
| FR-11-003 | `test.run` SHALL execute the flow: launch browser → create page → navigate → interact → assert → capture evidence → generate report → close browser. |
| FR-11-004 | `test.run` SHALL accept optional `url` parameter as the starting navigation target. |
| FR-11-005 | `test.run` SHALL accept optional `steps` array for explicit step-by-step execution (alternative to AI-driven flow). |
| FR-11-006 | When `steps` is provided, the server SHALL execute steps sequentially without AI interpretation. |
| FR-11-007 | When only `goal` is provided (no `steps`), the MCP server SHALL delegate step planning to the calling AI agent via individual MCP tool calls (the agent drives the flow). |
| FR-11-008 | `test.run` with explicit `steps` SHALL support step types: `navigate`, `click`, `type`, `press`, `scroll`, `wait`, `screenshot`, `assert.exists`, `assert.text`, `assert.url`, `assert.network`. |
| FR-11-009 | `test.run` SHALL return a complete `TestReport` on completion. |
| FR-11-010 | `test.run` SHALL close the browser session after report generation (cleanup). |
| FR-11-011 | `test.run` SHALL set `testName` in the report to the `goal` string or an explicit `name` parameter. |
| FR-11-012 | If any step fails, `test.run` SHALL continue executing remaining steps unless `stopOnFailure: true` (default `true`). |
| FR-11-013 | `test.run` SHALL capture a screenshot after each assertion and on failure. |
| FR-11-014 | `test.run` SHALL accept optional `headless` and `timeoutMs` overrides. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-11-001 | `test.run` with explicit steps SHALL execute a 5-step test within 30 seconds for a typical web app. |
| NFR-11-002 | Test report SHALL be returned even if the test fails or errors mid-execution. |
| NFR-11-003 | Browser cleanup SHALL occur in a `finally` block regardless of test outcome. |

---

## Data Models / Types

### TestStep

```typescript
type TestStep =
  | { action: 'navigate'; url: string; waitUntil?: string }
  | { action: 'click'; query: string }
  | { action: 'type'; query: string; value: string }
  | { action: 'press'; key: string }
  | { action: 'scroll'; direction: 'up' | 'down' | 'left' | 'right' }
  | { action: 'wait'; condition: string; query?: string; value?: string; durationMs?: number }
  | { action: 'screenshot'; fullPage?: boolean }
  | { action: 'assert.exists'; query: string }
  | { action: 'assert.text'; contains: string }
  | { action: 'assert.url'; url: string }
  | { action: 'assert.network'; url: string; status: number | string };
```

### TestRunInput

```typescript
interface TestRunInput {
  goal: string;
  name?: string;
  url?: string;
  steps?: TestStep[];
  headless?: boolean;
  stopOnFailure?: boolean;
  timeoutMs?: number;
}
```

### TestRunResult

```typescript
interface TestRunResult {
  report: TestReport;      // from Module 10 — see test-report.md
}
```

---

## MCP Command Spec

### `test.run`

**Description:** Execute a complete browser test. Provide a goal and optional explicit steps, or let the AI agent drive individual commands. Returns a structured test report.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "goal": {
      "type": "string",
      "minLength": 1,
      "description": "Natural language description of the test objective."
    },
    "name": {
      "type": "string",
      "description": "Optional test name for the report. Defaults to goal."
    },
    "url": {
      "type": "string",
      "format": "uri",
      "description": "Starting URL to navigate to."
    },
    "steps": {
      "type": "array",
      "description": "Optional explicit step sequence. If omitted, the AI agent drives the test via individual MCP commands.",
      "items": {
        "type": "object",
        "properties": {
          "action": {
            "type": "string",
            "enum": [
              "navigate", "click", "type", "press", "scroll", "wait",
              "screenshot", "assert.exists", "assert.text", "assert.url", "assert.network"
            ]
          }
        },
        "required": ["action"]
      }
    },
    "headless": { "type": "boolean", "default": true },
    "stopOnFailure": { "type": "boolean", "default": true },
    "timeoutMs": { "type": "integer", "minimum": 5000, "default": 60000 }
  },
  "required": ["goal"],
  "additionalProperties": false
}
```

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "report": {
      "type": "object",
      "description": "Complete TestReport — see test-report.md",
      "properties": {
        "testName": { "type": "string" },
        "status": { "type": "string", "enum": ["passed", "failed", "error"] },
        "startedAt": { "type": "string", "format": "date-time" },
        "completedAt": { "type": "string", "format": "date-time" },
        "executionTimeMs": { "type": "integer" },
        "actionsPerformed": { "type": "array" },
        "assertionsPassed": { "type": "array" },
        "assertionsFailed": { "type": "array" },
        "screenshots": { "type": "array", "items": { "type": "string" } },
        "networkErrors": { "type": "array" },
        "consoleErrors": { "type": "array" }
      },
      "required": [
        "testName", "status", "startedAt", "completedAt",
        "executionTimeMs", "actionsPerformed", "assertionsPassed",
        "assertionsFailed", "screenshots", "networkErrors", "consoleErrors"
      ]
    }
  },
  "required": ["report"]
}
```

---

## Error Cases

| Code | Condition |
|------|-----------|
| `TIMEOUT` | Entire test exceeded `timeoutMs` |
| `INTERNAL_ERROR` | Browser launch failed or unrecoverable error |
| `INVALID_INPUT` | Malformed steps array |

**Note:** Individual step failures within `test.run` do NOT throw MCP errors — they are captured in the report's `assertionsFailed` and `status: "failed"`. MCP errors are reserved for infrastructure failures.

---

## Execution Flow

```
test.run invoked
    │
    ├─ browser.launch (headless, recordingEnabled: true)
    ├─ page.create
    ├─ page.navigate (if url provided)
    │
    ├─ FOR EACH step in steps (if provided):
    │     ├─ Resolve element (page.find) if step needs elementId
    │     ├─ Execute step action
    │     ├─ Record event
    │     ├─ Capture screenshot on assertion/failure
    │     └─ Stop if stopOnFailure && step failed
    │
    ├─ generateReport()
    ├─ browser.close (cleanup)
    │
    └─ Return TestReport
```

### Example: Explicit Steps

```json
{
  "goal": "Verify login flow redirects to dashboard",
  "url": "https://app.example.com/login",
  "steps": [
    { "action": "type", "query": "Email", "value": "user@example.com" },
    { "action": "type", "query": "Password", "value": "secret123" },
    { "action": "click", "query": "Sign In" },
    { "action": "wait", "condition": "url", "value": "/dashboard" },
    { "action": "assert.url", "url": "/dashboard" },
    { "action": "assert.text", "contains": "Welcome" },
    { "action": "screenshot" }
  ]
}
```

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-11-001 | `test.run` with explicit steps executes all steps and returns a report. |
| AC-11-002 | Test with all passing assertions returns `status: "passed"`. |
| AC-11-003 | Test with a failing assertion returns `status: "failed"` and includes failure details. |
| AC-11-004 | Browser is closed after test completion regardless of outcome. |
| AC-11-005 | Screenshot is captured on assertion failure. |
| AC-11-006 | `stopOnFailure: true` halts execution after first failure. |
| AC-11-007 | `stopOnFailure: false` continues execution and reports all failures. |
| AC-11-008 | Test exceeding `timeoutMs` returns report with `status: "error"`. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [02-browser-session-management](../02-browser-session-management/REQUIREMENTS.md) | Launch/close browser |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | Create page, navigate |
| [04-element-discovery-targeting](../04-element-discovery-targeting/REQUIREMENTS.md) | Resolve elements for step queries |
| [05-user-actions](../05-user-actions/REQUIREMENTS.md) | Click, type, press, scroll steps |
| [06-screenshots-inspection](../06-screenshots-inspection/REQUIREMENTS.md) | Screenshot capture |
| [08-waiting-synchronization](../08-waiting-synchronization/REQUIREMENTS.md) | Wait steps |
| [09-assertions](../09-assertions/REQUIREMENTS.md) | Assertion steps |
| [10-recording-test-reports](../10-recording-test-reports/test-report.md) | Report generation |
| [12-mcp-server-api](../12-mcp-server-api/tool-registration.md) | MCP tool registration |

---

## Out of Scope (V2)

- AI-autonomous test planning (server-side LLM interprets goal and generates steps)
- Parallel test execution
- Test suite runner (multiple test.run in sequence)
- Test scheduling / CI integration
- Autonomous exploratory testing
- Self-healing on step failure (retry with alternative selectors)
