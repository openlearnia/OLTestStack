# `page.find`

> **Module:** `04-element-discovery-targeting`  
> **MCP Command:** `page.find`  
> **Depends on:** [01-core-architecture/types.md](../01-core-architecture/types.md), [03-page-session-management/REQUIREMENTS.md](../03-page-session-management/REQUIREMENTS.md), [13-cdp-integration/REQUIREMENTS.md](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [05-user-actions](../05-user-actions/REQUIREMENTS.md), [08-waiting-synchronization](../08-waiting-synchronization/REQUIREMENTS.md), [09-assertions](../09-assertions/REQUIREMENTS.md)

## Overview / Purpose

Locate a single interactive element on a page using a text query. Matches against element `text`, `role`, and `aria-label` (case-insensitive, partial match). Returns the best match with a `matchCount` when multiple elements qualify. Use this when the agent knows what to interact with but not the `elementId`.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-04-002 | The system SHALL provide `page.find` to locate a single element matching a text query. |
| FR-04-004 | Each discovered element SHALL be assigned a unique `elementId` scoped to the `pageId`. |
| FR-04-006 | `page.find` query SHALL match against element `text`, `role`, and `aria-label` (case-insensitive, partial match). |
| FR-04-007 | `page.find` SHALL return the best match when multiple elements match; if ambiguous, return the first visible match with a `matchCount` field. |
| FR-04-008 | Element IDs SHALL be invalidated on page navigation, reload, or explicit invalidation. |
| FR-04-009 | Operations referencing an invalidated `elementId` SHALL return `ELEMENT_NOT_FOUND`. |
| FR-04-011 | Element `text` field SHALL be truncated to 200 characters with ellipsis. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-04-002 | `page.find` SHALL complete within 500 ms. |
| NFR-04-003 | Element discovery SHALL use CDP Accessibility tree and DOM snapshot for reliable targeting. |

---

## Data Models / Types

### Element

Uses the shared `Element` type from [01-core-architecture/types.md](../01-core-architecture/types.md):

```typescript
interface Element {
  elementId: string;       // UUID v4, scoped to pageId
  role: string;
  text: string;            // truncated to 200 chars with ellipsis
  visible: boolean;
  tag?: string;
  bounds?: { x: number; y: number; width: number; height: number };
}
```

### FindResult

```typescript
interface FindResult {
  element: Element;
  matchCount: number;      // total matches found (minimum 1 on success)
}
```

---

## MCP Command Spec

### `page.find`

**Description:** Find a single interactive element by text query (matches visible text, role, or aria-label).

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "query": { "type": "string", "minLength": 1 }
  },
  "required": ["pageId", "query"],
  "additionalProperties": false
}
```

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "element": {
      "type": "object",
      "properties": {
        "elementId": { "type": "string", "format": "uuid" },
        "role": { "type": "string" },
        "text": { "type": "string" },
        "visible": { "type": "boolean" },
        "tag": { "type": "string" }
      },
      "required": ["elementId", "role", "text", "visible"]
    },
    "matchCount": { "type": "integer", "minimum": 1 }
  },
  "required": ["element", "matchCount"]
}
```

**Success Response Example:**

```json
{
  "ok": true,
  "data": {
    "element": {
      "elementId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "role": "button",
      "text": "Submit",
      "visible": true,
      "tag": "button"
    },
    "matchCount": 1
  }
}
```

**Error Cases:**

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found in session registry |
| `ELEMENT_NOT_FOUND` | No element matches query |
| `INVALID_INPUT` | Empty query string |

**Error Response Example:**

```json
{
  "ok": false,
  "error": {
    "code": "ELEMENT_NOT_FOUND",
    "message": "No interactive element matches query 'Checkout'.",
    "details": { "pageId": "a1b2c3d4-...", "query": "Checkout" }
  }
}
```

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-04-002 | `page.find` with query "Submit" returns the submit button element. |
| AC-04-003 | `page.find` with nonexistent query returns `ELEMENT_NOT_FOUND`. |
| AC-04-004 | After `page.reload`, previous `elementId` references return `ELEMENT_NOT_FOUND`. |
| AC-04-009 | When multiple elements match, response includes `matchCount` > 1 and returns the first visible match. |
| AC-04-010 | Query matching is case-insensitive and supports partial matches on text, role, and aria-label. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [01-core-architecture/types.md](../01-core-architecture/types.md) | `Element` type, element registry per page |
| [01-core-architecture/error-model.md](../01-core-architecture/error-model.md) | `SESSION_NOT_FOUND`, `ELEMENT_NOT_FOUND` error envelope |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | Valid `pageId` required; element IDs invalidated on navigation/reload |
| [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md) | `Accessibility.getFullAXTree`, `DOM.getDocument` for element lookup |

---

## Out of Scope (V2)

- AI self-healing selectors (re-resolve stale elements automatically)
- CSS/XPath selector-based find (`page.findBySelector`)
- Shadow DOM piercing as first-class API
- Element relationship queries (parent, sibling, nth-child)
- Visual/coordinate-based element targeting
- Accessibility audit scoring
