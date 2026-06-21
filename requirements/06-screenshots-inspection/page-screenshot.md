# Feature: `page.screenshot`

> **Module:** [06-screenshots-inspection](./REQUIREMENTS.md)  
> **MCP Command:** `page.screenshot`

## Overview

Capture a PNG image of the current page viewport or full scrollable content. Saves the image to a configurable directory and returns the file path with dimensions. Provides visual evidence for AI agents during test execution and is automatically recorded when session recording is enabled.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-06-001 | The system SHALL provide `page.screenshot` to capture a PNG image of the page. |
| FR-06-005 | `page.screenshot` SHALL save the image to a configurable directory and return the file path. |
| FR-06-006 | `page.screenshot` SHALL support `fullPage: boolean` (default `false`) for full scrollable capture. |
| FR-06-012 | Screenshots SHALL be recorded automatically when recording is enabled. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-06-001 | Viewport screenshot SHALL complete within 1 second. |
| NFR-06-002 | Screenshot files SHALL use PNG format for lossless quality. |
| NFR-06-003 | Screenshot directory SHALL default to `./screenshots/` and be configurable via `SCREENSHOT_DIR`. |
| NFR-06-004 | Screenshot filenames SHALL include timestamp and pageId for uniqueness: `{timestamp}_{pageId}.png`. |

---

## Data Models / Types

### ScreenshotResult

```typescript
interface ScreenshotResult {
  file: string;           // absolute or relative file path
  width: number;
  height: number;
  fullPage: boolean;
}
```

---

## MCP Command Spec

### `page.screenshot`

**Description:** Capture a screenshot of the page. Returns the saved file path.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "fullPage": { "type": "boolean", "default": false }
  },
  "required": ["pageId"],
  "additionalProperties": false
}
```

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "file": { "type": "string" },
    "width": { "type": "integer" },
    "height": { "type": "integer" },
    "fullPage": { "type": "boolean" }
  },
  "required": ["file", "width", "height", "fullPage"]
}
```

---

## Error Cases

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |
| `INTERNAL_ERROR` | File write failed or CDP capture failed |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-06-001 | `page.screenshot` creates a valid PNG file at the returned path. |
| AC-06-002 | `page.screenshot` with `fullPage: true` captures entire scrollable page. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model, config (`SCREENSHOT_DIR`) |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | Valid `pageId` |
| [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md) | `Page.captureScreenshot` |
| [10-recording-test-reports](../10-recording-test-reports/REQUIREMENTS.md) | Screenshot event recording |

---

## Out of Scope (V2)

- Visual regression / pixel diff comparison
- Element-level screenshot (crop to element bounds)
- PDF export
- Video recording
- Screenshot annotation / markup
