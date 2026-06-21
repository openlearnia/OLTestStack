# Module 07 — Network & Console Monitoring

> **Module ID:** `07-network-console-monitoring`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [09-assertions](../09-assertions/REQUIREMENTS.md), [10-recording-test-reports](../10-recording-test-reports/REQUIREMENTS.md), [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview

Capture and expose network requests and browser console output for a page. Enables AI agents to inspect API calls, detect failed requests, and review JavaScript errors/warnings during test execution. Capture begins automatically on page creation; buffers persist until page close.

---

## Feature Index

| MCP Command | Description | Requirements |
|-------------|-------------|--------------|
| [`page.network`](./page.network.md) | Return captured network requests | [→](./page.network.md) |
| [`page.console`](./page.console.md) | Return captured console messages | [→](./page.console.md) |

---

## Module-Level Requirements Summary

| Category | IDs |
|----------|-----|
| Functional | FR-07-001 through FR-07-015 (distributed across feature files) |
| Non-Functional | NFR-07-001 through NFR-07-003 |
| Acceptance | AC-07-001 through AC-07-010 |

---

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| 01-core-architecture | [Error model](../01-core-architecture/error-model.md) |
| 03-page-session-management | Page lifecycle triggers capture start/stop |
| 13-cdp-integration | Network.enable, Runtime.consoleAPICalled, Log.entryAdded |
| 10-recording-test-reports | Network/console error event recording |
| 09-assertions | `assert.network` reads from network buffer |

---

## Out of Scope (V2)

- Request/response body capture
- HAR file export
- Network throttling / offline simulation
- Request mocking / interception
- WebSocket message monitoring
- Performance timing waterfall visualization
- Console log streaming (real-time push)
