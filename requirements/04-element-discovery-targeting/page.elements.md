# `page.elements`

> **Module:** `04-element-discovery-targeting`  
> **MCP Command:** `page.elements`  
> **Depends on:** [01-core-architecture/types.md](../01-core-architecture/types.md), [03-page-session-management/REQUIREMENTS.md](../03-page-session-management/REQUIREMENTS.md), [13-cdp-integration/REQUIREMENTS.md](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [05-user-actions](../05-user-actions/REQUIREMENTS.md), [08-waiting-synchronization](../08-waiting-synchronization/REQUIREMENTS.md), [09-assertions](../09-assertions/REQUIREMENTS.md)

## Overview / Purpose

List all visible interactive elements on a page. Agents call this command to understand what can be clicked, typed into, or otherwise interacted with before issuing user actions. Returns AI-friendly element descriptors with stable `elementId` references scoped to the page.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-04-001 | The system SHALL provide `page.elements` to return all visible interactive elements on a page. |
| FR-04-003 | Interactive elements SHALL include: buttons, links, inputs, textareas, selects, checkboxes, radios, and elements with `role` attribute or click handlers. |
| FR-04-004 | Each discovered element SHALL be assigned a unique `elementId` scoped to the `pageId`. |
| FR-04-005 | `page.elements` SHALL return only elements where `visible: true` by default; optional `includeHidden: true` to include hidden elements. |
| FR-04-008 | Element IDs SHALL be invalidated on page navigation, reload, or explicit invalidation. |
| FR-04-009 | Operations referencing an invalidated `elementId` SHALL return `ELEMENT_NOT_FOUND`. |
| FR-04-010 | `page.elements` SHALL limit results to 200 elements; if more exist, include `truncated: true` in response. |
| FR-04-011 | Element `text` field SHALL be truncated to 200 characters with ellipsis. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-04-001 | `page.elements` SHALL complete within 1 second for pages with up to 500 DOM nodes. |
| NFR-04-003 | Element discovery SHALL use CDP Accessibility tree and DOM snapshot for reliable targeting. |

---

## Data Models / Types

### Element

Uses the shared `Element` type from [01-core-architecture/types.md](../01-core-architecture/types.md):

```typescript
interface Element {
  elementId: string;       // UUID v4, scoped to pageId
  role: string;            // ARIA role or inferred role (button, link, textbox, etc.)
  text: string;            // visible text or accessible name (truncated to 200 chars)
  visible: boolean;        // computed visibility
  tag?: string;            // HTML tag name (optional enrichment)
}
```

### ElementsResult

```typescript
interface ElementsResult {
  elements: Element[];
  count: number;
  truncated?: boolean;     // true when more than 200 interactive elements exist
}
```

---

## MCP Command Spec

### `page.elements`

**Description:** List visible interactive elements on the page. Use this to understand what can be clicked or typed into.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" },
    "includeHidden": { "type": "boolean", "default": false }
  },
  "required": ["pageId"],
  "additionalProperties": false
}
```

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "elements": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "elementId": { "type": "string", "format": "uuid" },
          "role": { "type": "string" },
          "text": { "type": "string" },
          "visible": { "type": "boolean" },
          "tag": { "type": "string" }
        },
        "required": ["elementId", "role", "text", "visible"]
      }
    },
    "count": { "type": "integer" },
    "truncated": { "type": "boolean" }
  },
  "required": ["elements", "count"]
}
```

**Success Response Example:**

```json
{
  "ok": true,
  "data": {
    "elements": [
      {
        "elementId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "role": "textbox",
        "text": "Email",
        "visible": true,
        "tag": "input"
      },
      {
        "elementId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "role": "button",
        "text": "Submit",
        "visible": true,
        "tag": "button"
      }
    ],
    "count": 2
  }
}
```

**Error Cases:**

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found in session registry |
| `INTERNAL_ERROR` | CDP accessibility or DOM query failed unexpectedly |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-04-001 | `page.elements` on a login form page returns input fields and submit button. |
| AC-04-004 | After `page.reload`, previous `elementId` references return `ELEMENT_NOT_FOUND`. |
| AC-04-005 | Hidden elements are excluded by default; included when `includeHidden: true`. |
| AC-04-006 | Pages with >200 interactive elements return `truncated: true`. |
| AC-04-007 | Element `text` values longer than 200 characters are truncated with ellipsis. |
| AC-04-008 | Each returned element has a unique `elementId` within the `pageId` scope. |

---

## Dependencies on Other Modules

| Module / Feature | Dependency |
|------------------|------------|
| [01-core-architecture/types.md](../01-core-architecture/types.md) | `Element` type, element registry per page |
| [01-core-architecture/error-model.md](../01-core-architecture/error-model.md) | `SESSION_NOT_FOUND` error envelope |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | Valid `pageId` required; element IDs invalidated on navigation/reload |
| [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md) | `Accessibility.getFullAXTree`, `DOM.getDocument` for element enumeration |

---

## Out of Scope (V2)

- CSS/XPath selector-based enumeration
- Shadow DOM piercing as first-class API
- Element relationship queries (parent, sibling, nth-child)
- Visual/coordinate-based element targeting
- Accessibility audit scoring
- AI self-healing selectors (re-resolve stale elements automatically)
