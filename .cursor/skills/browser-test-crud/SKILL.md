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

- OLTestStack MCP server connected (**38** tools)
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

## Grids and data tables

Prefer **`page_click_query`** / **`page_type_query`** over find+click for grid cells and toolbar actions:

```json
{ "pageId": "<pageId>", "query": "Add", "preferRegion": "toolbar" }
{ "pageId": "<pageId>", "query": "Item Name", "value": "Widget-42", "preferRegion": "grid-body" }
```

`preferRegion`: `toolbar`, `filter`, `grid-header`, `grid-body`.

## Create

1. `page_click_query` "Add" or "New" (or `page_find` → `page_click`)
2. `page_type_query` or `page_find` + `page_type` for each form field
3. `page_click_query` "Save" → click
4. `page_wait` — `networkIdle`, `networkRequest`, or URL change
5. Verify: `assert_text` or `page_find` with created item name
6. `page_network` with `filter: "/api/"` — confirm 2xx responses
7. `page_screenshot` for evidence (`data.url` when health server up)

## Read

1. `page_navigate` or `page_reload` to list view
2. `page_click_query` or `page_find` with item name — confirm row/card exists
3. `page_screenshot` for evidence

## Update

1. `page_click_query` item name with `preferRegion: "grid-body"` → click edit action
2. `page_type_query` into changed fields (re-discover after navigation to edit view)
3. `page_click_query` "Save"
4. `page_wait` (`networkIdle`)
5. Verify updated text via `assert_text`, `page_find`, or `page_text`

## Delete

1. `page_click_query` item → click delete
2. Confirm dialog: `page_click_query` "Confirm"
3. Verify absence: `assert_exists` with `negate: true`, or `page_find` returns `ELEMENT_NOT_FOUND`

## Teardown

Always `browser_close` with `{ "browserId": "<browserId>" }` in a finally block.

When persistence is enabled, `browser_close` returns `reportId`. Reports flush to PostgreSQL; unsaved sessions expire after 24h unless promoted via `save_session`.

## Discovery tips

| Situation | Tool |
|-----------|------|
| Unfamiliar list layout | `page_elements` |
| Known button labels | `page_click_query` or `page_find` |
| Data grid cells | `page_click_query` / `page_type_query` + `preferRegion` |
| After navigation | Re-run `page_elements` or query tools |
| Off-screen items | `page_scroll` then re-discover |
| Ambiguous matches (`matchCount > 1`) | `page_elements` or `preferRegion` / `candidateIndex` |

## Monitoring

After create/update/delete:

```json
{ "pageId": "<pageId>", "filter": "/api/items" }
{ "pageId": "<pageId>", "level": "error" }
```

Check `errorCount` in network/console responses.

## Error recovery

| Error | Action |
|-------|--------|
| `SESSION_NOT_FOUND` | Re-launch browser and create page |
| `ELEMENT_NOT_FOUND` | `page_elements` → refine query or use `preferRegion` |
| `TIMEOUT` on wait | Increase `timeoutMs` or change condition |
| `BROWSER_CRASHED` | New `browser_launch` |

## Related docs

- [Agent Workflows](../../../docs/guides/agent-workflows.md)
- [MCP Tools Reference](../../../docs/guides/mcp-tools-reference.md)
