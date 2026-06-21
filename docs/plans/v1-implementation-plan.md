# V1 Implementation Plan — AI Browser Testing Framework

> **Status:** Active  
> **Created:** 2026-06-21  
> **Requirements baseline:** `requirements/` (13 modules, 42 feature files, 22 MCP tools)  
> **Confirmed stack:** Bun/Node · TypeScript · MCP SDK · Puppeteer · Chromium

---

## 1. Overview

### Project Goal

Build an AI-native browser automation and testing MCP server that exposes 22 high-level tools for AI agents to launch Chromium, navigate pages, discover elements, perform actions, capture evidence, run assertions, and produce structured test reports. Internally the server uses Puppeteer to drive Chromium via CDP; externally it presents flat, stateless MCP command payloads.

### Tech Stack (Confirmed)

| Layer | Technology |
|-------|------------|
| Runtime | Bun (primary) or Node.js 20+ |
| Language | TypeScript (strict) |
| MCP protocol | `@modelcontextprotocol/sdk` — stdio transport |
| Browser control | **Puppeteer** → **Chromium** |
| Persistence | **PostgreSQL 16** (Docker Compose) + **Drizzle ORM** — optional; recordings/reports only |
| Validation | JSON Schema draft-07 (tool inputs) |
| Testing | Bun test / Vitest; Puppeteer for e2e |
| Package manager | Bun (`bun install`, `bun run`) |

### Key Architectural Constraints

- MCP-only external API (no REST for V1)
- CDP-only internal browser protocol
- In-memory session registry (`browserId`, `pageId`, `elementId`)
- Ephemeral element IDs invalidated on navigation/reload
- Auto-recording enabled by default per browser session
- Headless Chromium by default
- **Docker Compose** for local PostgreSQL (host port **5433**); active sessions stay in-memory, reports/events persist when `PERSIST_RECORDING=true`

---

## 2. Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                    AI Agent (MCP Client)                │
└─────────────────────────┬───────────────────────────────┘
                          │ MCP Tools (22 commands, stdio)
┌─────────────────────────▼───────────────────────────────┐
│              MCP Server / API Layer (12)                │
│  Transport · Tool registry · Validation · Dispatch      │
└─────────────────────────┬───────────────────────────────┘
                          │ handler calls
┌─────────────────────────▼───────────────────────────────┐
│           Domain Modules (02–11)                        │
│  Browser/Page sessions · Elements · Actions · Asserts     │
│  Recording · Test orchestration                         │
└─────────────────────────┬───────────────────────────────┘
                          │ CdpAdapter interface
┌─────────────────────────▼───────────────────────────────┐
│           CDP Integration Layer (13)                    │
│  Puppeteer adapter · AX tree · Input · Screenshots      │
│  Network/console listeners · Error mapping              │
└─────────────────────────┬───────────────────────────────┘
                          │ Chrome DevTools Protocol
┌─────────────────────────▼───────────────────────────────┐
│                    Chromium Browser                     │
└─────────────────────────────────────────────────────────┘

         ┌──────────────────────────────────┐
         │  Core (01) — cross-cutting     │
         │  Types · Errors · Registry ·   │
         │  Config · Recording hooks      │
         └──────────────────────────────────┘
              (injected into all layers)
