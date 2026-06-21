# Module 02 — Browser Session Management

> **Module ID:** `02-browser-session-management`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview

Manage the lifecycle of browser instances. Provides MCP commands to launch and close Chromium browsers, register them in the session registry, and configure launch options (headless mode, recording, viewport defaults).

---

## Feature Index

| MCP Command | Description | Requirements |
|-------------|-------------|--------------|
| [`browser.launch`](./browser.launch.md) | Start a new Chromium instance; returns `browserId` | [→](./browser.launch.md) |
| [`browser.close`](./browser.close.md) | Terminate browser, cascade-close pages, release resources | [→](./browser.close.md) |

---

## Module-Level Requirements Summary

| Category | IDs |
|----------|-----|
| Functional | FR-02-001 through FR-02-009 (distributed across feature files) |
| Non-Functional | NFR-02-001 through NFR-02-003 |
| Acceptance | AC-02-001 through AC-02-010 |

---

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| 01-core-architecture | [Session registry](../01-core-architecture/session-registry.md), [error model](../01-core-architecture/error-model.md), [types](../01-core-architecture/types.md), [configuration](../01-core-architecture/configuration.md), [recording integration](../01-core-architecture/recording-integration.md) |
| 13-cdp-integration | Browser process spawn, CDP connection establishment |
| 10-recording-test-reports | Initialize recording context when `recordingEnabled: true` |

---

## Out of Scope (V2)

- Cloud browser providers (BrowserStack, LambdaTest)
- Browser pool / pre-warmed instances
- Persistent browser profiles / cookie jars across sessions
- Mobile device emulation at browser level
- Parallel browser farm management
