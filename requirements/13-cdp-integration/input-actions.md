# Feature: Input Actions

> **Module:** [13-cdp-integration](./REQUIREMENTS.md)  
> **Type:** Internal adapter layer

## Overview

Provide CDP-backed user input simulation: mouse click, text input, keyboard press, and scroll. Uses CDP Input domain commands and ensures elements are scrolled into view before interaction.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-13-019 | The CDP layer SHALL provide `click(page, nodeId)` using Input.dispatchMouseEvent. |
| FR-13-020 | The CDP layer SHALL provide `type(page, nodeId, text, options)` using Input.insertText. |
| FR-13-021 | The CDP layer SHALL provide `pressKey(page, key)` using Input.dispatchKeyEvent. |
| FR-13-022 | The CDP layer SHALL provide `scroll(page, direction, amount)`. |
| FR-13-023 | Click SHALL scroll element into view before clicking. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-13-004 | CDP layer SHALL handle stale node references gracefully (re-query on stale). |

---

## Data Models / Types

### TypeOptions

```typescript
interface TypeOptions {
  delay?: number;    // ms between keystrokes
  clear?: boolean;   // clear existing value before typing
}
```

### CdpAdapter Methods (this feature)

```typescript
interface CdpAdapter {
  click(page: CdpPage, nodeId: number): Promise<void>;
  type(page: CdpPage, nodeId: number, text: string, options?: TypeOptions): Promise<void>;
  pressKey(page: CdpPage, key: string): Promise<void>;
  scroll(page: CdpPage, direction: string, amount: number): Promise<void>;
}
```

---

## MCP Command Spec

This feature does not expose MCP commands. Consumed by [05-user-actions](../05-user-actions/REQUIREMENTS.md).

---

## Error Cases

| Condition | Mapped Error |
|-----------|--------------|
| Stale/invalid nodeId | Re-query; return `ELEMENT_NOT_FOUND` if unrecoverable |
| Element not actionable (hidden/disabled) | `ELEMENT_NOT_FOUND` after wait timeout |
| CDP Input command failure | Typed error with CDP message preserved |

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-13-004 | `click` on a button node triggers the click event. |
| AC-13-005 | `type` fills an input field with specified text. |

---

## Dependencies

| Module | Dependency |
|--------|------------|
| [browser-page-operations.md](./browser-page-operations.md) | `CdpPage` handle |
| [dom-accessibility.md](./dom-accessibility.md) | Node resolution and bounds |
| [01-core-architecture](../01-core-architecture/REQUIREMENTS.md) | Error model |

### CDP Domains Used

| CDP Domain | Purpose |
|------------|---------|
| `Input` | Mouse, keyboard, touch events |
| `DOM` | Scroll into view, node resolution |

---

## Out of Scope (V2)

- Touch/gesture simulation for mobile emulation
- Drag-and-drop interactions
- File upload via input[type=file]