```

### Data Flow (typical command)

1. MCP client sends `tools/call` with tool name + JSON input
2. MCP layer validates input against JSON Schema → `INVALID_INPUT` on failure
3. Handler resolves `browserId` / `pageId` / `elementId` via session registry
4. Domain service invokes `CdpAdapter` methods (Puppeteer under the hood)
5. Recording hook emits event (if enabled)
6. Success/error envelope returned to client

---

## 3. Implementation Phases (Dependency Order)

| Phase | Name | Modules | Depends On |
|-------|------|---------|------------|
| **0** | Project scaffold | — | — |
| **1** | Core architecture | 01 | 0 |
| **2** | CDP layer | 13 | 1 |
| **3** | Browser + Page MCP | 02, 03 | 1, 2 |
| **4** | Element discovery | 04 | 1, 2, 3 |
| **5** | User actions | 05 | 1–4 |
| **6** | Inspection | 06 | 1–4 |
| **7** | Monitoring | 07 | 1–3 |
| **8** | Waiting | 08 | 1–4, 7 |
| **9** | Assertions | 09 | 1–4, 6, 7 |
| **10** | Recording + reports | 10 | 1–2 |
| **11** | Test execution | 11 | 1–10 |
| **12** | MCP server polish | 12 | 1–11 |

Phases 5–7 can partially overlap once Phase 4 lands (actions, inspection, and monitoring share CDP primitives but have no hard inter-dependencies). Phase 10 recording hooks should be wired incrementally starting at Phase 3.

---

## 4. Phase Breakdown

### Phase 0: Project Scaffold

**Goals:** Runnable TypeScript project with MCP SDK and Puppeteer installed; CI-ready scripts; no domain logic yet.

**Modules/features:** None (infrastructure only)

**Key files/packages to create:**

```
package.json
tsconfig.json
bunfig.toml (optional)
.gitignore
src/index.ts              # stub MCP server entry
src/mcp/server.ts         # MCP SDK bootstrap (empty tool list)
tests/setup.ts
fixtures/sample-app/      # static HTML CRUD demo for e2e
```

**Packages:** `typescript`, `@modelcontextprotocol/sdk`, `puppeteer`, `zod` (optional, for internal validation), `uuid`

**Acceptance criteria:** Server starts on stdio without crashing; `bun run src/index.ts` responds to MCP initialize.

**Complexity:** S

**Dependencies:** None

---

### Phase 1: Core Architecture (Module 01)

**Goals:** Shared types, error model, session registry, configuration loader, recording event bus skeleton.

**Modules/features:**

| Feature file | Deliverable |
|--------------|-------------|
| `types.md` | `BrowserSession`, `PageSession`, `Element`, `RecordedEvent`, response envelopes |
| `error-model.md` | `ErrorCode` enum, `McpSuccessResponse`, `McpErrorResponse`, `createError()` |
| `session-registry.md` | `SessionRegistry` with browser/page/element maps, cascade delete |
| `configuration.md` | Env + optional config file; timeout/headless/screenshot defaults |
| `recording-integration.md` | `RecordingService` interface + no-op impl; event types |
| `system-architecture.md` | Module boundary exports |

**Key files/packages:**

```
src/core/types/
  sessions.ts, elements.ts, responses.ts, recording.ts
src/core/errors/
  codes.ts, envelope.ts
src/core/registry/
  session-registry.ts, element-map.ts
src/core/config/
  load-config.ts, defaults.ts
src/core/recording/
  recording-service.ts, noop-recording.ts
```

**Acceptance criteria:**

- AC-01-001 — Types compile and import across modules
- AC-01-002 — Error codes consistent
- AC-01-003 — Registry CRUD + cascade delete
- AC-01-006–008 — Type field contracts (text truncation, selector hidden)
- AC-01-009–010 — No unhandled exceptions; field-level `INVALID_INPUT`
- AC-01-011–014 — Cascade delete, concurrency safety, element invalidation
- AC-01-015–018 — Config precedence and defaults
- AC-01-019–022 — Recording enable/disable hooks (stub OK until Phase 10)

**Complexity:** M

**Dependencies:** Phase 0

---

### Phase 2: CDP Integration Layer (Module 13)

**Goals:** Puppeteer-backed `CdpAdapter` implementing all internal browser primitives. No MCP exposure.

**Modules/features:**

| Feature file | Deliverable |
|--------------|-------------|
| `cdp-client-management.md` | Launch/close Chromium, binary detection, disconnect handling |
| `browser-page-operations.md` | `createPage`, `navigate`, `reload`, `closePage` |
| `dom-accessibility.md` | AX tree traversal, interactive element extraction |
| `input-actions.md` | Click, type, press, scroll via Puppeteer/CDP Input |
| `screenshot-capture.md` | Viewport + full-page PNG capture |
| `event-monitoring.md` | Network + console CDP listeners per page |
| `cdp-error-handling.md` | Map Puppeteer errors → domain error codes |

**Key files/packages:**

```
src/cdp/
  adapter.ts              # CdpAdapter interface
  puppeteer-adapter.ts    # V1 implementation
  browser-lifecycle.ts
  page-operations.ts
  accessibility.ts
  input-actions.ts
  screenshot.ts
  event-monitors.ts
  error-mapper.ts
tests/cdp/
  puppeteer-adapter.test.ts
  lifecycle.test.ts
