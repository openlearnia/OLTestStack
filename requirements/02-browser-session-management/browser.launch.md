# browser.launch

> **Module:** `02-browser-session-management`  
> **MCP Command:** `browser.launch`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview / Purpose

Launch a new Chromium browser instance, register it in the session registry, and return a `browserId` for subsequent page and automation commands. Configures headless mode, recording, viewport defaults, and optional user agent override.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-02-001 | The system SHALL provide `browser.launch` to start a new Chromium instance and return a `browserId`. |
| FR-02-003 | `browser.launch` SHALL create a `BrowserSession` entry in the session registry. |
| FR-02-005 | `browser.launch` SHALL accept optional configuration: `headless`, `recordingEnabled`, `viewport`, `userAgent`. |
| FR-02-006 | Default launch configuration SHALL be: `headless: true`, `recordingEnabled: true`, viewport 1280×720. |
| FR-02-009 | Multiple independent browser sessions MAY coexist simultaneously. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-02-001 | `browser.launch` SHALL complete within 5 seconds on a typical developer machine (cold start). |
| NFR-02-003 | Browser binary path SHALL be auto-detected or configurable via `CHROMIUM_EXECUTABLE_PATH`. |

---

## Data Models / Types

### BrowserLaunchOptions

```typescript
interface BrowserLaunchOptions {
  headless?: boolean;           // default: true
  recordingEnabled?: boolean;   // default: true
  viewport?: {
    width: number;              // default: 1280
    height: number;             // default: 720
  };
  userAgent?: string;           // optional override
}
```

### BrowserLaunchResult

```typescript
interface BrowserLaunchResult {
  browserId: string;
  createdAt: string;
}
```

### BrowserSession (created in registry)

See [types.md](../01-core-architecture/types.md#browsersession).

---

## MCP Command Spec

### `browser.launch`

**Description:** Launch a new Chromium browser instance. Returns a `browserId` to use with `page.create` and other commands. Example: call with no arguments for a default headless session, or `{ "headless": false }` for a visible window.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "headless": { "type": "boolean", "default": true },
    "recordingEnabled": { "type": "boolean", "default": true },
    "viewport": {
      "type": "object",
      "properties": {
        "width": { "type": "integer", "minimum": 320, "default": 1280 },
        "height": { "type": "integer", "minimum": 240, "default": 720 }
      }
    },
    "userAgent": { "type": "string" }
  },
  "additionalProperties": false
}
```

**Output Schema (wrapped in success envelope):**

```json
{
  "type": "object",
  "properties": {
    "browserId": { "type": "string", "format": "uuid" },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "required": ["browserId", "createdAt"]
}
```

**Success Response Example:**

```json
{
  "ok": true,
  "data": {
    "browserId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "createdAt": "2026-06-21T12:00:00.000Z"
  }
}
```

**Error Cases:**

| Code | Condition |
|------|-----------|
| `INTERNAL_ERROR` | Chromium binary not found or failed to spawn |
| `INVALID_INPUT` | Viewport dimensions out of range |

**Error Response Example:**

```json
{
  "ok": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to launch Chromium. Set CHROMIUM_EXECUTABLE_PATH or install Chromium.",
    "details": {}
  }
}
```

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-02-001 | `browser.launch` with empty input returns a valid `browserId` and starts a headless browser. |
| AC-02-002 | `browser.launch` with `headless: false` opens a visible browser window. |
| AC-02-005 | Two concurrent `browser.launch` calls return distinct `browserId` values. |
| AC-02-007 | Launch with `recordingEnabled: false` creates a session without recording event emission. |
| AC-02-008 | Viewport width below 320 returns `INVALID_INPUT`. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [session-registry.md](../01-core-architecture/session-registry.md) | Creates `BrowserSession` entry |
| [error-model.md](../01-core-architecture/error-model.md) | Response envelope and error codes |
| [configuration.md](../01-core-architecture/configuration.md) | `BROWSER_HEADLESS`, `CHROMIUM_EXECUTABLE_PATH` defaults |
| [recording-integration.md](../01-core-architecture/recording-integration.md) | Initializes recording context when enabled |
| 13-cdp-integration | Browser process spawn, CDP connection establishment |
| 10-recording-test-reports | Recording buffer initialization |

---

## Out of Scope (V2)

- Cloud browser providers (BrowserStack, LambdaTest)
- Browser pool / pre-warmed instances
- Persistent browser profiles / cookie jars across sessions
- Mobile device emulation at browser level
- Parallel browser farm management
