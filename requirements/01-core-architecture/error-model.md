# Error Model

> **Module:** `01-core-architecture`  
> **Feature:** Shared error codes and response envelope  
> **Depends on:** [types.md](./types.md)  
> **Depended on by:** All modules (02–13), [12-mcp-server-api](../12-mcp-server-api/REQUIREMENTS.md)

## Overview / Purpose

Define the canonical error codes, MCP response envelopes, and error message conventions used by every MCP command in the framework. Ensures AI agents receive consistent, actionable error information regardless of which domain module produced the failure.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-01-017 | All MCP command handlers SHALL return either a success envelope (`ok: true`) or an error envelope (`ok: false`); raw exceptions SHALL NOT leak to clients. |
| FR-01-018 | All error responses SHALL use one of the enumerated `ErrorCode` values defined in this document. |
| FR-01-019 | Error messages SHALL include relevant session IDs (`browserId`, `pageId`, `elementId`) when applicable. |
| FR-01-020 | Error messages SHALL suggest a recovery action when one is obvious (e.g., "Call page.elements to refresh element list"). |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01-002 | Error payloads SHALL use flat JSON with descriptive field names suitable for LLM consumption. |
| NFR-01-007 | Error mapping from internal/CDP failures to public error codes SHALL be deterministic and documented per module. |

---

## Data Models / Types

### ErrorCode

```typescript
type ErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'ELEMENT_NOT_FOUND'
  | 'NAVIGATION_FAILED'
  | 'TIMEOUT'
  | 'ASSERTION_FAILED'
  | 'INVALID_INPUT'
  | 'BROWSER_CRASHED'
  | 'INTERNAL_ERROR';
```

### Error Code Reference

| Code | Meaning | Typical Source Modules |
|------|---------|------------------------|
| `SESSION_NOT_FOUND` | `browserId` or `pageId` does not exist in registry | 02, 03, 04–11 |
| `ELEMENT_NOT_FOUND` | `elementId` invalid or query matched no element | 04, 05, 09 |
| `NAVIGATION_FAILED` | URL could not be loaded | 03 |
| `TIMEOUT` | Wait or operation exceeded deadline | 03, 08 |
| `ASSERTION_FAILED` | Assertion condition not met | 09 |
| `INVALID_INPUT` | Schema validation failure or invalid parameter | All |
| `BROWSER_CRASHED` | Browser process terminated unexpectedly | 02, 03 |
| `INTERNAL_ERROR` | Unhandled server-side or CDP failure | All |

### MCP Success Response Envelope

```typescript
interface McpSuccessResponse<T> {
  ok: true;
  data: T;
}
```

### MCP Error Response Envelope

```typescript
interface McpErrorResponse {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;       // human-readable, AI-friendly
    details?: Record<string, unknown>;
  };
}
```

### Error Message Guidelines

All modules SHALL format error messages to:

1. State what failed in plain language
2. Include the relevant ID (`browserId`, `pageId`, `elementId`) when applicable
3. Suggest a recovery action when obvious

**Example:**

```json
{
  "ok": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Page session 'a1b2c3d4-...' not found. The page may have been closed. Call page.create to open a new page.",
    "details": { "pageId": "a1b2c3d4-..." }
  }
}
```

---

## MCP Command Spec

Every MCP command wraps its result in the shared envelope:

**Success example:**

```json
{
  "ok": true,
  "data": { "browserId": "...", "createdAt": "2026-06-21T12:00:00.000Z" }
}
```

**Error example:**

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Viewport width must be at least 320 pixels.",
    "details": { "field": "viewport.width", "value": 100 }
  }
}
```

Individual commands document their specific error cases in module feature files (e.g., [browser.launch.md](../02-browser-session-management/browser.launch.md)).

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-01-002 | Error codes are enumerated and used consistently across at least browser, page, and element modules. |
| AC-01-005 | MCP success/error envelope is validated in integration tests for at least 3 different command types. |
| AC-01-009 | No MCP command returns an unhandled exception or non-envelope response. |
| AC-01-010 | `INVALID_INPUT` errors include field-level details when schema validation fails. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [types.md](./types.md) | Base response type definitions |
| [12-mcp-server-api](../12-mcp-server-api/REQUIREMENTS.md) | Validates and serializes envelopes at MCP boundary |

---

## Out of Scope (V2)

- Localized / i18n error messages
- Error code versioning or deprecation policy
- Client-side error retry policies
- Structured error telemetry / Sentry integration
