# OLTestStack Guides

Agent-focused documentation for the AI Browser Testing Framework MCP server.

## Guides

| Guide | Description |
|-------|-------------|
| [MCP Server Setup](./mcp-server-setup.md) | Install, configure, and run the MCP server in Cursor and other clients |
| [Session Dashboard](./dashboard.md) | Browse persisted test reports and event timelines in the browser |
| [MCP Tools Reference](./mcp-tools-reference.md) | Input/output schemas, errors, and examples for every tool |
| [Agent Workflows](./agent-workflows.md) | Recommended patterns for AI agents using browser testing tools |
| [Session Script Playback](../plans/session-script-playback.md) | Export sessions as `.olteststack.json` scripts and replay them |
| [Skills](./skills.md) | Cursor Agent Skills for browser testing workflows |

## Project Cursor setup

OLTestStack includes Cursor artifacts for AI browser testing:

| Type | Location | Artifacts |
|------|----------|-----------|
| **Skills** | [`.cursor/skills/`](../../.cursor/skills/) | `browser-test-login`, `browser-test-crud`, `olteststack-mcp` |
| **Subagents** | [`.cursor/agents/`](../../.cursor/agents/) | `browser-tester`, `browser-debugger` |
| **Rules** | `~/.cursor/rules/` (user-level) | `olteststack-mcp-usage` (always apply), `olteststack-typescript` (`**/*.ts`) |

Rules are user-level (not checked into this repo). Create or sync them under `~/.cursor/rules/` on each machine where you use OLTestStack.

Configure the MCP server in [`.cursor/mcp.json`](../../.cursor/mcp.json) (see [MCP Server Setup](./mcp-server-setup.md)).

## Quick links

- [Root README](../../README.md) — project overview and quick start
- [V1 Implementation Plan](../plans/v1-implementation-plan.md) — phase roadmap and tool rollout
- [Requirements](../../requirements/) — full specification (source of truth)

## Current status (V1)

**35 MCP tools** are implemented — browser lifecycle, pages, elements, actions (including `page_select` / `page_upload`), inspection, monitoring, waiting, assertions, session introspection/list/export/save, `script_lint`, debug reports, and scripted `test_run` (including suites).

Start with [MCP Server Setup](./mcp-server-setup.md), then [Agent Workflows](./agent-workflows.md) for end-to-end test patterns.
