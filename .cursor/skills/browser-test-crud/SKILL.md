---
name: browser-test-crud
description: >-
  Tests CRUD operations (create, read, update, delete) on web apps using
  OLTestStack MCP tools. Use for admin panels, item lists, data tables, or
  resource management flows. Requires olteststack MCP server connected.
disable-model-invocation: true
---

# Browser Test — CRUD Flow

## Prerequisites

- OLTestStack MCP server connected (19 implemented tools)
- App base URL with list and create/edit views
- Unique test data identifiers (item name, SKU, etc.)

## Stateless ID pattern

| ID | Source |
|----|--------|
| `browserId` | `browser.launch` |
| `pageId` | `page.create` |
| `elementId` | `page.find` or `page.elements` |

Re-discover elements after every `page.navigate` or `page.reload` — stale IDs cause `ELEMENT_NOT_FOUND`.

## Setup

```text
browser.launch → page.create → page.navigate (app base URL) → page.elements
```

Use `page.elements` to map the list view (table rows, cards, action buttons).

## Create

1. `page.find` "Add" or "New" → `page.click`
2. `page.find` + `page.type` for each form field
3. `page.find` "Save" → `page.click`
4. `page.wait` — `networkIdle` or URL change
5. Verify: `page.find` with created item name (or `page.text` until `assert.text` lands in Phase 9)
6. `page.network` with `filter: "/api/"` — confirm 2xx responses
7. `page.screenshot` for evidence

## Read

1. `page.navigate` or `page.reload` to list view
2. `page.find` with item name — confirm row/card exists
3. `page.screenshot` for evidence

## Update

1. `page.find` item name → click edit action via `page.click`
2. `page.type` into changed fields (re-discover after navigation to edit view)
3. `page.find` "Save" → `page.click`
4. `page.wait` (`networkIdle`)
5. Verify updated text via `page.find` or `page.text`

## Delete

1. `page.find` item → click delete via `page.click`
2. Confirm dialog: `page.find` "Confirm" → `page.click`
3. Verify absence: `page.find` should return `ELEMENT_NOT_FOUND`, or check `page.text`

## Teardown

Always `browser.close` with `{ "browserId": "<browserId>" }` in a finally block.

When `PERSIST_RECORDING=true`, reports flush to PostgreSQL on close.

## Discovery tips

| Situation | Tool |
|-----------|------|
| Unfamiliar list layout | `page.elements` |
| Known button labels | `page.find` ("Delete", "Edit", "Save") |
| After navigation | Re-run `page.elements` or `page.find` |
| Off-screen items | `page.scroll` then re-discover |
| Ambiguous matches (`matchCount > 1`) | `page.elements` to disambiguate |

## Monitoring

After create/update/delete:

```json
{ "pageId": "<pageId>", "filter": "/api/items" }
{ "pageId": "<pageId>", "level": "error" }
```

Check `errorCount` in network/console responses.

## Current limitations

`assert.*` and `test.run` are **not yet implemented**. Validate outcomes with:

- `page.wait` (URL or `networkIdle`)
- `page.text` / `page.snapshot` for content checks
- `page.find` (expect `ELEMENT_NOT_FOUND` when item should be gone)
- `page.network` / `page.console` for API and JS errors

## Error recovery

| Error | Action |
|-------|--------|
| `SESSION_NOT_FOUND` | Re-launch browser and create page |
| `ELEMENT_NOT_FOUND` | `page.elements` → refine query |
| `TIMEOUT` on wait | Increase `timeoutMs` or change condition |
| `BROWSER_CRASHED` | New `browser.launch` |

## Related docs

- [Agent Workflows](../../../docs/guides/agent-workflows.md)
- [MCP Tools Reference](../../../docs/guides/mcp-tools-reference.md)
