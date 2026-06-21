# Module 01 — Core / Architecture

> **Module ID:** `01-core-architecture`  
> **Depends on:** None (foundation module)  
> **Depended on by:** All modules (02–13)

## Overview

Foundational architecture, shared data models, cross-cutting concerns, and system-wide conventions for the AI Browser Testing Framework V1. This module does not define individual MCP commands; it provides the types, error model, session registry, configuration, and recording hooks consumed by all other modules.

---

## Feature Index

| Feature | Description | Requirements |
|---------|-------------|--------------|
| [System Architecture](./system-architecture.md) | Layering, MCP-only API, stateless payload design, architectural decisions | [→](./system-architecture.md) |
| [Shared Types](./types.md) | `BrowserSession`, `PageSession`, `Element`, `RecordedEvent`, response envelopes | [→](./types.md) |
| [Error Model](./error-model.md) | `ErrorCode` enum, success/error envelopes, message guidelines | [→](./error-model.md) |
| [Session Registry](./session-registry.md) | In-memory registry, cascade-delete, element invalidation | [→](./session-registry.md) |
| [Configuration](./configuration.md) | Environment variables, config file, timeout defaults | [→](./configuration.md) |
| [Recording Integration](./recording-integration.md) | Cross-cutting event emission to recording module | [→](./recording-integration.md) |

---

## MCP Commands

This module defines no MCP commands. See [02-browser-session-management](../02-browser-session-management/REQUIREMENTS.md) and downstream modules for command specs.

---

## Quick Reference

### Shared Error Codes

See [error-model.md](./error-model.md) for the full reference. All commands use:

`SESSION_NOT_FOUND` · `ELEMENT_NOT_FOUND` · `NAVIGATION_FAILED` · `TIMEOUT` · `ASSERTION_FAILED` · `INVALID_INPUT` · `BROWSER_CRASHED` · `INTERNAL_ERROR`

### Key Architectural Decisions

See [system-architecture.md#architectural-decisions](./system-architecture.md#architectural-decisions) for AD-01 through AD-08.

---

## Out of Scope (V2)

See individual feature files. Module-wide exclusions:

- Persistent session storage / session resume
- Distributed session registry (multi-process)
- Multi-browser-engine abstraction (Firefox, WebKit)
- Authentication / multi-tenant session isolation
