# Feature: CDP Client Management

> **Module:** [13-cdp-integration](./REQUIREMENTS.md)  
> **Type:** Internal adapter layer

## Overview

Manage Chrome DevTools Protocol (CDP) client lifecycle: library selection, WebSocket connections, browser binary detection, and connection recovery. Provides the foundation for all browser-interacting domain modules without exposing CDP-specific types.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-13-001 | The system SHALL use CDP as the sole protocol for browser communication. |
| FR-13-002 | The system SHALL use **Puppeteer** as the CDP wrapper library for V1 (confirmed decision). |
| FR-13-003 | The CDP layer SHALL manage WebSocket connections to browser targets. |
| FR-13-004 | The CDP layer SHALL handle connection lifecycle: connect, disconnect, reconnect on crash. |
| FR-13-005 | The CDP layer SHALL auto-detect Chromium/Chrome binary or accept `CHROMIUM_EXECUTABLE_PATH`. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-13-001 | CDP layer SHALL NOT leak CDP-specific types to domain modules; all exports use domain-agnostic interfaces. |
| NFR-13-002 | CDP connection overhead SHALL be < 2 seconds for browser launch. |
| NFR-13-003 | CDP layer SHALL be swappable (e.g., future Playwright or hybrid engine) without changing domain modules; V1 ships Puppeteer only. |

---

## Data Models / Types

### CdpBrowser (internal)

```typescript
interface CdpBrowser {
  id: string;
  process: ChildProcess;
  wsEndpoint: string;
  connected: boolean;
}
```

### CdpAdapter Interface (public contract)

```typescript
interface CdpAdapter {
  launchBrowser(options: LaunchOptions): Promise<CdpBrowser>;
  closeBrowser(browser: CdpBrowser): Promise<void>;
  isConnected(browser: CdpBrowser): boolean;
  // ... see feature files for remaining methods
}
```

### LaunchOptions

```typescript
interface LaunchOptions {
  headless?: boolean;
  viewport?: { width: number; height: number };
  userAgent?: string;
  args?: string[];
  executablePath?: string;
}
```

---

## MCP Command Spec

This feature does not expose MCP commands. It provides the internal adapter consumed by domain modules.

---

## Error Cases

| Condition | Mapped Error |
|-----------|--------------|
| Chromium binary not found | `INTERNAL_ERROR` with install guidance |
| WebSocket connection failure | `INTERNAL_ERROR` with CDP message preserved |
| Browser process crash | `BROWSER_CRASHED` via disconnect detection |
| Reconnect timeout exceeded | `BROWSER_CRASHED` |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-13-001 | `launchBrowser` starts Chromium and returns connected instance. |
| AC-13-009 | `closeBrowser` terminates process with no orphan Chromium instances. |
| AC-13-010 | Killing browser process externally triggers disconnect detection. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Shared types, error model |

### Library & Engine Selection (Confirmed 2026-06-21)

| Component | V1 choice | Notes |
|-----------|-----------|-------|
| **CDP wrapper** | **Puppeteer** | `puppeteer` package; `launch()`, `newPage()`, CDP event listeners |
| **Browser engine** | **Chromium** | Bundled binary or `CHROMIUM_EXECUTABLE_PATH` override |
| **Playwright** | Not used in V1 | Evaluated; heavier; deferred unless auto-wait becomes a priority |
| **Lightpanda** | Deferred to V1.1+ | Hybrid fast-path candidate; see [browser-engine-evaluation.md](./browser-engine-evaluation.md) |
| **Firefox / WebKit** | Out of scope | Not CDP-native for V1 architecture |

> **Confirmed decision:** V1 uses **Puppeteer + Chromium** exclusively. See [browser-engine-evaluation.md — Decision: Chromium for V1](./browser-engine-evaluation.md#decision-chromium-for-v1).

---

## Out of Scope (V2)

- Firefox/WebKit CDP adapters
- Raw CDP WebSocket (without Puppeteer/Playwright wrapper)
- CDP session pooling / connection reuse across tests
- CDP over remote debugging port (cloud browsers)
