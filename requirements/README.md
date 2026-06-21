# AI Browser Testing Framework — V1 Requirements

> **Status:** Draft  
> **Version:** 1.0  
> **Last Updated:** 2026-06-21

## Overview

The AI Browser Testing Framework (V1) is an AI-native browser automation and testing system that exposes browser functionality through **Model Context Protocol (MCP)** tools. Internally it uses the **Chrome DevTools Protocol (CDP)** to drive a real browser. Externally it presents high-level, stateless MCP commands designed for AI agents to automate applications, capture evidence, and produce structured test reports.

### Goals

| Category | Goals |
|----------|-------|
| **Functional** | Browser automation, application testing, screenshot capture, UI interaction, network inspection, console log inspection, assertion execution, test reporting |
| **Non-Functional** | AI-friendly API, stateless MCP commands, fast execution, reliable element targeting, support for multiple browser tabs/pages |

### Core Concepts

| Concept | Shape | Description |
|---------|-------|-------------|
| `BrowserSession` | `{ browserId, createdAt }` | A running browser instance |
| `PageSession` | `{ pageId, browserId, url }` | A tab/page within a browser |
| `Element` | `{ elementId, role, text, visible }` | A discoverable, interactable DOM node |

### V1 MCP Command Inventory (~18 commands)

| Category | Commands |
|----------|----------|
| Browser | `browser.launch`, `browser.close` |
| Page | `page.create`, `page.navigate`, `page.reload`, `page.close` |
| Element Discovery | `page.elements`, `page.find` |
| User Actions | `page.click`, `page.type`, `page.press`, `page.scroll` |
| Screenshots & Inspection | `page.screenshot`, `page.snapshot`, `page.text`, `page.html` |
| Monitoring | `page.network`, `page.console` |
| Waiting | `page.wait` |
| Assertions | `assert.exists`, `assert.text`, `assert.url`, `assert.network` |
| Test Execution | `test.run` |

### V2 Future (Out of Scope for V1)

Multi-tab orchestration, mobile emulation, visual regression, accessibility auditing, video capture, session replay, parallel execution, cloud browsers, AI self-healing selectors, autonomous exploratory testing.

---

## Module Index

| # | Module | Description | Requirements |
|---|--------|-------------|--------------|
| 01 | [Core / Architecture](./01-core-architecture/REQUIREMENTS.md) | System architecture, shared types, cross-cutting concerns | [→](./01-core-architecture/REQUIREMENTS.md) |
| 02 | [Browser Session Management](./02-browser-session-management/REQUIREMENTS.md) | Launch, close, and lifecycle of browser instances | [→](./02-browser-session-management/REQUIREMENTS.md) |
| 03 | [Page Session Management](./03-page-session-management/REQUIREMENTS.md) | Tab/page creation, navigation, reload, close | [→](./03-page-session-management/REQUIREMENTS.md) |
| 04 | [Element Discovery & Targeting](./04-element-discovery-targeting/REQUIREMENTS.md) | Enumerate and find interactive elements | [→](./04-element-discovery-targeting/REQUIREMENTS.md) |
| 05 | [User Actions](./05-user-actions/REQUIREMENTS.md) | Click, type, press, scroll interactions | [→](./05-user-actions/REQUIREMENTS.md) |
| 06 | [Screenshots & Inspection](./06-screenshots-inspection/REQUIREMENTS.md) | Screenshots, snapshots, text/HTML extraction | [→](./06-screenshots-inspection/REQUIREMENTS.md) |
| 07 | [Network & Console Monitoring](./07-network-console-monitoring/REQUIREMENTS.md) | Network request and console log capture | [→](./07-network-console-monitoring/REQUIREMENTS.md) |
| 08 | [Waiting & Synchronization](./08-waiting-synchronization/REQUIREMENTS.md) | Condition-based waits and timeouts | [→](./08-waiting-synchronization/REQUIREMENTS.md) |
| 09 | [Assertions](./09-assertions/REQUIREMENTS.md) | Declarative test assertions | [→](./09-assertions/REQUIREMENTS.md) |
| 10 | [Recording & Test Reports](./10-recording-test-reports/REQUIREMENTS.md) | Auto-recording and structured report generation | [→](./10-recording-test-reports/REQUIREMENTS.md) |
| 11 | [Test Execution](./11-test-execution/REQUIREMENTS.md) | `test.run` orchestration flow | [→](./11-test-execution/REQUIREMENTS.md) |
| 12 | [MCP Server / API Layer](./12-mcp-server-api/REQUIREMENTS.md) | MCP tool registration, schemas, error handling | [→](./12-mcp-server-api/REQUIREMENTS.md) |
| 13 | [CDP Integration Layer](./13-cdp-integration/REQUIREMENTS.md) | Chrome DevTools Protocol adapter | [→](./13-cdp-integration/REQUIREMENTS.md) |

### Module 04 — Element Discovery & Targeting

| Feature | Requirements |
|---------|--------------|
| `page.elements` | [page.elements.md](./04-element-discovery-targeting/page.elements.md) |
| `page.find` | [page.find.md](./04-element-discovery-targeting/page.find.md) |

### Module 05 — User Actions

| Feature | Requirements |
|---------|--------------|
| `page.click` | [page.click.md](./05-user-actions/page.click.md) |
| `page.type` | [page.type.md](./05-user-actions/page.type.md) |
| `page.press` | [page.press.md](./05-user-actions/page.press.md) |
| `page.scroll` | [page.scroll.md](./05-user-actions/page.scroll.md) |

