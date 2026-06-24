# Tool Expansion v1.3

Expand OLTestStack MCP from 27 → ~33 tools with atomic query actions, session introspection, richer waits, and negative assertions.

**Status:** Wave 1 implemented (31 tools). Wave 1.5 deferred (3 tools). Wave 2 planned (2 tools).

---

## Debate summary (four agents)

### Composite agent (orchestration-first)

**Position:** Agents burn tokens on `page_find` → `page_click` two-step dances. Atomic `page_click_query` / `page_type_query` cut round-trips and guarantee the recorded query matches the action.

**Concession:** Keep `page_find` + `page_click` for inspection-only flows where the agent needs `matchCount` / `candidates` before acting.

**Verdict:** Ship atomic query tools as P0; they become the default in agent skills.

### Debug agent (observability-first)

**Position:** `session_status` is the missing heartbeat — alive/crashed/recording/eventCount without dumping full state. `browser_close` must return `reportId` so agents don't guess after flush.

**Concession:** `send_report` stays for deep dumps; `session_get` wraps dashboard SQL for post-close forensics.

**Verdict:** Session tools + `reportId` on close are P0; `session_list` can wait.

### CI agent (pipeline-first)

**Position:** `page_wait.networkRequest` and `elementHidden` eliminate brittle `timeout` sleeps in CI. `negate` on asserts enables "spinner gone" and "error banner absent" without new tool types.

**Concession:** `networkRequest` defaults status to `2xx` to match `assert_network` ergonomics.

**Verdict:** Wait extensions + assert `negate` ship in Wave 1 alongside query actions.

### Minimalist agent (surface-area-first)

**Position:** 27 tools already cover 95% of flows. Every new tool is documentation debt. Prefer extending existing tools (`page_click` optional `query` already exists).

**Concession:** `page_click_query` is justified — it's not just sugar, it fixes recording consistency. `session_get` duplicates dashboard HTTP — acceptable as MCP-native access for headless agents.

**Verdict:** Cap v1.3 at ~33 tools. Defer `page_select`, `page_upload`, `session_list` to Wave 1.5. No `page_frame` until a concrete user story.

### Synthesis (agreed plan)

| Priority | Item | Rationale |
|----------|------|-----------|
| P0 | `page_click_query`, `page_type_query` | Atomic find+act + replay query |
| P0 | `session_status`, `session_get` | Live health + persisted fetch |
| P0 | `page_wait` extensions | CI-stable sync |
| P0 | Assert `negate` | Negative checks without new tools |
| P0 | `browser_close` → `reportId` | Close the persistence loop |
| P1 | `page_select`, `page_upload`, `session_list` | Common but not blocking |
| P2 | `page_frame`, `page_cookies` | Niche; Wave 2 |

---

## Phasing

### Wave 1 — Agent ergonomics (implemented)

**New tools (4):** `page_click_query`, `page_type_query`, `session_status`, `session_get`

**Extensions:**
- `page_wait`: `elementHidden`, `networkRequest` (+ optional `status`)
- `assert_*`: `negate?: boolean` on exists, text, url, network
- `browser_close`: returns `reportId` when persistence enabled

**Tool count:** 27 → **31**

### Wave 1.5 — Form & list helpers (deferred)

| Tool | Purpose |
|------|---------|
| `page_select` | Select `<option>` by value or label |
| `page_upload` | Set file input via local path |
| `session_list` | Paginated persisted sessions (wraps dashboard list) |

**Tool count:** 31 → **34**

### Wave 2 — Context & state (planned)

| Tool | Purpose |
|------|---------|
| `page_frame` | Switch iframe context for subsequent actions |
| `page_cookies` | Get/set cookies for auth shortcuts |

**Tool count:** 34 → **36** (trim or merge before ship if count exceeds 33 target)

**Target steady state:** ~32–33 tools after Wave 1.5 consolidation review.

---

## Per-tool specifications