```

**Acceptance criteria:**

- AC-13-001 — `launchBrowser` starts Chromium
- AC-13-002 — `createPage` + `navigate` returns correct title
- AC-13-003 — AX tree returns interactive elements with roles/names
- AC-13-004–005 — Click and type work on real DOM
- AC-13-006 — Valid PNG buffer from `captureScreenshot`
- AC-13-007–008 — Network XHR + console.error captured
- AC-13-009–010 — Clean close; external kill → disconnect detection

**Complexity:** L

**Dependencies:** Phase 1

---

### Phase 3: Browser + Page MCP (Modules 02, 03)

**Goals:** First user-facing MCP tools — full browser and page lifecycle.

**Modules/features:**

| MCP Tool | Feature file |
|----------|--------------|
| `browser.launch` | `browser.launch.md` |
| `browser.close` | `browser.close.md` |
| `page.create` | `page.create.md` |
| `page.navigate` | `page.navigate.md` |
| `page.reload` | `page.reload.md` |
| `page.close` | `page.close.md` |

**Key files/packages:**

```
src/domain/browser/
  launch-browser.ts, close-browser.ts
src/domain/page/
  create-page.ts, navigate-page.ts, reload-page.ts, close-page.ts
src/mcp/handlers/
  browser.ts, page.ts
src/mcp/schemas/
  browser.json.ts, page.json.ts
```

**Acceptance criteria:**

- AC-02-001–002, 005, 007–010 — Launch variants, concurrent sessions, recording flag, validation
- AC-02-003–004, 006, 009–010 — Close cascade, crash detection, idempotency
- AC-03-001–002, 004–019 — Page lifecycle, navigation, reload invalidation, metadata updates
- AC-01-021 — Navigation recording event (wire to recording service)

**Complexity:** M

**Dependencies:** Phases 1, 2

---

### Phase 4: Element Discovery (Module 04)

**Goals:** AI-friendly element enumeration and text-based find.

**Modules/features:**

| MCP Tool | Feature file |
|----------|--------------|
| `page.elements` | `page.elements.md` |
| `page.find` | `page.find.md` |

**Key files/packages:**

```
src/domain/elements/
  list-elements.ts, find-element.ts, element-matcher.ts
src/domain/elements/
  element-registry.ts     # pageId → elementId → Element + Puppeteer handle
src/mcp/handlers/elements.ts
src/mcp/schemas/elements.json.ts
```

**Acceptance criteria:**

- AC-04-001–010 — Login form discovery, find by text, invalidation, truncation, uniqueness
- AC-01-013 — Element map cleared on navigation/reload

**Complexity:** M

**Dependencies:** Phases 1–3

---

### Phase 5: User Actions (Module 05)

**Goals:** Element-targeted click/type and page-level press/scroll.

**Modules/features:**

| MCP Tool | Feature file |
|----------|--------------|
| `page.click` | `page.click.md` |
| `page.type` | `page.type.md` |
| `page.press` | `page.press.md` |
| `page.scroll` | `page.scroll.md` |

**Key files/packages:**

```
src/domain/actions/
  click.ts, type.ts, press.ts, scroll.ts
src/mcp/handlers/actions.ts
src/mcp/schemas/actions.json.ts
```

**Acceptance criteria:**

- AC-05-001–016 — All action behaviors, validation, scroll boundaries, delays

**Complexity:** M

**Dependencies:** Phases 1–4

---

### Phase 6: Inspection (Module 06)

**Goals:** Screenshots, snapshots, text, and HTML extraction.

**Modules/features:**

| MCP Tool | Feature file |
|----------|--------------|
| `page.screenshot` | `page-screenshot.md` |
| `page.snapshot` | `page-snapshot.md` |
| `page.text` | `page-text.md` |
| `page.html` | `page-html.md` |

**Key files/packages:**

```
src/domain/inspection/
  screenshot.ts, snapshot.ts, text.ts, html.ts
src/mcp/handlers/inspection.ts
src/mcp/schemas/inspection.json.ts
```

**Acceptance criteria:**

- AC-06-001–006 — PNG files, full-page capture, snapshot contents, truncation

**Complexity:** M

**Dependencies:** Phases 1–4 (snapshot reuses element discovery)

---

### Phase 7: Monitoring (Module 07)

**Goals:** Network request and console message buffers per page.

**Modules/features:**

| MCP Tool | Feature file |
|----------|--------------|
| `page.network` | `page.network.md` |
| `page.console` | `page.console.md` |

**Key files/packages:**

```
src/domain/monitoring/
  network-buffer.ts, console-buffer.ts
