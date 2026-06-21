# Feature: `page.text`

> **Module:** [06-screenshots-inspection](./REQUIREMENTS.md)  
> **MCP Command:** `page.text`

## Overview

Extract all visible text content from the page, whitespace-normalized with sections separated by newlines. Enables AI agents to read page content without parsing HTML. Output is truncated at 50,000 characters with an explicit flag when exceeded.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-06-003 | The system SHALL provide `page.text` to extract all visible text content from the page. |
| FR-06-009 | `page.text` SHALL return only visible text, whitespace-normalized, with sections separated by newlines. |
| FR-06-010 | `page.text` SHALL truncate output to 50,000 characters with `truncated: true` flag if exceeded. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01-001 | MCP tool response latency for non-navigation commands SHALL be < 500 ms at p95 under local headless execution. |

---

## Data Models / Types

### TextResult

```typescript
interface TextResult {
  text: string;
  length: number;
  truncated?: boolean;
}
```

---

## MCP Command Spec

### `page.text`

**Description:** Extract all visible text content from the page.

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
    "text": { "type": "string" },
    "length": { "type": "integer" },
    "truncated": { "type": "boolean" }
  },
  "required": ["text", "length"]
}
```

---

## Error Cases

| Code | Condition |
|------|-----------|
| `SESSION_NOT_FOUND` | `pageId` not found |
| `INTERNAL_ERROR` | DOM text extraction failed |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-06-004 | `page.text` on example.com contains "Example Domain". |
| AC-06-006 | Very large pages truncate text with `truncated: true`. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model |
| [03-page-session-management](../03-page-session-management/REQUIREMENTS.md) | Valid `pageId` |
| [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md) | DOM access for visible text extraction |
| [09-assertions](../09-assertions/assert-text.md) | `assert.text` reads from same visible text source |

---

## Out of Scope (V2)

- Element-scoped text extraction
- OCR from canvas/image elements
- Structured text extraction (tables, lists as JSON)
