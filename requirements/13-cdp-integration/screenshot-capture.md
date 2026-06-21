# Feature: Screenshot Capture

> **Module:** [13-cdp-integration](./REQUIREMENTS.md)  
> **Type:** Internal adapter layer

## Overview

Capture page screenshots via CDP Page.captureScreenshot. Returns PNG buffers for persistence by higher-level inspection modules. Supports viewport and full-page capture modes.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-13-024 | The CDP layer SHALL provide `captureScreenshot(page, options)` returning PNG buffer. |
| FR-13-025 | Screenshot options SHALL support `fullPage: boolean`. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-13-001 | CDP layer SHALL NOT leak CDP-specific types to domain modules. |

---

## Data Models / Types

### ScreenshotOptions

```typescript
interface ScreenshotOptions {
  fullPage?: boolean;    // default false
  type?: 'png';          // V1: PNG only
}
```

### CdpAdapter Methods (this feature)

```typescript
interface CdpAdapter {
  captureScreenshot(page: CdpPage, options?: ScreenshotOptions): Promise<Buffer>;
}
```

---

## MCP Command Spec

This feature does not expose MCP commands. Consumed by [06-screenshots-inspection](../06-screenshots-inspection/REQUIREMENTS.md).

---

## Error Cases

| Condition | Mapped Error |
|-----------|--------------|
| Page not loaded | `NAVIGATION_FAILED` |
| Screenshot timeout | `TIMEOUT` |
| CDP capture failure | Typed error with CDP message preserved |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-13-006 | `captureScreenshot` returns valid PNG buffer. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [browser-page-operations.md](./browser-page-operations.md) | `CdpPage` handle |
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model |

### CDP Domains Used

| CDP Domain | Purpose |
|------------|---------|
| `Page` | Screenshot capture |

---

## Out of Scope (V2)

- JPEG/WebP format support
- Element-level screenshot (clip to node bounds)
- Visual regression / pixel diff