### `page_click_query` — P0 ✅

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pageId` | uuid | yes | Active page |
| `query` | string | yes | Find text (text, role, aria-label) |
| `preferRegion` | string | no | Boost region hint (`toolbar`, `filter`, `grid-header`, `grid-body`) |
| `preferRole` | string | no | Boost ARIA role match |
| `candidateIndex` | int ≥0 | no | Pick Nth ranked match (default 0) |

**Returns:** `{ clicked, elementId, query, matchCount, selectedReason? }`

**Handler:** `src/domain/actions/click-query.ts` → `resolveFindMatch` + `clickElement`

---

### `page_type_query` — P0 ✅

Same disambiguation as `page_click_query`, plus:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | string | yes | Text to type |
| `append` | boolean | no | Append instead of replace |
| `delay` | int | no | Per-keystroke delay ms |

**Returns:** `{ typed, elementId, value, query, matchCount, selectedReason? }`

**Handler:** `src/domain/actions/type-query.ts`

---

### `session_status` — P0 ✅

| Field | Type | Required |
|-------|------|----------|
| `browserId` | uuid | yes |

**Returns:** `{ browserId, alive, crashed, recording, eventCount, pages[] }`

**Handler:** `src/domain/recording/session-status.ts`

---

### `session_get` — P0 ✅

| Field | Type | Required |
|-------|------|----------|
| `reportId` | uuid | one of |
| `sessionId` | uuid | one of |

**Returns:** `SessionDetailResponse` (report + events) from dashboard queries.

**Handler:** `src/domain/recording/session-get.ts`

---

### `page_wait` extensions — P0 ✅

New `condition` values:

| Condition | Required fields | Behavior |
|-----------|-----------------|----------|
| `elementHidden` | `query` | Poll until no visible match |
| `networkRequest` | `value` (URL substring) | Poll until matching request; optional `status` (default `2xx`) |

---

### Assert `negate` — P0 ✅

All four assert tools accept `negate?: boolean` (default `false`). When `true`, pass on absence / non-match.

---

### `browser_close` `reportId` — P0 ✅

**Returns:** `{ closed: true, reportId?: string }` — `reportId` present when `PERSIST_RECORDING` flush succeeds.

---

### Wave 1.5 (deferred)

#### `page_select` — P1

Select `<option>` in `<select>` by `value` or visible label. Schema: `pageId`, `elementId` or `query`, `value`, optional `by: 'value' | 'label'`.

#### `page_upload` — P1

Set file on `<input type="file">`. Schema: `pageId`, `elementId` or `query`, `filePath` (server-local).

#### `session_list` — P1

Paginated list wrapping `listSessions`. Schema: `page`, `limit`, `status`, `search`, `persistence`.

---

### Wave 2 (planned)

#### `page_frame` — P2

Switch to iframe by index, name, or URL. Subsequent element queries scoped to frame.

#### `page_cookies` — P2

`get` / `set` / `clear` cookies for auth seeding without full login replay.

---

## Implementation map

| Layer | Files |
|-------|-------|
| Find+disambiguation | `src/domain/elements/resolve-find-match.ts` |
| Query actions | `src/domain/actions/click-query.ts`, `type-query.ts` |
| Session | `src/domain/recording/session-status.ts`, `session-get.ts` |
| MCP schemas | `src/mcp/schemas/tools.ts` |
| Registration | `src/mcp/register-tools.ts` |
| Tests | `tests/unit/query-actions.test.ts`, `session-status.test.ts`, `session-get.test.ts`, `close-browser-report.test.ts` |
| Docs | `docs/guides/mcp-tools-reference.md` |

---

## Tool inventory

| Wave | Implemented | Deferred | Total |
|------|-------------|----------|-------|
| V1 baseline | 27 | — | 27 |
| Wave 1 | 4 new + 3 extensions | — | **31** |
| Wave 1.5 | — | 3 | 34 |
| Wave 2 | — | 2 | 36 |

**v1.3 target:** consolidate to **32–33** after Wave 1.5 review (may merge `session_get` events into lighter variant or drop `page_cookies` if redundant).
