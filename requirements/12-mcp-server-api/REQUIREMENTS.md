# Module 12 — MCP Server / API Layer

> **Module ID:** `12-mcp-server-api`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), all domain modules (02–11)  
> **Depended on by:** None (entry point)

## Overview

Implement the MCP server that registers, validates, and dispatches all browser testing tools. External-facing API layer that AI agents interact with. Handles MCP protocol transport, tool schema definitions, input validation, error mapping, and response formatting.

**Cursor MCP naming:** Registered tool names use underscores (`browser_launch`, `page_navigate`, …) because Cursor filters out names containing dots. Requirements and docs may refer to conceptual dot notation (`browser.launch`); both forms are accepted at dispatch time.

---

## Feature Index

| Feature | Type | Requirements |
|---------|------|--------------|
| MCP transport | Infrastructure | [transport.md](./transport.md) |
| Tool registration | Infrastructure | [tool-registration.md](./tool-registration.md) |
| Validation & response formatting | Infrastructure | [validation.md](./validation.md) |

---

## Module-Wide Out of Scope (V2)

- HTTP/SSE transport (only stdio for V1)
- MCP resources for screenshot image data
- MCP prompts for test templates
- Authentication / API key validation
- Rate limiting
- Tool versioning / deprecation
- WebSocket transport
- Multi-server federation
