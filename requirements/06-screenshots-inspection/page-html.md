# Feature: `page.html`

> **Module:** [06-screenshots-inspection](./REQUIREMENTS.md)  
> **MCP Command:** `page.html`

## Overview

Extract the full outer HTML of the current document. Enables AI agents to inspect page structure, attributes, and markup. Output is truncated at 500,000 characters with an explicit flag when exceeded.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-06-004 | The system SHALL provide `page.html` to extract the full page HTML. |
| FR-06-011 | `page.html` SHALL return the outer HTML of the document; truncate at 500,000 characters with flag. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01-001 | MCP tool response latency for non-navigation commands SHALL be < 500 ms at p95 under local headless execution. |

---

## Data Models / Types

### HtmlResult

```typescript
interface HtmlResult {
  html: string;
  length: number;
  truncated?: boolean;
}
```

---

## MCP Command Spec

### `page.html`

**Description:** Extract the full HTML of the page.

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
    "html": { "type": "string" },
    "length": { "type": "integer" },
    "truncated": { "type": "boolean" }
  },
  "required": ["html", "length"]
}
```

---

## Error Cases

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |
| `INTERNAL_ERROR` | CDP `DOM.getOuterHTML` failed |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-06-005 | `page.html` returns valid HTML starting with `<!DOCTYPE` or `<html`. |
| AC-06-006 | Very large pages truncate HTML with `truncated: true`. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | Valid `pageId` |
| [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md) | `DOM.getOuterHTML` |

---

## Out of Scope (V2)

- Inner HTML of specific elements
- Serialized iframe content from cross-origin frames
- HTML prettification / minification options
