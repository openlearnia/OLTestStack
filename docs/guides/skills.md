# Cursor Agent Skills for Browser Testing

Skills teach Cursor agents *how* to work; the OLTestStack MCP server gives them *hands* on Chromium. Together they produce repeatable, correct browser test flows.

## What skills are

A **skill** is a markdown file (`SKILL.md`) with YAML frontmatter that loads specialized instructions into an agent session. Skills excel at:

- Multi-step workflows (login test, CRUD sweep)
- Project-specific conventions (which MCP tools to call, in what order)
- Recovery patterns (what to do on `SESSION_NOT_FOUND`)
- Guardrails (always `browser_close`, never reuse stale IDs)

Skills do **not** execute browser commands themselves — the agent still calls MCP tools.

## When to use skills with OLTestStack

| Scenario | Use a skill? |
|----------|--------------|
| One-off "open example.com" | No — direct MCP calls are enough |
| Repeated login regression | Yes — `browser-test-login` skill |
| CRUD app test template | Yes — `browser-test-crud` skill |
| Onboarding new team members | Yes — project skill in `.cursor/skills/` |
| CI/CD automation | Consider SDK/scripts; skills are IDE-focused |

## How skills + MCP tools work together

```text
┌─────────────────────┐
│  Cursor Agent       │
│  (reads skill)      │
└──────────┬──────────┘
           │ follows workflow steps
           ▼
┌─────────────────────┐
│  OLTestStack MCP    │  browser_launch, page_navigate, …
│  (stdio server)     │
└──────────┬──────────┘
           │ Puppeteer / CDP
           ▼
┌─────────────────────┐
│  Chromium           │
└─────────────────────┘
```

- **Skill** → workflow, ordering, error recovery, what to assert
- **MCP tools** → actual browser execution and structured responses

## Where to place skills

| Location | Scope | Path |
|----------|-------|------|
| Project | Shared with repo collaborators | `.cursor/skills/<skill-name>/SKILL.md` |
| Personal | All your projects | `~/.cursor/skills/<skill-name>/SKILL.md` |

Do **not** create skills in `~/.cursor/skills-cursor/` — that directory is reserved for Cursor built-ins.

