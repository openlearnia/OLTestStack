# Feature: Event Monitoring

> **Module:** [13-cdp-integration](./REQUIREMENTS.md)  
> **Type:** Internal adapter layer

## Overview

Enable and capture network and console events per page via CDP Network and Runtime/Log domains. Provides attachable event listeners that domain modules use to populate network and console buffers.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-13-026 | The CDP layer SHALL enable network monitoring via Network.enable and capture request/response events. |
| FR-13-027 | The CDP layer SHALL enable console monitoring via Runtime.consoleAPICalled and Log.entryAdded. |
| FR-13-028 | Network events SHALL include: requestId, url, method, status, resourceType, timestamp. |
| FR-13-029 | Console events SHALL include: level, message, timestamp, source location. |
| FR-13-030 | Event listeners SHALL be attachable per page and removable on page close. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-13-001 | CDP layer SHALL NOT leak CDP-specific types to domain modules. |

---

## Data Models / Types

### CdpNetworkEvent (internal)

```typescript
interface CdpNetworkEvent {
  requestId: string;
  url: string;
  method: string;
  status: number;
  resourceType: string;
  timestamp: number;
  failed: boolean;
  durationMs?: number;
}
```

### CdpConsoleEvent (internal)

```typescript
interface CdpConsoleEvent {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: number;
  source?: string;
}
```

### CdpAdapter Methods (this feature)

```typescript
interface CdpAdapter {
  onNetworkEvent(page: CdpPage, callback: (event: CdpNetworkEvent) => void): void;
  onConsoleEvent(page: CdpPage, callback: (event: CdpConsoleEvent) => void): void;
  removeListeners(page: CdpPage): void;
}
```

---

## MCP Command Spec

This feature does not expose MCP commands. Consumed by [07-network-console-monitoring](../07-network-console-monitoring/REQUIREMENTS.md).

---

## Error Cases

| Condition | Behavior |
|-----------|----------|
| Network.enable fails | Log warning; network buffer remains empty |
| Page closed with active listeners | `removeListeners` called; no memory leak |
| Duplicate listener registration | Replace or deduplicate per page |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-13-007 | Network events captured for XHR requests during page load. |
| AC-13-008 | Console.error messages captured via event listener. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [browser-page-operations.md](./browser-page-operations.md) | `CdpPage` handle, page close cleanup |
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model |

### CDP Domains Used

| CDP Domain | Purpose |
|------------|---------|
| `Network` | Request/response monitoring |
| `Runtime` | Console API |
| `Log` | Browser log entries |

---

## Out of Scope (V2)

- WebSocket frame inspection
- HAR file export
- Request/response body capture
- Performance profiling via CDP Tracing domain
