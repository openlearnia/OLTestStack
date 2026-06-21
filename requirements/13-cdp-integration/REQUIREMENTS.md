# Module 13 — CDP Integration Layer

> **Module ID:** `13-cdp-integration`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md)  
> **Depended on by:** All browser-interacting modules (02, 03, 04, 05, 06, 07, 08)

## Overview

Provide a clean abstraction over Chrome DevTools Protocol (CDP) for all browser interactions. Wraps **Puppeteer** (confirmed V1 choice) to drive **Chromium** and exposes typed, domain-oriented methods that higher-level modules consume without direct CDP knowledge. No MCP commands are exposed from this module.

---

## Feature Index

| Feature | Type | Requirements |
|---------|------|--------------|
| CDP client management | Adapter | [cdp-client-management.md](./cdp-client-management.md) |
| Browser & page operations | Adapter | [browser-page-operations.md](./browser-page-operations.md) |
| DOM & accessibility | Adapter | [dom-accessibility.md](./dom-accessibility.md) |
| Input actions | Adapter | [input-actions.md](./input-actions.md) |
| Screenshot capture | Adapter | [screenshot-capture.md](./screenshot-capture.md) |
| Event monitoring | Adapter | [event-monitoring.md](./event-monitoring.md) |
| CDP error handling | Adapter | [cdp-error-handling.md](./cdp-error-handling.md) |
| Browser engine evaluation | Decision doc | [browser-engine-evaluation.md](./browser-engine-evaluation.md) |

---

## Module-Wide Out of Scope (V2)

- Firefox/WebKit CDP adapters
- Raw CDP WebSocket (without Puppeteer/Playwright wrapper)
- CDP session pooling / connection reuse across tests
- Browser extension injection
- CDP over remote debugging port (cloud browsers)
- Performance profiling via CDP Tracing domain
- Emulation domain (device, geolocation, timezone)
