# Configuration

> **Module:** `01-core-architecture`  
> **Feature:** System configuration and defaults  
> **Depends on:** [system-architecture.md](./system-architecture.md)  
> **Depended on by:** [02-browser-session-management](../02-browser-session-management/REQUIREMENTS.md), [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [08-waiting-synchronization](../08-waiting-synchronization/REQUIREMENTS.md)

## Overview / Purpose

Define how the framework loads default settings from environment variables and/or configuration files, and how per-command timeout overrides interact with those defaults.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-01-015 | The system SHALL support configurable defaults via environment variables and/or a config file (e.g., `BROWSER_HEADLESS`, `DEFAULT_TIMEOUT_MS`, `SCREENSHOT_DIR`). |
| FR-01-016 | Per-command timeout overrides SHALL be supported where applicable (primarily `page.wait` and navigation). |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01-008 | Configuration SHALL be loaded once at server startup; runtime config file watching is not required for V1. |
| NFR-01-009 | Environment variables SHALL take precedence over config file values when both are set. |

---

## Data Models / Types

### Environment Variables

| Variable | Type | Default | Used by |
|----------|------|---------|---------|
| `BROWSER_HEADLESS` | boolean | `true` | `browser.launch` default |
| `DEFAULT_TIMEOUT_MS` | integer | `30000` | General operation timeouts |
| `DEFAULT_NAVIGATION_TIMEOUT_MS` | integer | `30000` | `page.navigate`, `page.reload` |
| `SCREENSHOT_DIR` | string | `./screenshots` | Screenshot capture (module 06) |
| `CHROMIUM_EXECUTABLE_PATH` | string | auto-detect | Browser launch (module 02) |
| `DATABASE_URL` | string | — | PostgreSQL when `PERSIST_RECORDING=true` (dev: `localhost:5433`) |
| `PERSIST_RECORDING` | boolean | `false` | Persist recordings/reports on browser close |
| `DB_PORT` | integer | `5433` | Documented default Docker host port for Postgres |
| `HEALTH_PORT` | integer | — | Optional HTTP health endpoint (8081 in Docker) |

### Config File (optional)

```typescript
interface FrameworkConfig {
  headless?: boolean;
  defaultTimeoutMs?: number;
  defaultNavigationTimeoutMs?: number;
  screenshotDir?: string;
  chromiumExecutablePath?: string;
}
```

### Precedence Order

1. Explicit MCP command parameter (e.g., `timeoutMs` on `page.navigate`)
2. Environment variable
3. Config file value
4. Built-in default

---

## MCP Command Spec

This feature does not define MCP commands. Configuration affects default values in command schemas documented in domain modules.

**Example:** `page.navigate` uses `DEFAULT_NAVIGATION_TIMEOUT_MS` when `timeoutMs` is omitted.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-01-015 | Setting `BROWSER_HEADLESS=false` causes `browser.launch` with no input to start a headed browser. |
| AC-01-016 | Setting `DEFAULT_NAVIGATION_TIMEOUT_MS=5000` causes navigation without explicit `timeoutMs` to use 5000 ms. |
| AC-01-017 | Command-level `timeoutMs` override takes precedence over environment default. |
| AC-01-018 | Missing config file does not prevent server startup; built-in defaults apply. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [system-architecture.md](./system-architecture.md) | Server startup and deployment model |
| 02-browser-session-management | Consumes headless and Chromium path defaults |
| 03-page-session-management | Consumes navigation timeout defaults |
| 08-waiting-synchronization | Consumes general timeout defaults |

---

## Out of Scope (V2)

- Hot-reload of configuration without server restart
- Per-client or per-tenant configuration profiles
- Configuration validation UI or CLI
- Secrets management integration (Vault, etc.)