src/domain/monitoring/
  network-query.ts, console-query.ts
src/mcp/handlers/monitoring.ts
```

Wire CDP listeners at `page.create` time (Phase 2 `event-monitors.ts`).

**Acceptance criteria:**

- AC-07-001–010 — Capture, filter, buffer limits, error/warn counts

**Complexity:** M

**Dependencies:** Phases 1–3 (CDP listeners from Phase 2)

---

### Phase 8: Waiting (Module 08)

**Goals:** Condition-based synchronization before actions/assertions.

**Modules/features:**

| MCP Tool | Feature file |
|----------|--------------|
| `page.wait` | `page.wait.md` |

**Key files/packages:**

```
src/domain/waiting/
  wait.ts, conditions/
    element.ts, url.ts, network-idle.ts, timeout.ts
src/mcp/handlers/wait.ts
```

**Acceptance criteria:**

- AC-08-001–006 — All wait conditions, timeout errors, elementId on success

**Complexity:** M

**Dependencies:** Phases 1–4, 7 (networkIdle uses network buffer)

---

### Phase 9: Assertions (Module 09)

**Goals:** Declarative pass/fail checks with structured error details.

**Modules/features:**

| MCP Tool | Feature file |
|----------|--------------|
| `assert.exists` | `assert-exists.md` |
| `assert.text` | `assert-text.md` |
| `assert.url` | `assert-url.md` |
| `assert.network` | `assert-network.md` |

**Key files/packages:**

```
src/domain/assertions/
  exists.ts, text.ts, url.ts, network.ts, result.ts
src/mcp/handlers/assertions.ts
src/mcp/schemas/assertions.json.ts
```

**Acceptance criteria:**

- AC-09-001–007 — All assertion types, expected/actual on failure

**Complexity:** S

**Dependencies:** Phases 1–4, 6 (text), 7 (network)

---

### Phase 10: Recording + Test Reports (Module 10)

**Goals:** Auto-record session events; generate `TestReport` on browser close or `test.run`.

**Modules/features:**

| Feature | File |
|---------|------|
| Auto-recording | `recording.md` |
| Test report | `test-report.md` |

**Key files/packages:**

```
src/domain/recording/
  recording-buffer.ts, event-emitter.ts
src/domain/reports/
  build-report.ts, report-types.ts
```

Wire recording hooks into all domain handlers (actions, navigation, assertions, screenshots, network/console errors).

**Acceptance criteria:**

- AC-10-001–009 — All event types in buffer/report
- AC-10-006–008 — Status derivation, execution time

**Complexity:** M

**Dependencies:** Phase 1–2 (hooks from Phase 3 onward)

---

### Phase 11: Test Execution (Module 11)

**Goals:** `test.run` orchestration with explicit step sequences.

**Modules/features:**

| MCP Tool | Feature file |
|----------|--------------|
| `test.run` | `test-run.md` |

**Key files/packages:**

```
src/domain/test/
  run-test.ts, step-executor.ts, step-types.ts
src/mcp/handlers/test.ts
```

**Acceptance criteria:**

- AC-11-001–008 — Step execution, pass/fail, cleanup, screenshots on failure, stopOnFailure, timeout

**Complexity:** L

**Dependencies:** Phases 1–10 (all domain commands)

---

### Phase 12: MCP Server Polish (Module 12)

**Goals:** Production-ready MCP server — all 22 tools registered, validated, documented for LLMs.

**Modules/features:**

| Feature | File |
|---------|------|
| Transport | `transport.md` |
| Tool registration | `tool-registration.md` |
| Validation | `validation.md` |

**Key files/packages:**

```
src/mcp/
  server.ts           # finalize: register all 22 tools
  registry.ts         # ToolRegistry
  validation.ts       # JSON Schema validation
  dispatch.ts         # route tools/call → handlers
  schemas/            # all tool input schemas
  descriptions.ts     # LLM-friendly tool descriptions
