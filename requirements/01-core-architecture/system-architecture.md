# System Architecture

> **Module:** `01-core-architecture`  
> **Feature:** System architecture and layering  
> **Depends on:** None  
> **Depended on by:** All modules (02–13)

## Overview / Purpose

Define the foundational system architecture, layering model, and cross-cutting conventions for the AI Browser Testing Framework V1. This document establishes how MCP clients interact with the server, how commands are structured, and how implementation is organized internally.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-01-001 | The system SHALL expose browser automation exclusively through MCP tool commands; no direct HTTP REST API is required for V1. |
| FR-01-002 | The system SHALL use Chrome DevTools Protocol (CDP) as the sole browser control mechanism internally. |
| FR-01-003 | The system SHALL organize implementation into layered modules: MCP API → Domain Services → CDP Adapter → Browser. |
| FR-01-004 | The system SHALL support approximately 15–20 MCP tools covering browser, page, element, action, inspection, monitoring, waiting, assertion, and test execution domains. |
| FR-01-005 | Each MCP command SHALL accept all session context via input parameters (`browserId`, `pageId`, `elementId`); commands SHALL NOT rely on implicit server-side "current page" state in the request payload. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01-001 | MCP tool response latency for non-navigation commands SHALL be < 500 ms at p95 under local headless execution. |
| NFR-01-002 | The API surface SHALL be designed for LLM consumption: flat JSON objects, descriptive field names, minimal nesting. |
| NFR-01-003 | All MCP tool descriptions SHALL include usage examples in the tool schema `description` field. |
| NFR-01-004 | The server SHALL be deployable as a standalone Node.js/Bun process with MCP stdio transport. |

---

## Data Models / Types

This feature does not define domain data models. See [types.md](./types.md) for shared interfaces and [error-model.md](./error-model.md) for response envelopes.

### Layer Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    AI Agent (MCP Client)                │
└─────────────────────────┬───────────────────────────────┘
                          │ MCP Tools (~18 commands)
┌─────────────────────────▼───────────────────────────────┐
│              MCP Server / API Layer (12)                │
│  Tool schemas · Validation · Error mapping · Recording  │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│           Domain Modules (02–11)                        │
│  Sessions · Elements · Actions · Inspection · Asserts   │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│           CDP Integration Layer (13)                    │
│  Puppeteer (CDP wrapper) → Chromium                     │
└─────────────────────────┬───────────────────────────────┘
                          │ Chrome DevTools Protocol
┌─────────────────────────▼───────────────────────────────┐
│                    Chromium Browser                     │
└─────────────────────────────────────────────────────────┘
```

---

## Architectural Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| AD-01 | Chromium-only via CDP | CDP is the most mature protocol; single engine reduces V1 scope |
| AD-02 | In-memory session registry | Simplicity for V1; no persistence required |
| AD-03 | Ephemeral element IDs | Avoids stale selector issues; forces agents to re-discover after DOM changes |
| AD-04 | Stateless MCP payload design | Each command is self-contained; server holds session state but client passes IDs |
| AD-05 | Bun/Node.js runtime | Aligns with MCP ecosystem; async-first |
| AD-06 | Puppeteer as CDP wrapper (confirmed) | Drives Chromium via CDP; adapter interface allows future swap |
| AD-07 | Headless default | Faster CI/agent execution; headed mode for debugging |
| AD-08 | Auto-recording on by default | Evidence collection is core value proposition for AI testing |

---

## MCP Command Spec

This feature does not define individual MCP commands. All commands follow the shared response envelope defined in [error-model.md](./error-model.md).

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-01-001 | Shared TypeScript types compile and are importable by all domain modules. |
| AC-01-004 | Architecture diagram in README matches implemented module boundaries. |
| AC-01-005 | MCP success/error envelope is validated in integration tests for at least 3 different command types. |

---

## Dependencies on Other Modules

None — this is the foundation module.

Related foundation documents in this module:

| Document | Relationship |
|----------|--------------|
| [types.md](./types.md) | Shared domain interfaces consumed by all layers |
| [error-model.md](./error-model.md) | Response envelope used by MCP API layer |
| [session-registry.md](./session-registry.md) | Server-side state backing stateless MCP payloads |
| [configuration.md](./configuration.md) | Environment and default settings |
| [recording-integration.md](./recording-integration.md) | Cross-cutting event emission |

---

## Out of Scope (V2)

- Persistent session storage / session resume
- Distributed session registry (multi-process)
- Plugin/extension architecture
- Multi-browser-engine abstraction (Firefox, WebKit)
- Authentication / multi-tenant session isolation
- Direct HTTP REST API alongside MCP
