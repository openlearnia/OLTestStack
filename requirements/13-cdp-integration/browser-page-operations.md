# Feature: Browser & Page Operations

> **Module:** [13-cdp-integration](./REQUIREMENTS.md)  
> **Type:** Internal adapter layer

## Overview

Provide CDP-backed browser launch/close and page create/navigate/reload/close operations. Maps high-level domain options to Puppeteer APIs and exposes typed `CdpBrowser` and `CdpPage` handles.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-13-006 | The CDP layer SHALL provide `launchBrowser(options)` returning a CDP browser instance. |
| FR-13-007 | The CDP layer SHALL provide `closeBrowser(browserInstance)` for cleanup. |
| FR-13-008 | Launch options SHALL map to Puppeteer launch options: headless, viewport, userAgent, args. |
| FR-13-009 | The CDP layer SHALL provide `createPage(browserInstance)` returning a CDP page/target. |
| FR-13-010 | The CDP layer SHALL provide `navigate(page, url, options)` with waitUntil support. |
| FR-13-011 | The CDP layer SHALL provide `reload(page, options)`. |
| FR-13-012 | The CDP layer SHALL provide `closePage(page)`. |
| FR-13-013 | The CDP layer SHALL provide `getUrl(page)` and `getTitle(page)`. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-13-002 | CDP connection overhead SHALL be < 2 seconds for browser launch. |

---

## Data Models / Types

### CdpPage (internal)

```typescript
interface CdpPage {
  id: string;
  browserId: string;
  targetId: string;
  url: string;
  title: string;
}
```

### NavigateOptions

```typescript
interface NavigateOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeoutMs?: number;
}
```

### CdpAdapter Methods (this feature)

```typescript
interface CdpAdapter {
  launchBrowser(options: LaunchOptions): Promise<CdpBrowser>;
  closeBrowser(browser: CdpBrowser): Promise<void>;
  createPage(browser: CdpBrowser): Promise<CdpPage>;
  navigate(page: CdpPage, url: string, options?: NavigateOptions): Promise<void>;
  reload(page: CdpPage, options?: NavigateOptions): Promise<void>;
  closePage(page: CdpPage): Promise<void>;
  getUrl(page: CdpPage): Promise<string>;
  getTitle(page: CdpPage): Promise<string>;
}
```

---

## MCP Command Spec

This feature does not expose MCP commands. Consumed by [02-browser-session-management](../02-browser-session-management/REQUIREMENTS.md) and [03-page-session-management](../03-page-session-management/REQUIREMENTS.md).

---

## Error Cases

| Condition | Mapped Error |
|-----------|--------------|
| Navigation timeout | `NAVIGATION_FAILED` or `TIMEOUT` |
| Invalid URL | `INVALID_INPUT` |
| Page/target destroyed | `SESSION_NOT_FOUND` |
| Browser disconnected during operation | `BROWSER_CRASHED` |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-13-001 | `launchBrowser` starts Chromium and returns connected instance. |
| AC-13-002 | `createPage` + `navigate` loads a URL and returns correct title. |
| AC-13-009 | `closeBrowser` terminates process with no orphan Chromium instances. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [cdp-client-management.md](./cdp-client-management.md) | Connection lifecycle, `CdpBrowser` type |
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model |

### CDP Domains Used

| CDP Domain | Purpose |
|------------|---------|
| `Browser` | Browser process management |
| `Target` | Page/tab creation and management |
| `Page` | Navigation |

---

## Out of Scope (V2)

- Multi-tab orchestration
- Emulation domain (device, geolocation, timezone)
- Browser extension injection
