# Module 05 — User Actions

> **Module ID:** `05-user-actions`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [04-element-discovery-targeting](../04-element-discovery-targeting/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [10-recording-test-reports](../10-recording-test-reports/REQUIREMENTS.md), [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview

Execute user-like interactions on page elements: clicking, typing text, pressing keyboard keys, and scrolling. All element-targeted actions operate on resolved `elementId` references from the Element Discovery module.

---

## Feature Index

| MCP Command | Description | Requirements |
|-------------|-------------|--------------|
| [`page.click`](./page.click.md) | Click an element by `elementId` | [→](./page.click.md) |
| [`page.type`](./page.type.md) | Type text into an input element | [→](./page.type.md) |
| [`page.press`](./page.press.md) | Press a keyboard key on the page | [→](./page.press.md) |
| [`page.scroll`](./page.scroll.md) | Scroll the page in a direction | [→](./page.scroll.md) |

---

## Module-Level Requirements Summary

| Category | IDs |
|----------|-----|
| Functional | FR-05-001 through FR-05-012 (distributed across feature files) |
| Non-Functional | NFR-05-001 through NFR-05-003 |
| Acceptance | AC-05-001 through AC-05-016 |

---

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| 01-core-architecture | [Error model](../01-core-architecture/error-model.md) |
| 03-page-session-management | Valid `pageId` |
| 04-element-discovery-targeting | Valid `elementId` resolution |
| 13-cdp-integration | Input.dispatchMouseEvent, Input.insertText, Input.dispatchKeyEvent |
| 10-recording-test-reports | Action event emission |

---

## Out of Scope (V2)

- Drag and drop
- Hover / mouse move
- Right-click / context menu
- File upload simulation
- Touch/gesture events (mobile)
- Multi-element selection
- Action chaining DSL (sequential action scripts)
