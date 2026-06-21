# Module 11 — Test Execution

> **Module ID:** `11-test-execution`  
> **Depends on:** All domain modules (02–10), [12-mcp-server-api](../12-mcp-server-api/REQUIREMENTS.md)  
> **Depended on by:** None (top-level orchestration)

## Overview

Provide a high-level `test.run` MCP command that orchestrates a complete test flow: launch browser → navigate → interact → assert → capture evidence → generate report. Primary entry point for AI agents to execute end-to-end tests.

---

## Feature Index

| Feature | MCP Command | Requirements |
|---------|-------------|--------------|
| Test orchestration | `test.run` | [test-run.md](./test-run.md) |

---

## Module-Wide Out of Scope (V2)

- AI-autonomous test planning (server-side LLM interprets goal and generates steps)
- Parallel test execution
- Test suite runner (multiple test.run in sequence)
- Test scheduling / CI integration
- Autonomous exploratory testing
- Self-healing on step failure (retry with alternative selectors)
