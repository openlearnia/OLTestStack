# Feature: Tool Registration

> **Module:** [12-mcp-server-api](./REQUIREMENTS.md)  
> **Type:** Infrastructure

## Overview

Register all V1 MCP tools on server startup with JSON Schema input definitions and LLM-friendly descriptions. Maintains a tool registry that maps tool names to handlers and schemas for discovery via `tools/list`.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-12-003 | The server SHALL register all V1 MCP tools (~22 commands) on startup. |
| FR-12-004 | Each MCP tool SHALL have a JSON Schema for input validation. |
| FR-12-005 | Each MCP tool SHALL have a descriptive `description` field suitable for LLM tool selection. |
| FR-12-006 | Tool descriptions SHALL include usage examples and parameter guidance. |
| FR-12-007 | The server SHALL register the following tool groups: Browser (2), Page (4), Element (2), Action (4), Inspection (4), Monitoring (2), Wait (1), Assert (4), Test (1). |
| FR-12-008 | Tool names SHALL use dot notation: `{domain}.{action}` (e.g., `browser.launch`, `page.click`, `assert.text`). |
| FR-12-009 | All tools SHALL return responses using the shared success/error envelope from Module 01. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-12-002 | Tool schema definitions SHALL be auto-generated from TypeScript types where possible. |

---

## Data Models / Types

### ToolDefinition

```typescript
interface ToolDefinition {
  name: string;            // e.g., "browser.launch"
  description: string;     // LLM-friendly description with examples
  inputSchema: JSONSchema;   // JSON Schema draft-07
  handler: (input: unknown) => Promise<McpSuccessResponse<unknown> | McpErrorResponse>;
}
```

### ToolRegistry

```typescript
interface ToolRegistry {
  tools: Map<string, ToolDefinition>;
  register(tool: ToolDefinition): void;
  dispatch(name: string, input: unknown): Promise<McpToolResult>;
}
```

---

## MCP Command Spec

This feature manages registration of all MCP tools. Full catalog:

### Browser Tools

| Tool | Description |
|------|-------------|
| `browser.launch` | Launch a new Chromium browser. Returns browserId. |
| `browser.close` | Close a browser and all its pages. |

### Page Tools

| Tool | Description |
|------|-------------|
| `page.create` | Create a new tab/page in a browser. Returns pageId. |
| `page.navigate` | Navigate a page to a URL. Waits for load by default. |
| `page.reload` | Reload the current page. |
| `page.close` | Close a page/tab. |

### Element Tools

| Tool | Description |
|------|-------------|
| `page.elements` | List all visible interactive elements on the page. |
| `page.find` | Find a single element by text query. |

### Action Tools

| Tool | Description |
|------|-------------|
| `page.click` | Click an element by elementId. |
| `page.type` | Type text into an input element. |
| `page.press` | Press a keyboard key. |
| `page.scroll` | Scroll the page in a direction. |

### Inspection Tools

| Tool | Description |
|------|-------------|
| `page.screenshot` | Capture a screenshot. Returns file path. |
| `page.snapshot` | Get page state: URL, title, DOM summary, elements. |
| `page.text` | Extract visible text from the page. |
| `page.html` | Extract full page HTML. |

### Monitoring Tools

| Tool | Description |
|------|-------------|
| `page.network` | Get captured network requests. |
| `page.console` | Get captured console messages. |

### Wait Tool

| Tool | Description |
|------|-------------|
| `page.wait` | Wait for element, URL change, network idle, or timeout. |

### Assertion Tools

| Tool | Description |
|------|-------------|
| `assert.exists` | Assert an element exists on the page. |
| `assert.text` | Assert the page contains text. |
| `assert.url` | Assert the current URL matches. |
| `assert.network` | Assert a network request occurred. |

### Test Tool

| Tool | Description |
|------|-------------|
| `test.run` | Execute a complete test and return a report. |

**Total: 22 MCP tools**

---

## Error Cases

| Condition | Behavior |
|-----------|----------|
| Duplicate tool name at registration | Throw at startup; server fails to launch |
| Unknown tool name at dispatch | Return MCP method-not-found error |
| Handler not bound to registered tool | Return `INTERNAL_ERROR` |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-12-001 | MCP server starts and responds to `tools/list` with all 22 tools. |
| AC-12-003 | Unknown tool name returns MCP method-not-found error. |
| AC-12-006 | Tool descriptions are sufficient for an LLM to select the correct tool without documentation. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Response envelope, shared types |
| [02–11](../README.md) | Domain module handlers for tool dispatch |
| [transport.md](./transport.md) | Server startup invokes registration |

---

## Out of Scope (V2)

- MCP resources for screenshot image data
- MCP prompts for test templates
- Tool versioning / deprecation
- Dynamic tool registration at runtime
