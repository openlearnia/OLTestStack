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
| `browserId` | `browser_launch` |
| `pageId` | `page_create` |
| `elementId` | `page_find` or `page_elements` |

Re-discover elements after every `page_navigate` or `page_reload` — stale IDs cause `ELEMENT_NOT_FOUND`.

## Setup

```text
browser_launch → page_create → page_navigate (app base URL) → page_elements
```

Use `page_elements` to map the list view (table rows, cards, action buttons).

## Create

1. `page_find` "Add" or "New" → `page_click`
2. `page_find` + `page_type` for each form field
3. `page_find` "Save" → `page_click`
4. `page_wait` — `networkIdle` or URL change
5. Verify: `page_find` with created item name (or `page_text` until `assert.text` lands in Phase 9)
6. `page_network` with `filter: "/api/"` — confirm 2xx responses
7. `page_screenshot` for evidence

## Read

1. `page_navigate` or `page_reload` to list view
2. `page_find` with item name — confirm row/card exists
3. `page_screenshot` for evidence

## Update

1. `page_find` item name → click edit action via `page_click`
2. `page_type` into changed fields (re-discover after navigation to edit view)
3. `page_find` "Save" → `page_click`
4. `page_wait` (`networkIdle`)
5. Verify updated text via `page_find` or `page_text`

## Delete

1. `page_find` item → click delete via `page_click`
2. Confirm dialog: `page_find` "Confirm" → `page_click`
3. Verify absence: `page_find` should return `ELEMENT_NOT_FOUND`, or check `page_text`

## Teardown

Always `browser_close` with `{ "browserId": "<browserId>" }` in a finally block.

When `PERSIST_RECORDING=true`, reports flush to PostgreSQL on close.

## Discovery tips

| Situation | Tool |
|-----------|------|
| Unfamiliar list layout | `page_elements` |
| Known button labels | `page_find` ("Delete", "Edit", "Save") |
| After navigation | Re-run `page_elements` or `page_find` |
| Off-screen items | `page_scroll` then re-discover |
| Ambiguous matches (`matchCount > 1`) | `page_elements` to disambiguate |

## Monitoring

After create/update/delete:

```json
{ "pageId": "<pageId>", "filter": "/api/items" }
{ "pageId": "<pageId>", "level": "error" }
```

Check `errorCount` in network/console responses.

## Current limitations

`assert.*` and `test.run` are **not yet implemented**. Validate outcomes with:

- `page_wait` (URL or `networkIdle`)
- `page_text` / `page_snapshot` for content checks
- `page_find` (expect `ELEMENT_NOT_FOUND` when item should be gone)
- `page_network` / `page_console` for API and JS errors

## Error recovery

| Error | Action |
|-------|--------|
| `SESSION_NOT_FOUND` | Re-launch browser and create page |
| `ELEMENT_NOT_FOUND` | `page_elements` → refine query |
| `TIMEOUT` on wait | Increase `timeoutMs` or change condition |
| `BROWSER_CRASHED` | New `browser_launch` |

## Related docs

- [Agent Workflows](../../../docs/guides/agent-workflows.md)
- [MCP Tools Reference](../../../docs/guides/mcp-tools-reference.md)
