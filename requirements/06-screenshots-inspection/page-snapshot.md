# Feature: `page.snapshot`

> **Module:** [06-screenshots-inspection](./REQUIREMENTS.md)  
> **MCP Command:** `page.snapshot`

## Overview

Return a comprehensive summary of the current page state including URL, title, DOM statistics, and a list of interactive elements. Gives AI agents structured situational awareness without requiring separate calls for metadata and element discovery.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-06-002 | The system SHALL provide `page.snapshot` to return a comprehensive page state summary. |
| FR-06-007 | `page.snapshot` SHALL return: `url`, `title`, `domSummary`, and `elements` (interactive element list). |
| FR-06-008 | `page.snapshot` `domSummary` SHALL include: node count, form count, link count, image count. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01-001 | MCP tool response latency for non-navigation commands SHALL be < 500 ms at p95 under local headless execution. |
| NFR-01-002 | The API surface SHALL be designed for LLM consumption: flat JSON objects, descriptive field names, minimal nesting. |

---

## Data Models / Types

### SnapshotResult

```typescript
interface SnapshotResult {
  url: string;
  title: string;
  domSummary: {
    nodeCount: number;
    formCount: number;
    linkCount: number;
    imageCount: number;
  };
  elements: Element[];    // from Element Discovery module
}
```

### Element (reference)

```typescript
interface Element {
  elementId: string;
  role: string;
  text: string;
  visible: boolean;
}
```

---

## MCP Command Spec

### `page.snapshot`

**Description:** Get a comprehensive snapshot of the current page state including URL, title, DOM summary, and interactive elements.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "pageId": { "type": "string", "format": "uuid" }
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
    "url": { "type": "string" },
    "title": { "type": "string" },
    "domSummary": {
      "type": "object",
      "properties": {
        "nodeCount": { "type": "integer" },
        "formCount": { "type": "integer" },
        "linkCount": { "type": "integer" },
        "imageCount": { "type": "integer" }
      },
      "required": ["nodeCount", "formCount", "linkCount", "imageCount"]
    },
    "elements": { "type": "array" }
  },
  "required": ["url", "title", "domSummary", "elements"]
}
```

---

## Error Cases

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |
| `INTERNAL_ERROR` | DOM traversal or element discovery failed |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-06-003 | `page.snapshot` returns correct URL, title, and non-empty elements array. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model, shared `Element` type |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | Valid `pageId`, URL/title metadata |
| [04-element-discovery-targeting](../04-element-discovery-targeting/REQUIREMENTS.md) | Interactive element list for `elements` field |
| [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md) | DOM traversal for `domSummary` counts |

---

## Out of Scope (V2)

- Accessibility tree export as standalone command
- Snapshot diff / state comparison across calls
- Shadow DOM deep enumeration beyond interactive elements
