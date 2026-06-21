# Feature: CDP Error Handling

> **Module:** [13-cdp-integration](./REQUIREMENTS.md)  
> **Type:** Internal adapter layer

## Overview

Wrap CDP command failures in typed domain errors, detect browser crashes via disconnect events, and provide configurable per-operation timeouts. Ensures consistent error propagation to domain modules and the MCP API layer.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-13-031 | CDP command failures SHALL be wrapped in typed errors with CDP error message preserved. |
| FR-13-032 | Browser crash detection SHALL use target destroyed / disconnected events. |
| FR-13-033 | CDP timeouts SHALL be configurable per operation. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-13-001 | CDP layer SHALL NOT leak CDP-specific types to domain modules; all exports use domain-agnostic interfaces. |
| NFR-13-004 | CDP layer SHALL handle stale node references gracefully (re-query on stale). |

---

## Data Models / Types

### CdpError (internal)

```typescript
interface CdpError extends Error {
  cdpMessage: string;
  cdpCode?: number;
  operation: string;
  recoverable: boolean;
}
```

### TimeoutConfig

```typescript
interface TimeoutConfig {
  navigationMs: number;    // default 30000
  actionMs: number;        // default 5000
  screenshotMs: number;    // default 10000
}
```

### Error Mapping

| CDP Condition | Domain Error Code |
|---------------|-------------------|
| Target destroyed | `SESSION_NOT_FOUND` or `BROWSER_CRASHED` |
| Navigation timeout | `TIMEOUT` or `NAVIGATION_FAILED` |
| Node not found | `ELEMENT_NOT_FOUND` |
| Unhandled CDP failure | `INTERNAL_ERROR` |

---

## MCP Command Spec

This feature does not expose MCP commands. Error codes propagate through domain modules to the MCP response envelope.

---

## Error Cases

| Code | Condition |
|------|-----------|
| `BROWSER_CRASHED` | Browser process terminated or WebSocket disconnected |
| `TIMEOUT` | Operation exceeded configured deadline |
| `INTERNAL_ERROR` | Unrecoverable CDP command failure |
| `ELEMENT_NOT_FOUND` | Stale node after re-query attempt |
| `SESSION_NOT_FOUND` | Page/target no longer exists |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-13-010 | Killing browser process externally triggers disconnect detection. |
| AC-13-009 | `closeBrowser` terminates process with no orphan Chromium instances. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [cdp-client-management.md](./cdp-client-management.md) | Connection lifecycle events |
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Shared error model and codes |

---

## Out of Scope (V2)

- Automatic retry with exponential backoff
- Circuit breaker for repeated CDP failures
- Error telemetry / metrics export