### Module 07 — Network & Console Monitoring

| Feature | Requirements |
|---------|--------------|
| `page.network` | [page.network.md](./07-network-console-monitoring/page.network.md) |
| `page.console` | [page.console.md](./07-network-console-monitoring/page.console.md) |

### Module 08 — Waiting & Synchronization

| Feature | Requirements |
|---------|--------------|
| `page.wait` | [page.wait.md](./08-waiting-synchronization/page.wait.md) |

### Module 09 — Assertions

| Feature | Requirements |
|---------|--------------|
| `assert.exists` | [assert-exists.md](./09-assertions/assert-exists.md) |
| `assert.text` | [assert-text.md](./09-assertions/assert-text.md) |
| `assert.url` | [assert-url.md](./09-assertions/assert-url.md) |
| `assert.network` | [assert-network.md](./09-assertions/assert-network.md) |

### Module 10 — Recording & Test Reports

| Feature | Requirements |
|---------|--------------|
| Auto-recording | [recording.md](./10-recording-test-reports/recording.md) |
| Test report generation | [test-report.md](./10-recording-test-reports/test-report.md) |

### Module 11 — Test Execution

| Feature | Requirements |
|---------|--------------|
| `test.run` | [test-run.md](./11-test-execution/test-run.md) |

### Module 12 — MCP Server / API Layer

| Feature | Requirements |
|---------|--------------|
| MCP transport | [transport.md](./12-mcp-server-api/transport.md) |
| Tool registration | [tool-registration.md](./12-mcp-server-api/tool-registration.md) |
| Validation & response formatting | [validation.md](./12-mcp-server-api/validation.md) |

### Module 13 — CDP Integration Layer

| Feature | Requirements |
|---------|--------------|
| CDP client management | [cdp-client-management.md](./13-cdp-integration/cdp-client-management.md) |
| Browser & page operations | [browser-page-operations.md](./13-cdp-integration/browser-page-operations.md) |
| DOM & accessibility | [dom-accessibility.md](./13-cdp-integration/dom-accessibility.md) |
| Input actions | [input-actions.md](./13-cdp-integration/input-actions.md) |
| Screenshot capture | [screenshot-capture.md](./13-cdp-integration/screenshot-capture.md) |
| Event monitoring | [event-monitoring.md](./13-cdp-integration/event-monitoring.md) |
| CDP error handling | [cdp-error-handling.md](./13-cdp-integration/cdp-error-handling.md) |

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                    AI Agent (MCP Client)                │
└─────────────────────────┬───────────────────────────────┘
                          │ MCP Tools (~18 commands)
┌─────────────────────────▼───────────────────────────────┐
│              MCP Server / API Layer (12)                │
│  Tool schemas · Validation · Error mapping · Recording  │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│           Domain Modules (02–11)                        │
│  Sessions · Elements · Actions · Inspection · Asserts   │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│           CDP Integration Layer (13)                    │
│  Puppeteer (CDP wrapper) → Chromium                     │
└─────────────────────────┬───────────────────────────────┘
                          │ Chrome DevTools Protocol
┌─────────────────────────▼───────────────────────────────┐
│                    Chromium Browser                     │
└─────────────────────────────────────────────────────────┘
```

---

## Shared Error Model

All MCP commands return errors using a consistent envelope defined in [01-core-architecture/error-model.md](./01-core-architecture/error-model.md).

| Code | Meaning |
|------|---------|
| `SESSION_NOT_FOUND` | `browserId` or `pageId` does not exist |
| `ELEMENT_NOT_FOUND` | `elementId` or query matched no element |
| `NAVIGATION_FAILED` | URL could not be loaded |
| `TIMEOUT` | Wait or operation exceeded deadline |
| `ASSERTION_FAILED` | Assertion condition not met |
| `INVALID_INPUT` | Schema validation failure |
| `BROWSER_CRASHED` | Browser process terminated unexpectedly |
| `INTERNAL_ERROR` | Unhandled server-side failure |

---

## Document Conventions

- **FR-xxx** — Functional requirement (must-have for V1)
- **NFR-xxx** — Non-functional requirement
- **AC-xxx** — Acceptance criterion (verifiable)
- Requirements are numbered per module (e.g., `FR-02-001` in module 02)
- JSON Schema fragments use draft-07 notation
- "Out of Scope" sections reference V2 items explicitly excluded from V1

---

## Assumptions & Decisions

See [01-core-architecture/system-architecture.md — Architectural Decisions](./01-core-architecture/system-architecture.md#architectural-decisions) for the full list. Key decisions:

1. **Chromium + Puppeteer for V1 (confirmed)** — Single browser engine via CDP using Puppeteer to drive Chromium; no Firefox/WebKit. Lightpanda deferred to V1.1+ hybrid mode ([evaluation](./13-cdp-integration/browser-engine-evaluation.md#decision-chromium-for-v1)).
2. **Server-side session registry** — MCP commands are stateless in payload design, but the server maintains an in-memory session map keyed by `browserId`/`pageId`.
3. **Element IDs are ephemeral** — Regenerated on navigation or DOM mutation; agents should re-discover after page changes.
4. **Auto-recording is opt-out per session** — Recording enabled by default; can be disabled at browser launch.
5. **Headless by default** — `browser.launch` supports `headless: boolean` (default `true`).
6. **Single active page focus** — V1 supports multiple pages per browser but commands operate on one `pageId` at a time; no multi-tab orchestration API.
