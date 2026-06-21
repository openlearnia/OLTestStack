# Module 04 — Element Discovery & Targeting

> **Module ID:** `04-element-discovery-targeting`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [05-user-actions](../05-user-actions/REQUIREMENTS.md), [08-waiting-synchronization](../08-waiting-synchronization/REQUIREMENTS.md), [09-assertions](../09-assertions/REQUIREMENTS.md)

## Overview

Discover and target interactive DOM elements on a page. Provides AI-friendly element enumeration and query-based lookup using accessibility-oriented attributes (role, text, label) rather than brittle CSS/XPath selectors.

---

## Feature Index

| MCP Command | Description | Requirements |
|-------------|-------------|--------------|
| [`page.elements`](./page.elements.md) | List visible interactive elements; returns `elementId` list | [→](./page.elements.md) |
| [`page.find`](./page.find.md) | Find a single element by text query | [→](./page.find.md) |

---

## Module-Level Requirements Summary

| Category | IDs |
|----------|-----|
| Functional | FR-04-001 through FR-04-011 (distributed across feature files) |
| Non-Functional | NFR-04-001 through NFR-04-003 |
| Acceptance | AC-04-001 through AC-04-010 |

---

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| 01-core-architecture | [Element type](../01-core-architecture/types.md), element registry per page, [error model](../01-core-architecture/error-model.md) |
| 03-page-session-management | Valid `pageId` required; element IDs invalidated on navigation/reload |
| 13-cdp-integration | CDP Accessibility.getFullAXTree, DOM.getDocument |

---

## Out of Scope (V2)

- AI self-healing selectors (re-resolve stale elements automatically)
- CSS/XPath selector-based find (`page.findBySelector`)
- Shadow DOM piercing as first-class API
- Element relationship queries (parent, sibling, nth-child)
- Visual/coordinate-based element targeting
- Accessibility audit scoring
