# Module 09 — Assertions

> **Module ID:** `09-assertions`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [04-element-discovery-targeting](../04-element-discovery-targeting/REQUIREMENTS.md), [06-screenshots-inspection](../06-screenshots-inspection/REQUIREMENTS.md), [07-network-console-monitoring](../07-network-console-monitoring/REQUIREMENTS.md)  
> **Depended on by:** [10-recording-test-reports](../10-recording-test-reports/REQUIREMENTS.md), [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview

Provide declarative assertion commands that verify page state during test execution. Assertions return pass/fail results with descriptive messages, enabling AI agents to validate expected outcomes and produce structured test evidence.

### Shared Behavior (all assertions)

- Passing assertions return `{ passed: true, assertion, message }` (FR-09-005)
- Failing assertions return `ASSERTION_FAILED` with expected vs actual details (FR-09-006)
- All assertions are recorded when recording is enabled (FR-09-007)
- Assertions complete within 1 second and do not modify page state (NFR-09-001, NFR-09-003)

---

## Feature Index

| Feature | MCP Command | Requirements |
|---------|-------------|--------------|
| Element existence | `assert.exists` | [assert-exists.md](./assert-exists.md) |
| Text content | `assert.text` | [assert-text.md](./assert-text.md) |
| URL match | `assert.url` | [assert-url.md](./assert-url.md) |
| Network request | `assert.network` | [assert-network.md](./assert-network.md) |

---

## Shared Data Models

```typescript
interface AssertionPassResult {
  passed: true;
  assertion: string;
  message: string;
}

interface AssertionFailDetails {
  assertion: string;
  expected: unknown;
  actual: unknown;
  message: string;
}
```

---

## Module-Wide Out of Scope (V2)

- Soft assertions (continue on failure, report all at end)
- Visual regression assertions (pixel diff)
- Accessibility assertions (WCAG compliance)
- Performance assertions (page load time < X ms)
- Custom JavaScript assertion predicates
- Assertion negation (`assert.notExists`)
- Snapshot assertion (full page state diff)