```

**Acceptance criteria:**

- AC-12-001–007 — Full tool list, validation, concurrency, stderr/stdout separation, e2e smoke
- AC-01-004 — Architecture matches README diagram
- AC-01-005 — Envelope integration tests for 3+ command types

**Complexity:** M

**Dependencies:** Phases 1–11

> **Note:** A minimal MCP server with stub transport should exist from Phase 0 and grow incrementally (register tools as each phase completes). Phase 12 is the hardening pass, not a greenfield server.

---

## 5. Suggested Repo Structure

```
OLTestStack/
├── src/
│   ├── index.ts                    # Entry: start MCP stdio server
│   ├── core/                       # Module 01
│   │   ├── types/
│   │   ├── errors/
│   │   ├── registry/
│   │   ├── config/
│   │   └── recording/
│   ├── cdp/                        # Module 13
│   │   ├── adapter.ts
│   │   ├── puppeteer-adapter.ts
│   │   └── ...
│   ├── domain/                     # Modules 02–11
│   │   ├── browser/                # 02
│   │   ├── page/                   # 03
│   │   ├── elements/               # 04
│   │   ├── actions/                # 05
│   │   ├── inspection/             # 06
│   │   ├── monitoring/             # 07
│   │   ├── waiting/                # 08
│   │   ├── assertions/             # 09
│   │   ├── recording/              # 10 (buffer)
│   │   ├── reports/                # 10 (report builder)
│   │   └── test/                   # 11
│   └── mcp/                        # Module 12
│       ├── server.ts
│       ├── registry.ts
│       ├── validation.ts
│       ├── dispatch.ts
│       ├── handlers/               # thin: validate → domain → envelope
│       └── schemas/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── fixtures/
│   └── sample-app/                 # Static CRUD HTML for e2e
├── docs/
│   └── plans/
├── docker-compose.yml              # Postgres (5433) + optional app health (8081)
├── Dockerfile
├── drizzle/                        # SQL migrations (Drizzle Kit)
├── requirements/                   # Spec (source of truth)
├── package.json
└── tsconfig.json
```

**Naming conventions:**

- Domain functions: verb-noun (`launchBrowser`, `findElement`)
- MCP handlers: map 1:1 to tool names (`browser.launch` → `handleBrowserLaunch`)
- Internal Puppeteer types never leak past `src/cdp/`

---

## 6. MCP Tool Rollout Order (22 Tools)

Tools are registered incrementally as phases complete. Order reflects dependency chain and e2e testability.

| # | Tool | Phase | Rationale |
|---|------|-------|-----------|
| 1 | `browser.launch` | 3 | Root session; everything depends on it |
| 2 | `page.create` | 3 | Need page before any page command |
| 3 | `page.navigate` | 3 | Unlocks real DOM for downstream tools |
| 4 | `page.reload` | 3 | Invalidation behavior needed before elements |
| 5 | `page.close` | 3 | Page lifecycle complete |
| 6 | `browser.close` | 3 | Session cleanup |
| 7 | `page.elements` | 4 | Discovery before targeting |
| 8 | `page.find` | 4 | Single-element lookup |
| 9 | `page.click` | 5 | First action |
| 10 | `page.type` | 5 | Form interaction |
| 11 | `page.press` | 5 | Keyboard |
| 12 | `page.scroll` | 5 | Viewport |
| 13 | `page.screenshot` | 6 | Visual evidence |
| 14 | `page.text` | 6 | Lightweight inspection |
| 15 | `page.html` | 6 | Structural inspection |
| 16 | `page.snapshot` | 6 | Composite (needs elements) |
| 17 | `page.network` | 7 | Monitoring |
| 18 | `page.console` | 7 | Monitoring |
| 19 | `page.wait` | 8 | Sync before flaky flows |
| 20 | `assert.exists` | 9 | Simplest assertion |
| 21 | `assert.text` | 9 | Content check |
| 22 | `assert.url` | 9 | Navigation check |
| 23 | `assert.network` | 9 | Network verification |
| 24 | `test.run` | 11 | Orchestrator (uses all above) |

**Phase 12 checklist:** Verify `tools/list` returns all registered tools with schemas and LLM descriptions (AC-12-001 cites 22; current feature catalog enumerates **24** — reconcile count during registration).

---

## 7. Testing Strategy

### Unit Tests

| Area | Focus |
|------|-------|
| `core/registry` | CRUD, cascade delete, concurrent access (AC-01-011–012) |
| `core/errors` | Envelope shape, error code mapping |
| `core/config` | Env precedence (AC-01-015–017) |
| `domain/elements` | Matcher logic, truncation, case-insensitive partial match |
| `domain/assertions` | Pass/fail result shapes |
| `domain/reports` | Status derivation from events |
| `mcp/validation` | Schema rejection → `INVALID_INPUT` with field paths |

Mock `CdpAdapter` for domain unit tests — no browser required.

### Integration Tests

| Area | Focus |
|------|-------|
| `cdp/puppeteer-adapter` | Real Chromium: launch, navigate, AX tree, screenshot (AC-13-*) |
| Session lifecycle | Launch → create → navigate → close; no orphan processes |
| Element invalidation | Navigate/reload clears element map (AC-04-004, AC-03-010) |
| Monitoring buffers | Network/console capture after real navigation (AC-07-*) |
| Recording | Events flow from handlers to buffer (AC-10-001–005) |

Run in CI with headless Chromium; set `CHROMIUM_EXECUTABLE_PATH` if needed.

### End-to-End Tests

**Sample app:** `fixtures/sample-app/` — static HTML login form + CRUD list with fetch/XHR.

**Smoke flow (AC-12-007):**

```
browser.launch → page.create → page.navigate → page.snapshot
```

**Full test flow (AC-11-001):**

```
test.run with explicit steps:
  navigate → assert.exists → type → click → assert.url → assert.network
