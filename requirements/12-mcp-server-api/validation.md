# Feature: Request Validation & Response Formatting

> **Module:** [12-mcp-server-api](./REQUIREMENTS.md)  
> **Type:** Infrastructure

## Overview

Validate all incoming MCP tool invocations against JSON Schema, dispatch to domain module handlers, catch unhandled exceptions, and format success/error responses in the MCP tool result envelope. Supports concurrent invocations on different sessions.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-12-010 | The server SHALL validate all tool inputs against JSON Schema before dispatching. |
| FR-12-011 | Validation failures SHALL return `INVALID_INPUT` with field-level error details. |
| FR-12-012 | The server SHALL dispatch validated requests to the appropriate domain module handler. |
| FR-12-013 | Unhandled exceptions SHALL be caught and returned as `INTERNAL_ERROR`. |
| FR-12-014 | The server SHALL support concurrent tool invocations on different sessions. |
| FR-12-015 | Successful responses SHALL be returned as MCP tool result content with JSON text. |
| FR-12-016 | Error responses SHALL set `isError: true` in MCP tool result and include structured error JSON. |
| FR-12-017 | Screenshot results SHALL include file path as text content; optionally support MCP resource for image data in future. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-12-004 | Validation errors SHALL be logged to stderr without polluting stdout. |

---

## Data Models / Types

### ValidationErrorDetail

```typescript
interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}
```

### McpToolResult (success)

```typescript
interface McpToolResultSuccess {
  content: Array<{ type: 'text'; text: string }>;
  isError?: false;
}
```

### McpToolResult (error)

```typescript
interface McpToolResultError {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
}
```

---

## MCP Command Spec

This feature applies to all MCP tool invocations. Response formats:

### Error Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"ok\":false,\"error\":{\"code\":\"SESSION_NOT_FOUND\",\"message\":\"Page session 'abc-123' not found. It may have been closed.\",\"details\":{\"pageId\":\"abc-123\"}}}"
    }
  ],
  "isError": true
}
```

### Success Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"ok\":true,\"data\":{\"browserId\":\"def-456\",\"createdAt\":\"2026-06-21T10:00:00.000Z\"}}"
    }
  ]
}
```

### Validation Error Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"ok\":false,\"error\":{\"code\":\"INVALID_INPUT\",\"message\":\"Validation failed\",\"details\":{\"errors\":[{\"field\":\"pageId\",\"message\":\"must be a valid UUID\"}]}}}"
    }
  ],
  "isError": true
}
```

---

## Error Cases

| Code | Condition |
|------|-----------|
| `INVALID_INPUT` | JSON Schema validation failure |
| `INTERNAL_ERROR` | Unhandled exception in domain handler |
| MCP method-not-found | Unknown tool name (handled before validation) |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-12-002 | Invalid input to any tool returns `INVALID_INPUT` with field details. |
| AC-12-004 | Concurrent calls to different browser sessions do not interfere. |
| AC-12-005 | Server stderr contains error logs; stdout contains only MCP protocol messages. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model, response envelope |
| [tool-registration.md](./tool-registration.md) | Tool schemas and handler dispatch |
| [02–11](../README.md) | Domain module handlers |

---

## Out of Scope (V2)

- Rate limiting
- Request authentication / authorization
- Response compression
- MCP resources for screenshot image data
