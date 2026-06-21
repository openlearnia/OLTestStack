# Module 06 — Screenshots & Inspection

> **Module ID:** `06-screenshots-inspection`  
> **Depends on:** [01-core-architecture](../01-core-architecture/REQUIREMENTS.md), [03-page-session-management](../03-page-session-management/REQUIREMENTS.md), [04-element-discovery-targeting](../04-element-discovery-targeting/REQUIREMENTS.md), [13-cdp-integration](../13-cdp-integration/REQUIREMENTS.md)  
> **Depended on by:** [10-recording-test-reports](../10-recording-test-reports/REQUIREMENTS.md), [11-test-execution](../11-test-execution/REQUIREMENTS.md)

## Overview / Purpose

Capture visual and structural evidence from pages: full-page or viewport screenshots, comprehensive page snapshots (URL, title, DOM summary, interactive elements), visible text extraction, and raw HTML retrieval. These commands provide the AI agent with situational awareness of the current page state.

---

## Feature Index

| MCP Command | Description | Requirements |
|-------------|-------------|--------------|
| `page.screenshot` | Capture PNG image of viewport or full page | [→](./page-screenshot.md) |
| `page.snapshot` | Comprehensive page state summary with interactive elements | [→](./page-snapshot.md) |
| `page.text` | Extract visible text content (whitespace-normalized) | [→](./page-text.md) |
| `page.html` | Extract full document outer HTML | [→](./page-html.md) |

---

## Module-Level Requirements Summary

| Category | IDs | Notes |
|----------|-----|-------|
| Functional | FR-06-001 – FR-06-012 | Distributed across feature files |
| Non-Functional | NFR-06-001 – NFR-06-004, NFR-01-001 | Screenshot-specific in `page-screenshot`; shared latency in text/html/snapshot |
| Acceptance | AC-06-001 – AC-06-006 | One or more ACs per feature file |

---

## Dependencies on Other Modules

| Module | Dependency |
|--------|------------|
| 01-core-architecture | Error model, config (`SCREENSHOT_DIR`) |
| 03-page-session-management | Valid `pageId`, URL/title metadata |
| 04-element-discovery-targeting | Element list for `page.snapshot` |
| 13-cdp-integration | `Page.captureScreenshot`, `DOM.getOuterHTML`, DOM traversal |
| 10-recording-test-reports | Screenshot event recording |

---

## Out of Scope (V2)

- Visual regression / pixel diff comparison
- Element-level screenshot (crop to element bounds)
- PDF export
- Video recording
- Accessibility tree export as standalone command
- Screenshot annotation / markup
