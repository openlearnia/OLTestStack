# Feature: Session Script Export & Playback

> **Module:** [10-recording-test-reports](./REQUIREMENTS.md)  
> **Type:** MCP commands (`session_export`, extended `test_run`)  
> **Plan:** [session-script-playback.md](../../docs/plans/session-script-playback.md)

## Overview

Export a live browser session's recording buffer as a replayable `.olteststack.json` script, then replay it via `test_run`. Bridges the gap between ad-hoc agent-driven sessions and repeatable server-side test execution.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-10-020 | The system SHALL provide an MCP tool `session_export` that converts the in-memory recording buffer for an active `browserId` into an ordered step script. |
| FR-10-021 | Exported scripts SHALL use version `"1.0"` and a `.olteststack.json` file format with metadata (`name`, `goal`, `url`, `recordedAt`) and a `steps` array matching the `test_run` step schema. |
| FR-10-022 | `test_run` SHALL accept an inline `script` object or a `scriptFile` path for playback without requiring an explicit `steps` array. |
| FR-10-023 | Event-to-step conversion SHALL map `navigation`, `action`, `assertion`, and `screenshot` events to executable steps; evidence-only events (`network`, `console`, `error`) SHALL be omitted. |
| FR-10-024 | Click/type export SHALL resolve queries from the element registry when recordings contain only `elementId`; unresolvable steps SHALL be skipped with warnings. |
| FR-10-025 | `session_export` SHALL be callable only while the browser session is open (before `browser_close`). |

---

## MCP Command Spec

### `session_export`

**Input**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `browserId` | UUID string | yes | Active browser session |
| `name` | string | no | Script name |
| `goal` | string | no | Natural-language goal metadata |

**Output**

```typescript
interface SessionExportResult {
  script: SessionScript;
  eventCount: number;
  stepCount: number;
  skippedCount: number;
}
```

### Extended `test_run`

Additional input fields:

| Field | Type | Description |
|-------|------|-------------|
| `script` | `SessionScript` | Inline replay script |
| `scriptFile` | string | Path to `.olteststack.json` on MCP server host |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-10-020 | After a recorded click session, `session_export` returns a script with a `click` step using a text/role query. |
| AC-10-021 | `test_run` with `scriptFile` pointing to a valid script executes steps and returns a `TestReport`. |
| AC-10-022 | Export skips unresolvable elementId-only actions and lists warnings in `exportWarnings`. |
| AC-10-023 | Goal-only `test_run` (no steps/script/scriptFile) still returns agent-driven guidance. |

---

## Out of Scope (V1.1)

- Variable substitution in script values
- Replay timing / wait insertion from timestamps
- Multi-page / multi-tab replay
- Export from Postgres (post-close) — live buffer only

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [10-recording-test-reports](./recording.md) | `RecordedEvent` buffer, recording service |
| [11-test-execution](../11-test-execution/REQUIREMENTS.md) | `test_run` step executor |
