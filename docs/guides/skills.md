# Cursor Agent Skills for Browser Testing

Skills teach Cursor agents *how* to work; the OLTestStack MCP server gives them *hands* on Chromium. Together they produce repeatable, correct browser test flows.

## What skills are

A **skill** is a markdown file (`SKILL.md`) with YAML frontmatter that loads specialized instructions into an agent session. Skills excel at:

- Multi-step workflows (login test, CRUD sweep)
- Project-specific conventions (which MCP tools to call, in what order)
- Recovery patterns (what to do on `SESSION_NOT_FOUND`)
- Guardrails (always `browser.close`, never reuse stale IDs)

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
│  OLTestStack MCP    │  browser.launch, page.navigate, …
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
│       ├── browser-test-login/
│       │   └── SKILL.md
│       └── browser-test-crud/
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
5. **Cleanup** — always `browser.close`

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

- OLTestStack MCP server connected (all 19 tools through Phase 8)
- Target login URL (or `fixtures/sample-app/index.html` for local demo)

## Workflow

1. **Launch** — `browser.launch` with `{ "headless": true }`. Store `browserId`.

2. **Create page** — `page.create` with `{ "browserId": "<browserId>" }`. Store `pageId`.

3. **Navigate** — `page.navigate` with `{ "pageId": "<pageId>", "url": "<login-url>" }`.
   Use a fully qualified URL (`https://` or `file://`).

4. **Discover fields** — Call `page.find` for each control:
   - `{ "pageId": "<pageId>", "query": "Email" }` (or "Username")
   - `{ "pageId": "<pageId>", "query": "Password" }`
   - `{ "pageId": "<pageId>", "query": "Submit" }` (or "Sign in", "Log in")
   Store each `elementId`.

   If `page.find` returns `ELEMENT_NOT_FOUND`, call `page.elements` and pick controls by role (`textbox`, `button`).

5. **Interact** — Fill and submit the form:
   - `page.type` with `{ "pageId": "<pageId>", "elementId": "<email elementId>", "value": "user@example.com" }`
   - `page.type` with `{ "pageId": "<pageId>", "elementId": "<password elementId>", "value": "secret" }`
   - `page.click` with `{ "pageId": "<pageId>", "elementId": "<submit elementId>" }`

6. **Synchronize** — `page.wait` after submit:
   - `{ "pageId": "<pageId>", "condition": "networkIdle" }` or URL condition for redirect

7. **Verify** (when assertion tools are available in Phase 9):
   - `assert.url` for expected post-login path
   - `assert.text` for welcome message

   **Today:** use `page.wait` with a URL condition, or `page.text` / `page.snapshot` to confirm expected content.

8. **Evidence** — `page.screenshot` with `{ "pageId": "<pageId>" }`. Optionally `page.console` with `{ "level": "error" }`.

9. **Cleanup** — Always call `browser.close` with `{ "browserId": "<browserId>" }` in a finally block.

## Error recovery

| Error | Action |
|-------|--------|
| `SESSION_NOT_FOUND` | Re-launch browser and create page |
| `ELEMENT_NOT_FOUND` | `page.elements` then retry find with role/text |
| `TIMEOUT` on navigate | Increase `timeoutMs` or use `waitUntil: "domcontentloaded"` |
| `BROWSER_CRASHED` | New `browser.launch`; discard old IDs |

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

1. `browser.launch` → `page.create` → `page.navigate` (app base URL)
2. `page.elements` — map the list view (table, cards, action buttons)

### Create

1. `page.find` "Add" or "New" → `page.click`
2. Fill form fields via `page.find` + `page.type`
3. `page.find` "Save" → `page.click`
4. `page.wait` for network idle or URL change
5. `assert.text` with created item name (Phase 9+) — or `page.find` / `page.text` today

### Read

1. `page.navigate` or reload list view
2. `page.find` with item name — confirm row/card exists
3. `page.screenshot` for evidence

### Update

1. `page.find` item name → click edit action via `page.click`
2. `page.type` into changed fields
3. Submit via `page.click` and verify with `page.text` or `assert.text` (Phase 9+)

### Delete

1. `page.find` item → click delete via `page.click`
2. Confirm dialog via `page.find` "Confirm" + `page.click`
3. Verify item absent via `page.find` (expect `ELEMENT_NOT_FOUND`) or `assert.text` (Phase 9+)

### Teardown

- `browser.close` always
- If `PERSIST_RECORDING=true`, report flushes to Postgres on close

## Discovery tips

- Use `page.elements` on unfamiliar list layouts
- Use `page.find` for known button labels ("Delete", "Edit", "Save")
- After any navigation, rediscover elements — IDs invalidate on `page.navigate`

## Monitoring

After create/update/delete, check:
- `page.network` — verify API returned 2xx
- `page.console` — ensure no `error` level messages

## Current limitations

Assertion tools (`assert.*`) and `test.run` orchestration are not yet implemented. Today, validate outcomes with:
- `page.wait` (URL or network idle conditions)
- `page.text` / `page.snapshot` for content checks
- `page.find` (expect `ELEMENT_NOT_FOUND` when item should be gone)
- `page.network` / `page.console` for API and JS error checks
```

---

## Project skills (`.cursor/skills/`)

This repository ships ready-to-use project skills:

| Skill | Path | Use for |
|-------|------|---------|
| `browser-test-login` | [`.cursor/skills/browser-test-login/SKILL.md`](../../.cursor/skills/browser-test-login/SKILL.md) | Login, sign-in, authentication flows |
| `browser-test-crud` | [`.cursor/skills/browser-test-crud/SKILL.md`](../../.cursor/skills/browser-test-crud/SKILL.md) | Create, read, update, delete app testing |
| `olteststack-mcp` | [`.cursor/skills/olteststack-mcp/SKILL.md`](../../.cursor/skills/olteststack-mcp/SKILL.md) | General MCP server reference and tool catalog |

All three set `disable-model-invocation: true` — reference them explicitly in chat or via `@` skill attachment.

## Invoking skills in Cursor

1. Skills live in `.cursor/skills/<name>/SKILL.md` (see table above)
2. In chat, reference the task: *"Use the browser-test-login skill to test the login page at …"*
3. Or `@` mention the skill if your Cursor version supports skill attachment

The agent loads the skill instructions, then calls OLTestStack MCP tools per the workflow.

## Tips for effective browser testing skills

1. **Name tools exactly** — `page.navigate`, not "go to URL"
2. **Show JSON shapes** — agents parse examples reliably
3. **Document phase gaps** — note which steps use `assert.*` vs `page.text`/`page.wait` today
4. **Mandate cleanup** — `browser.close` in every skill
5. **Link to guides** — point to `docs/guides/mcp-tools-reference.md` for schemas

## Related guides

- [Agent Workflows](./agent-workflows.md)
- [MCP Tools Reference](./mcp-tools-reference.md)
- [MCP Server Setup](./mcp-server-setup.md)