For authoring conventions, see the [create-skill](https://github.com/cursor/skills-cursor) patterns in Cursor's skill documentation.

### Recommended layout for this project

```
OLTestStack/
├── .cursor/
│   ├── mcp.json                    # MCP server config
│   └── skills/
│       ├── olteststack-mcp/
│       │   └── SKILL.md
│       ├── browser-test-login/
│       │   └── SKILL.md
│       ├── browser-test-crud/
│       │   └── SKILL.md
│       └── session-record-export/
│           └── SKILL.md
└── docs/guides/
    └── skills.md                   # this file
```

## Creating a browser testing skill

Every skill needs:

1. **Frontmatter** — `name` and `description` (used for discovery)
2. **Prerequisites** — MCP server connected, which tools are available
3. **Step-by-step workflow** — explicit tool names and parameter patterns
4. **Error recovery** — mapped to OLTestStack error codes
5. **Cleanup** — always `browser_close`

Set `disable-model-invocation: true` in frontmatter if the skill should only load when explicitly referenced.

---

## Example: `browser-test-login`

Save as `.cursor/skills/browser-test-login/SKILL.md`:

```markdown
---
name: browser-test-login
description: >-
  Test a login form using OLTestStack MCP tools. Use when asked to verify
  login, sign-in, or authentication flows. Requires olteststack MCP server.
disable-model-invocation: true
---

# Browser Test — Login Flow

## Prerequisites

- OLTestStack MCP server connected (all **38** tools)
- Target login URL (or `fixtures/sample-app/index.html` for local demo)

## Workflow

1. **Launch** — `browser_launch` with `{ "headless": true }`. Store `browserId`.

2. **Create page** — `page_create` with `{ "browserId": "<browserId>" }`. Store `pageId`.

3. **Navigate** — `page_navigate` with `{ "pageId": "<pageId>", "url": "<login-url>" }`.
   Use a fully qualified URL (`https://` or `file://`).

4. **Discover fields** — Call `page_find` for each control:
   - `{ "pageId": "<pageId>", "query": "Email" }` (or "Username")
   - `{ "pageId": "<pageId>", "query": "Password" }`
   - `{ "pageId": "<pageId>", "query": "Submit" }` (or "Sign in", "Log in")
   Store each `elementId`.

   If `page_find` returns `ELEMENT_NOT_FOUND`, call `page_elements` and pick controls by role (`textbox`, `button`).

5. **Interact** — Fill and submit the form:
   - `page_type_query` with `{ "pageId": "<pageId>", "query": "Email", "value": "user@example.com" }`
   - `page_type_query` with `{ "pageId": "<pageId>", "query": "Password", "value": "secret" }`
   - `page_click_query` with `{ "pageId": "<pageId>", "query": "Submit" }`

   Or by elementId (pass `query` from `page_find` for replayable recordings):
   - `page_type` with `{ "pageId": "<pageId>", "elementId": "<email elementId>", "value": "user@example.com", "query": "Email" }`
   - `page_type` with `{ "pageId": "<pageId>", "elementId": "<password elementId>", "value": "secret", "query": "Password" }`
   - `page_click` with `{ "pageId": "<pageId>", "elementId": "<submit elementId>", "query": "Submit" }`

6. **Synchronize** — `page_wait` after submit:
   - `{ "pageId": "<pageId>", "condition": "networkIdle" }` or URL condition for redirect

7. **Verify** — use `assert_url` / `assert_text` / `assert_exists`, or `page_wait` with a URL condition, or `page_text` / `page_snapshot` to confirm expected content.

8. **Evidence** — `page_screenshot` with `{ "pageId": "<pageId>" }` — returns `data.url` when health server is up; set `returnInline: true` for MCP inline image. Optionally `page_console` with `{ "level": "error" }`.

9. **Cleanup** — Always call `browser_close` with `{ "browserId": "<browserId>" }` in a finally block. Capture `reportId` when persistence is enabled.

## Error recovery

| Error | Action |
|-------|--------|
| `SESSION_NOT_FOUND` | Re-launch browser and create page |
| `ELEMENT_NOT_FOUND` | `page_elements` then retry find with role/text |
| `TIMEOUT` on navigate | Increase `timeoutMs` or use `waitUntil: "domcontentloaded"` |
| `BROWSER_CRASHED` | New `browser_launch`; discard old IDs |

## Sample credentials (local fixture only)

For `fixtures/sample-app/index.html`, any email/password works — the form is static HTML with no backend.
```

---

## Example: `browser-test-crud`

Save as `.cursor/skills/browser-test-crud/SKILL.md`:

```markdown
---
name: browser-test-crud
description: >-
  Test CRUD operations (create, read, update, delete) on a web app using
  OLTestStack MCP tools. Use for admin panels, item lists, or data tables.
disable-model-invocation: true
---

# Browser Test — CRUD Flow

## Prerequisites

- OLTestStack MCP server connected
- App URL with list and create/edit views
- Test data identifiers (item name, SKU, etc.)

## Workflow

### Setup

1. `browser_launch` → `page_create` → `page_navigate` (app base URL)
2. `page_elements` — map the list view (table, cards, action buttons)

### Create

1. `page_click_query` "Add" or "New" (or `page_find` → `page_click`)
2. Fill form fields via `page_type_query` or `page_find` + `page_type`
3. `page_click_query` "Save"
4. `page_wait` for network idle or URL change
5. `assert_text` with created item name — or `page_find` / `page_text`

### Read

1. `page_navigate` or reload list view
2. `page_click_query` or `page_find` with item name — confirm row/card exists
3. `page_screenshot` for evidence

### Update

1. `page_click_query` item name with `preferRegion: "grid-body"` → edit action
2. `page_type_query` into changed fields
3. Submit via `page_click_query` and verify with `assert_text` or `page_text`

### Delete

1. `page_click_query` item → delete action
2. Confirm dialog via `page_click_query` "Confirm"
3. Verify item absent via `assert_exists` with `negate: true`, or `page_find` (expect `ELEMENT_NOT_FOUND`)

### Teardown

- `browser_close` always; capture `reportId` when persistence enabled
- Promote ephemeral sessions with `save_session` before 24h TTL expiry

## Discovery tips

- Use `page_elements` on unfamiliar list layouts
- Use `page_click_query` / `page_type_query` for grids (`preferRegion`: `toolbar`, `grid-body`, etc.)
- Use `page_find` for known button labels ("Delete", "Edit", "Save")
- After any navigation, rediscover elements — IDs invalidate on `page_navigate`

## Monitoring

After create/update/delete, check:
- `page_network` — verify API returned 2xx
- `page_console` — ensure no `error` level messages

## Assertions

Use `assert_exists`, `assert_text`, `assert_url`, `assert_network` (`negate`, `soft`), `page_assert_state`, and `test_run` for structured checks. For manual validation:
- `page_wait` (`element`, `elementHidden`, `url`, `networkIdle`, `networkRequest`)
- `page_text` / `page_snapshot` for content checks
- `page_find` (expect `ELEMENT_NOT_FOUND` when item should be gone)
- `page_network` / `page_console` for API and JS error checks
```

---

## Project skills (`.cursor/skills/`)

This repository ships ready-to-use project skills:

| Skill | Path | Use for |
|-------|------|---------|
| `browser-test-login` | [`.cursor/skills/browser-test-login/SKILL.md`](../../.cursor/skills/browser-test-login/SKILL.md) | Login, sign-in, authentication flows |
| `browser-test-crud` | [`.cursor/skills/browser-test-crud/SKILL.md`](../../.cursor/skills/browser-test-crud/SKILL.md) | Create, read, update, delete app testing |
| `session-record-export` | [`.cursor/skills/session-record-export/SKILL.md`](../../.cursor/skills/session-record-export/SKILL.md) | Record → export → replay with `session_export` and `test_run` |
| `olteststack-mcp` | [`.cursor/skills/olteststack-mcp/SKILL.md`](../../.cursor/skills/olteststack-mcp/SKILL.md) | General MCP server reference and tool catalog |

All four set `disable-model-invocation: true` — reference them explicitly in chat or via `@` skill attachment.

## Invoking skills in Cursor

1. Skills live in `.cursor/skills/<name>/SKILL.md` (see table above)
2. In chat, reference the task: *"Use the browser-test-login skill to test the login page at …"*
3. Or `@` mention the skill if your Cursor version supports skill attachment

The agent loads the skill instructions, then calls OLTestStack MCP tools per the workflow.

## Tips for effective browser testing skills

1. **Name tools exactly** — `page_navigate`, not "go to URL"
2. **Show JSON shapes** — agents parse examples reliably
3. **Document fallbacks** — note when steps use `assert_*` vs `page_text`/`page_wait`
4. **Mandate cleanup** — `browser_close` in every skill
5. **Link to guides** — point to `docs/guides/mcp-tools-reference.md` for schemas

## Related guides

- [Agent Workflows](./agent-workflows.md)
- [MCP Tools Reference](./mcp-tools-reference.md)
- [MCP Server Setup](./mcp-server-setup.md)