```

**Failure paths:**

- Invalid `browserId` → `SESSION_NOT_FOUND`
- Assertion failure → `ASSERTION_FAILED` + screenshot in report (AC-11-005)
- Navigation timeout → `TIMEOUT`

### Performance Spot Checks

- Non-navigation commands < 500 ms p95 locally (NFR-01-001)
- `browser.launch` < 5 s (NFR-02-001)
- Server startup < 3 s (NFR-12-001)

---

## 8. Milestones

### M1 — Foundation (Phases 0–2)

**Deliverables:**

- Runnable MCP server stub on stdio
- Core types, errors, registry, config
- Puppeteer adapter: launch, navigate, AX tree, screenshot, input primitives
- Unit tests for registry/errors; integration test for Chromium launch

**Exit criteria:** `launchBrowser` + `createPage` + `navigate` work via adapter tests; no MCP tools yet (or stub only).

---

### M2 — Session MCP (Phase 3)

**Deliverables:**

- 6 MCP tools: `browser.launch`, `browser.close`, `page.create`, `page.navigate`, `page.reload`, `page.close`
- E2e smoke: AC-12-007 partial (launch → create → navigate → snapshot stub OK)

**Exit criteria:** Agent can open Chromium, navigate to example.com, close cleanly.

---

### M3 — Interact & Inspect (Phases 4–6)

**Deliverables:**

- 10 more tools: elements, find, 4 actions, 4 inspection
- Sample-app e2e: login form fill + submit + assert

**Exit criteria:** Full interact-and-inspect loop on sample app without assertions module beyond manual checks.

---

### M4 — Observe & Verify (Phases 7–9)

**Deliverables:**

- 6 more tools: network, console, wait, 4 asserts
- Recording buffer wired for actions/navigation/assertions
- E2e: CRUD flow with network assert + console error detection

**Exit criteria:** All 20 non-orchestration tools registered and passing ACs.

---

### M5 — Reports & Orchestration (Phases 10–11)

**Deliverables:**

- `TestReport` generation
- `test.run` with explicit steps
- Failure screenshots in report

**Exit criteria:** AC-11-001–008 satisfied; report includes actions, assertions, screenshots, network/console errors.

---

### M6 — Production MCP Server (Phase 12)

**Deliverables:**

- All 22 tools in `tools/list` with LLM descriptions
- Validation, stderr logging, concurrency safety
- Full e2e suite green in CI
- README with setup instructions (`bun install && bun run`)

**Exit criteria:** AC-12-001–007; V1 feature-complete.

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Puppeteer Chromium download fails in CI | Blocks all e2e | Pin `puppeteer` version; document `CHROMIUM_EXECUTABLE_PATH`; cache browser in CI |
| AX tree incomplete on complex SPAs | Element discovery misses controls | Fallback DOM walk for interactive tags; document limitations; V2 self-healing |
| Element ID staleness confuses agents | `ELEMENT_NOT_FOUND` loops | Clear error messages; `page.snapshot` after navigation; docs in tool descriptions |
| Memory growth from network/console buffers | OOM on long sessions | Enforce 500/200 caps (AC-07-007, AC-07-009); clear on page close |
| Orphan Chromium processes | CI machine pollution | `browser.close` in `finally`; process tree kill; AC-13-009 tests |
| MCP stdio stdout pollution | Protocol corruption | Strict stderr-only logging (AC-12-005); lint rule on `console.log` |
| Flaky waits on SPAs | `TIMEOUT` in CI | Default timeouts from config; `page.wait` networkIdle; increase in CI env |
| Large page HTML/text | Response size / token blow-up | Truncation flags (AC-06-006); `truncated: true` in response |
| Concurrent sessions race | Registry corruption | Mutex/async queue on registry (AC-01-012, AC-12-004) |
| Lightpanda pressure to adopt early | Scope creep | Decision locked: Chromium + Puppeteer V1 only |

---

## 10. Out of Scope Reminders (V2+)

Do not implement in V1:

| Area | V2 items |
|------|----------|
| **Browser engines** | Lightpanda hybrid, Firefox/WebKit, raw CDP WebSocket |
| **Transport** | HTTP/SSE, WebSocket MCP transport |
| **Navigation** | `page.goBack`, `page.goForward`, multi-tab orchestration API |
| **Actions** | Drag-drop, hover, file upload, touch gestures |
| **Discovery** | CSS/XPath selectors, self-healing selectors, shadow DOM API |
| **Inspection** | Visual regression, element crop screenshots, PDF/video |
| **Monitoring** | Request/response bodies, HAR export, mocking, throttling |
| **Waiting** | JS predicate waits, wait-for-request, wait-for-console |
| **Assertions** | Soft asserts, a11y audits, performance asserts, negation |
| **Recording** | Session replay, video, HTML/PDF reports, report diff |
| **Execution** | AI-autonomous planning, parallel runs, CI scheduler |
| **Infrastructure** | Cloud browsers, auth, rate limiting |
| **MCP extras** | Resources for screenshot blobs, prompts for templates |

> **V1 infra note (2026-06-21):** Docker Compose + PostgreSQL persistence for recordings and test reports is implemented behind `PERSIST_RECORDING=true`. Session registry remains in-memory. See `docker-compose.yml`, `src/db/`, and README Docker quickstart.

---

## Appendix A: Requirement Module Map

| Module | Feature files | MCP tools |
|--------|---------------|-----------|
| 01 Core | 6 | 0 |
| 02 Browser | 2 | 2 |
| 03 Page | 4 | 4 |
| 04 Elements | 2 | 2 |
| 05 Actions | 4 | 4 |
| 06 Inspection | 4 | 4 |
| 07 Monitoring | 2 | 2 |
| 08 Waiting | 1 | 1 |
| 09 Assertions | 4 | 4 |
| 10 Recording | 2 | 0 (internal) |
| 11 Test | 1 | 1 |
| 12 MCP Server | 3 | 0 (infra) |
| 13 CDP | 7 | 0 (internal) |
| **Total** | **42** | **22** |

## Appendix B: Environment Variables

| Variable | Default | Used by |
|----------|---------|---------|
| `BROWSER_HEADLESS` | `true` | `browser.launch` |
| `CHROMIUM_EXECUTABLE_PATH` | auto-detect | Puppeteer launch |
| `DEFAULT_TIMEOUT_MS` | `30000` | Navigation, waits |
| `DEFAULT_NAVIGATION_TIMEOUT_MS` | `30000` | `page.navigate` |
| `SCREENSHOT_DIR` | `./screenshots` | `page.screenshot` |
| `DATABASE_URL` | — | PostgreSQL when `PERSIST_RECORDING=true` |
| `PERSIST_RECORDING` | `false` | Flush recordings/reports to Postgres |
| `DB_PORT` | `5433` | Documented Docker host port for Postgres |
| `HEALTH_PORT` | — | Optional HTTP health (8081 in Docker `app` profile) |

## Appendix C: Primary Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.x",
    "puppeteer": "^24.x",
    "uuid": "^11.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/bun": "latest"
  }
}
```

---

*This plan is derived from `requirements/` as of 2026-06-21. Update when requirements change.*
