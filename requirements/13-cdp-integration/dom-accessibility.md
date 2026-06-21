# Feature: DOM & Accessibility

> **Module:** [13-cdp-integration](./REQUIREMENTS.md)  
> **Type:** Internal adapter layer

## Overview

Provide CDP-backed DOM queries, accessibility tree extraction, visible text, HTML, and DOM statistics. Powers element discovery and page inspection modules without exposing raw CDP node IDs to domain layers beyond the adapter boundary.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-13-014 | The CDP layer SHALL provide `getAccessibilityTree(page)` returning the full AX tree. |
| FR-13-015 | The CDP layer SHALL provide `queryDOM(page, selector)` for DOM queries. |
| FR-13-016 | The CDP layer SHALL provide `getOuterHTML(page)` for HTML extraction. |
| FR-13-017 | The CDP layer SHALL provide `getVisibleText(page)` for text extraction. |
| FR-13-018 | The CDP layer SHALL provide `getDOMStats(page)` returning node/form/link/image counts. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-13-004 | CDP layer SHALL handle stale node references gracefully (re-query on stale). |

---

## Data Models / Types

### CdpNode (internal)

```typescript
interface CdpNode {
  nodeId: number;          // CDP backend node ID
  role: string;
  name: string;
  visible: boolean;
  tagName: string;
  bounds?: { x: number; y: number; width: number; height: number };
}
```

### DOMStats

```typescript
interface DOMStats {
  nodeCount: number;
  formCount: number;
  linkCount: number;
  imageCount: number;
}
```

### CdpAdapter Methods (this feature)

```typescript
interface CdpAdapter {
  getAccessibilityTree(page: CdpPage): Promise<CdpNode[]>;
  queryDOM(page: CdpPage, selector: string): Promise<CdpNode[]>;
  getOuterHTML(page: CdpPage): Promise<string>;
  getVisibleText(page: CdpPage): Promise<string>;
  getDOMStats(page: CdpPage): Promise<DOMStats>;
}
```

---

## MCP Command Spec

This feature does not expose MCP commands. Consumed by [04-element-discovery-targeting](../04-element-discovery-targeting/REQUIREMENTS.md) and [06-screenshots-inspection](../06-screenshots-inspection/REQUIREMENTS.md).

---

## Error Cases

| Condition | Behavior |
|-----------|----------|
| Stale node reference | Re-query DOM; return `ELEMENT_NOT_FOUND` if unrecoverable |
| Page navigated during query | Re-fetch tree; return partial results if safe |
| CDP DOM command failure | Wrap in typed error with CDP message preserved |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-13-003 | `getAccessibilityTree` returns interactive elements with roles and names. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [browser-page-operations.md](./browser-page-operations.md) | `CdpPage` handle |
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model |

### CDP Domains Used

| CDP Domain | Purpose |
|------------|---------|
| `DOM` | DOM tree queries, node resolution |
| `Accessibility` | AX tree for element discovery |
| `Page` | HTML and text extraction |

---

## Out of Scope (V2)

- Shadow DOM piercing strategies beyond default CDP behavior
- iframe content extraction as separate tree
- Accessibility auditing (WCAG compliance scoring)
