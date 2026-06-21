# Feature: MCP Transport

> **Module:** [12-mcp-server-api](./REQUIREMENTS.md)  
> **Type:** Infrastructure

## Overview

Implement the MCP server process and stdio transport layer. Handles server startup, protocol communication over stdin/stdout, environment configuration, and operational logging constraints required for MCP stdio compatibility.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-12-001 | The system SHALL implement an MCP server using the official MCP SDK (TypeScript). |
| FR-12-002 | The server SHALL use stdio transport as the primary communication channel. |
| FR-12-003 | The server SHALL register all V1 MCP tools (~22 commands) on startup. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-12-001 | Server startup SHALL complete within 3 seconds. |
| NFR-12-003 | Server SHALL be executable via `bun run` or `node` with no additional setup beyond Chromium. |
| NFR-12-004 | Server SHALL log errors to stderr; normal operation SHALL NOT pollute stdout (stdio transport). |

---

## Data Models / Types

### ServerConfiguration

```typescript
interface ServerConfiguration {
  headless: boolean;           // from BROWSER_HEADLESS env
  screenshotDir: string;       // from SCREENSHOT_DIR env
  defaultTimeoutMs: number;      // from DEFAULT_TIMEOUT_MS env
  chromiumExecutablePath?: string;
}
```

---

## MCP Command Spec

This feature does not expose MCP tools. It provides the server process and transport.

### Server Configuration

The MCP server is configured via `mcp.json` or Cursor MCP settings:

```json
{
  "mcpServers": {
    "browser-testing": {
      "command": "bun",
      "args": ["run", "src/index.ts"],
      "env": {
        "BROWSER_HEADLESS": "true",
        "SCREENSHOT_DIR": "./screenshots",
        "DEFAULT_TIMEOUT_MS": "30000"
      }
    }
  }
}
```

### Transport Constraints

| Channel | Allowed Content |
|---------|-----------------|
| stdout | MCP protocol messages only |
| stderr | Error logs, debug output |

---

## Error Cases

| Condition | Behavior |
|-----------|----------|
| MCP SDK initialization failure | Exit process with non-zero code; log to stderr |
| Invalid environment configuration | Use defaults; log warning to stderr |
| stdin closed unexpectedly | Graceful shutdown; close all browser sessions |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-12-001 | MCP server starts and responds to `tools/list` with all 22 tools. |
| AC-12-005 | Server stderr contains error logs; stdout contains only MCP protocol messages. |
| AC-12-007 | End-to-end: agent calls `browser.launch` → `page.create` → `page.navigate` → `page.snapshot` successfully. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Shared configuration, error model |
| [tool-registration.md](./tool-registration.md) | Tool registration on startup |
| [validation.md](./validation.md) | Request dispatch pipeline |

---

## Out of Scope (V2)

- HTTP/SSE transport (only stdio for V1)
- WebSocket transport
- Multi-server federation
- Authentication / API key validation
