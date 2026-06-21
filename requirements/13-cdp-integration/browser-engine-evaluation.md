# Browser Engine Evaluation — V1 CDP Integration

> **Status:** Decision locked (2026-06-21)  
> **Related:** [REQUIREMENTS.md](./REQUIREMENTS.md), [cdp-client-management.md](./cdp-client-management.md), [browser.launch.md](../02-browser-session-management/browser.launch.md)

## Decision: Chromium for V1

| Item | Choice |
|------|--------|
| **V1 browser engine** | **Chromium** (bundled via Puppeteer or `CHROMIUM_EXECUTABLE_PATH`) |
| **V1 CDP wrapper** | **Puppeteer** (`puppeteer.launch()` / `browser.newPage()`) |
| **Lightpanda** | Deferred to V1.1+ hybrid mode (fast path + Chromium fallback) |
| **Firefox / WebKit** | Out of scope for V1 |
| **Raw CDP WebSocket** | Out of scope for V1 |

This decision is **confirmed**, not pending. V1 implementation SHALL use Puppeteer to drive Chromium. The CDP adapter interface (NFR-13-003) remains swappable for future engines, but no alternate engine ships in V1.

See [Recommendation](#recommendation) and [Decision](#decision) sections below for evaluation rationale.

---

## Executive Summary

**Recommendation: Keep Chromium as the V1 default engine; design the CDP adapter for engine swap; add an optional hybrid mode in V1.1+ with Lightpanda as a fast path and automatic Chromium fallback.**

The current requirements assume Chromium via Puppeteer and that assumption remains correct for V1. Lightpanda is a compelling CDP-compatible engine for AI automation (speed, memory, native AX tree / markdown), but it is **beta software with partial CDP coverage** and **cannot satisfy two V1 must-haves today**: PNG screenshots (`page.screenshot`, recording evidence) and reliable multi-tab support (`page.create`).

A hybrid architecture—already hinted at by Hermes Agent and agent-browser—is the best long-term path: run most agent workflows on Lightpanda, fall back to Chromium when a command requires pixels or hits an unsupported CDP domain.

---

## Comparison Table

| Criterion | **Chromium** (Puppeteer) | **Lightpanda** | **Firefox** (Playwright) | **Other CDP engines** |
|-----------|---------------------------|----------------|--------------------------|----------------------|
| **CDP protocol** | Full, reference implementation | Partial / WIP; DOM, Network, Runtime, Accessibility; no rendering domains | Default: Juggler (not CDP). BiDi via `moz-firefox*` channels (experimental) | No mature standalone CDP browser besides Lightpanda |
| **V1 spec fit** | ✅ Meets all CDP domain requirements | ❌ Blocks `page.screenshot`; multi-tab gaps | ❌ Out of V1 scope (not CDP-native) | N/A |
| **Screenshots (PNG)** | ✅ `Page.captureScreenshot` | ❌ No paint pipeline; command fails or must fallback | ✅ (via Playwright, not raw CDP) | N/A |
| **Accessibility tree** | ✅ `Accessibility.getFullAXTree` | ✅ Supported (2026 docs); CDP schema compatible | ✅ via Playwright locator layer | N/A |
| **DOM / HTML / text** | ✅ Full | ✅ Core strength; also native `LP.getMarkdown` | ✅ via Playwright | N/A |
| **Network monitoring** | ✅ `Network.*` | ✅ Request interception; monitoring WIP | ✅ | N/A |
| **Console monitoring** | ✅ `Runtime.consoleAPICalled`, `Log.*` | ✅ (V8-backed) | ✅ | N/A |
| **Input (click/type/scroll)** | ✅ `Input.*` | ✅ Core workflow supported | ✅ | N/A |
| **Multiple tabs/pages** | ✅ Native targets | ⚠️ Multi-client CDP yes; multi-tab contexts **not yet** (per Lightpanda/Hermes, 2026) | ✅ | N/A |
| **CRUD app reliability** | ✅ Highest; real browser fidelity | ⚠️ Good for many sites; SPAs with unimplemented Web APIs may fail silently | ✅ High (different protocol) | N/A |
| **Cold start** | ~2–4 s | ~0.1–0.4 s (claimed; sub-100 ms serve) | ~2–3 s | N/A |
| **Memory (100 pages, vendor bench)** | ~2 GB peak | ~123 MB peak | Similar to Chromium | N/A |
| **Maturity** | Production | Beta / active development | Production (Playwright layer) | N/A |
| **Licensing** | BSD (Puppeteer) / Chromium OSS | Apache-2.0 (engine + `@lightpanda/browser`) | MPL (Firefox) | N/A |
| **npm integration** | `puppeteer` (downloads Chromium) | `@lightpanda/browser` (downloads platform binary) | `playwright` | `chrome-remote-interface`, `chromedp` are **clients**, not engines |
| **Headless** | ✅ Default | ✅ Only mode (no GUI) | ✅ | N/A |
| **AI-agent fit** | High (full fidelity) | Very high (AX tree, markdown, token-efficient snapshots) | Medium for V1 (protocol mismatch) | Low |

---

## Lightpanda Deep Dive

### What it is

[Lightpanda](https://lightpanda.io/) is an open-source headless browser **built from scratch in Zig**, not a Chromium/WebKit fork. Architecture (per official docs and founder statements):

| Layer | Technology |
|-------|------------|
| HTTP/TLS | libcurl |
| HTML parsing | html5ever (Servo lineage) |
| DOM | Custom Zig DOM (`zigdom`) |
| JavaScript | Google V8 |
| Protocol | CDP over WebSocket |
| Deployment | Single binary / `@lightpanda/browser` npm wrapper |

It deliberately **omits CSS layout, paint, compositing, and GPU pipelines**. It fetches HTML, builds a DOM, executes JavaScript, and exposes state via CDP—it does not render pixels.

### CDP compatibility status (2025–2026)

| Area | Status | V1 impact |
|------|--------|-----------|
| CDP WebSocket server (`lightpanda serve`, port 9222) | ✅ Stable path | Compatible with `puppeteer.connect()` / `playwright.chromium.connectOverCDP()` |
| DOM queries, navigation, cookies, headers | ✅ | Supports `page.navigate`, `page.html`, element discovery |
| Input (click, type, scroll, press) | ✅ | Supports user-action module |
| Network interception / monitoring | ✅ / WIP | Likely sufficient for `page.network`; verify response bodies |
| `Accessibility.getFullAXTree` | ✅ (documented 2026) | Supports `page.elements`, `page.find`, `page.snapshot` |
| `LP.getMarkdown` (custom CDP) | ✅ Lightpanda-specific | Potential V2 optimization for token-efficient snapshots |
| `Page.captureScreenshot` | ❌ No renderer | **Blocks `page.screenshot` and screenshot recording** |
| Multi-tab / browser contexts | ❌ Not yet (Hermes integration notes, 2026) | **Risk to `page.create` with multiple concurrent pages** |
| File uploads, clipboard, geolocation emulation | ❌ Not yet | May affect some CRUD forms |
| Full Web API surface | Partial / WIP | Complex SPAs may fail without obvious errors |

Official npm readme labels CDP + Playwright/Puppeteer interop as **"WIP"**. Treat compatibility as **best-effort**, not guaranteed drop-in.

### Performance claims (vendor benchmarks)

Benchmarks on AWS EC2 (100 pages, local or real URLs):

| Metric | Lightpanda | Headless Chrome | Ratio |
|--------|------------|-----------------|-------|
| Execution time | ~5 s | ~46 s | ~9× faster |
| Memory peak | ~123 MB | ~2 GB | ~16× less |
| Cold start | ~0.1–0.4 s | ~3–4 s | ~10–30× faster |

Independent analysis (Webfuse, 2026) notes vendor claims are workload-dependent; on heterogeneous real pages they measured ~4× memory advantage (not 16×) but still large cold-start wins. **Compatibility tax**: some SPAs fail silently when hydration touches unimplemented APIs.

### Licensing and distribution

- **License:** Apache-2.0 ([GitHub: lightpanda-io/browser](https://github.com/lightpanda-io/browser))
- **npm:** `@lightpanda/browser` — auto-downloads platform binary on install (~2.4K weekly downloads as of mid-2026)
- **Install:** Homebrew (`brew install lightpanda-io/browser/lightpanda`), Docker (`lightpanda/browser:nightly`), or npm `lightpanda.serve()`
- **Platforms:** Linux, macOS (nightly); Windows support limited / build-from-source
- **Cloud:** Managed offering at `cloud.lightpanda.io` (Lightpanda + Chrome backends)

### Maturity assessment

| Signal | Assessment |
|--------|------------|
| Stage | **Beta** — "work in progress", active weekly releases |
| Funding | Pre-seed (June 2025) |
| Ecosystem | Integrations with Hermes Agent, Stagehand, native MCP server |
| Production readiness | Suitable for experimentation and cost-sensitive scraping; **not yet for mission-critical test evidence without Chromium fallback** |
| Risk | Silent failures on edge Web APIs; CDP `UnknownMethod` for unsupported domains |

### Limitations for AI testing (this framework)

| V1 requirement | Lightpanda gap |
|----------------|----------------|
| `page.screenshot` (PNG, full-page) | No graphical renderer — **hard blocker** |
| Recording with screenshot events | Same blocker |
| `page.create` (multiple pages) | Multi-tab contexts not supported yet |
| `assert-network`, `page.network` | Likely OK; validate body capture if added in V2 |
| CRUD form testing (file inputs) | File upload not supported yet |
| Visual regression (V2) | Not possible without Chromium |
| Reliability NFR (<500 ms p95) | Faster when it works; failures add fallback latency |

**Where Lightpanda excels for AI agents:** fast navigation, accessibility-tree snapshots (smaller than full HTML), native markdown extraction, low memory for concurrent sessions—aligned with token-efficient agent loops.

---

## Chromium via Puppeteer / Playwright (Current Spec)

### What the requirements assume

- [README.md](../README.md): "Chromium-only for V1", CDP via Puppeteer/Playwright
- [cdp-client-management.md](./cdp-client-management.md): Puppeteer recommended; `CHROMIUM_EXECUTABLE_PATH` for binary detection
- [browser.launch.md](../02-browser-session-management/browser.launch.md): launches Chromium, headless default, 5 s cold-start NFR
- CDP domains used across module 13: `Page`, `DOM`, `Accessibility`, `Input`, `Network`, `Runtime`, `Log`

### Strengths for V1

- **Full CDP** — every domain in the spec works today
- **Screenshots** — `Page.captureScreenshot` for viewport and full-page PNG
- **Multi-tab** — `Target.createTarget` / Puppeteer `browser.newPage()`
- **CRUD fidelity** — real browser engine; CSS layout affects visibility/actionability
- **Ecosystem** — Puppeteer is lightweight, well-documented, matches "Chromium-only" decision (AD-01)

### Weaknesses

- High memory per instance (~200 MB–2 GB under load)
- Slow cold start (2–5 s), conflicts slightly with NFR-02-001 (5 s launch budget) but passes
- Heavy in CI / multi-tenant agent farms

### Playwright as wrapper alternative

Playwright adds auto-wait, richer API, and future multi-browser path—but still drives Chromium via CDP for Chrome. Heavier dependency. Requirements already allow either; **Puppeteer remains the better V1 default** unless auto-wait features are prioritized.

---

## Firefox via Playwright (CDP vs BiDi)

Firefox is **explicitly out of V1 scope** ([REQUIREMENTS.md](./REQUIREMENTS.md) module 13, [README.md](../README.md) assumption #1).

| Protocol | Status | CDP requirement fit |
|----------|--------|---------------------|
| **Juggler** (Playwright bundled Firefox) | Production default | ❌ Not CDP — violates FR-13-001 |
| **WebDriver BiDi** (`moz-firefox`, `moz-firefox-nightly`) | Experimental in Playwright (2025–2026); MCP layer added June 2026 | ❌ Different protocol; would require replacing "CDP-only" architecture |
| **CDP on Firefox** | Not natively supported | ❌ |

Adopting Firefox would mean either abandoning the CDP-only decision (FR-01-002, FR-13-001) or waiting for a CDP shim that does not exist. **Defer to V2+** if multi-browser support is needed; use BiDi as a separate adapter, not a CDP substitute.

---

## Other Headless CDP-Compatible Engines

| Option | Role | Verdict |
|--------|------|---------|
| **Headless Chrome / Chrome for Testing** | Same engine Puppeteer bundles | ✅ Default — no change |
| **Google Chrome / Edge (channel)** | `executablePath` or Playwright channel | ✅ Drop-in via `CHROMIUM_EXECUTABLE_PATH` |
| **Lightpanda** | Alternative CDP server | ⚠️ Partial — see above |
| **chromedp, chrome-remote-interface** | Go/Node CDP **client libraries** | Clients only; still need Chromium |
| **Selenium 4 + CDP bridge** | Drives real browsers | Heavier; still Chromium underneath |
| **Servo** | Research browser | No production CDP automation target |

**There is no production-ready CDP browser engine besides Chromium and Lightpanda (beta).**

---

## Mapping to V1 Requirements

| Requirement area | Chromium | Lightpanda | Notes |
|------------------|----------|------------|-------|
| FR-13-001 CDP-only | ✅ | ✅ (partial) | Lightpanda skips rendering CDP domains |
| FR-13-002 Puppeteer/Playwright wrapper | ✅ `launch()` | ✅ `connect()` | Lightpanda requires serve-then-connect pattern |
| FR-13-005 Binary detection | ✅ `CHROMIUM_EXECUTABLE_PATH` | Needs `LIGHTPANDA_EXECUTABLE_PATH` or npm binary | New config if adopted |
| `page.screenshot` / FR-06-* | ✅ | ❌ | Blocker |
| `page.snapshot` / AX tree | ✅ | ✅ | Lightpanda may be faster; verify bounds metadata |
| `page.network` / `page.console` | ✅ | ⚠️ | Verify parity |
| `page.click` / `type` / `scroll` | ✅ | ✅ | Core Lightpanda workflow |
| `page.create` (multi-page) | ✅ | ❌ (yet) | Blocker for concurrent tabs |
| `browser.launch` NFR 5 s | ✅ (borderline) | ✅ easily | Lightpanda wins cold start |
| NFR-01-001 p95 < 500 ms | ✅ | ✅ often | Fallback adds latency |
| Test reports / recording | ✅ screenshots | ❌ without fallback | Evidence chain incomplete |
| CRUD app testing | ✅ | ⚠️ | Test target apps before trusting |

---

## Impact on Existing Requirements if Switching to Lightpanda

### If Lightpanda were the **sole** V1 engine (not recommended)

| Document | Required change |
|----------|-----------------|
| [README.md](../README.md) | Remove "Chromium-only"; add engine caveats; update architecture diagram |
| [system-architecture.md](../01-core-architecture/system-architecture.md) AD-01 | Rewrite browser decision |
| [browser.launch.md](../02-browser-session-management/browser.launch.md) | Rename/reframe as engine-agnostic; drop Chromium-specific errors |
| [cdp-client-management.md](./cdp-client-management.md) | Replace binary detection; add serve/connect lifecycle |
| [page-screenshot.md](../06-screenshots-inspection/page-screenshot.md) | Remove or defer to V2 / mark unsupported |
| [screenshot-capture.md](./screenshot-capture.md) | Same |
| [recording](../10-recording-test-reports/) | Remove screenshot events or make optional |
| [configuration.md](../01-core-architecture/configuration.md) | `BROWSER_ENGINE`, `LIGHTPANDA_*` vars |
| Acceptance criteria AC-13-001, AC-02-001 | Rewrite for Lightpanda |

### If adopting **hybrid** (recommended future path)

Minimal V1 changes; add adapter interface:

```typescript
type BrowserEngine = 'chromium' | 'lightpanda' | 'auto';

interface LaunchOptions {
  engine?: BrowserEngine;  // default: 'chromium'
  fallbackEngine?: 'chromium';  // for 'auto' / 'lightpanda'
  // ...existing options
}
```

| Command / feature | Engine routing |
|-------------------|----------------|
| `page.screenshot` | Always Chromium (or fallback) |
| `page.snapshot`, `page.find`, actions | Lightpanda when `engine: auto` |
| Failed CDP command on Lightpanda | Retry once on Chromium |
| `page.create` (2+ tabs) | Chromium until Lightpanda multi-tab ships |

---

## Recommendation

### V1 (now): **Chromium via Puppeteer**

| Reason | Detail |
|--------|--------|
| Spec compliance | Screenshots, multi-page, full CDP domains—all required today |
| Reliability | CRUD testing needs real layout/visibility semantics |
| Simplicity | Matches existing docs, acceptance criteria, and AD-01 |
| Risk | Lowest for a first shipping version |

**Keep** `FR-13-002` Puppeteer as default wrapper. **Keep** `CHROMIUM_EXECUTABLE_PATH`. No change to MCP tool surface.

### V1.1+ (next): **Hybrid `auto` engine**

| Reason | Detail |
|--------|--------|
| Performance | 9–16× memory and 9–11× speed wins for navigation-heavy agent loops |
| AI alignment | Native AX tree + markdown reduce token load vs raw HTML |
| Proven pattern | Hermes Agent (`engine: lightpanda` + Chrome fallback), agent-browser dual-engine |
| Low risk | Adapter already swappable (NFR-13-003); fallback preserves evidence chain |

Implementation sketch:

1. `browser.launch({ engine: 'chromium' | 'lightpanda' | 'auto' })` — default `'chromium'`
2. Lightpanda path: `@lightpanda/browser` serve → `puppeteer.connect({ browserWSEndpoint })`
3. Fallback table per command (screenshot → Chromium; optional retry on `UnknownMethod`)
4. Compatibility test suite against reference CRUD app before enabling `auto` default

### Do **not** adopt for V1

| Option | Why |
|--------|-----|
| Lightpanda-only | Breaks screenshots, recording evidence, multi-tab |
| Firefox / BiDi | Violates CDP-only architecture |
| Raw CDP WebSocket | Already deferred to V2; unnecessary with Puppeteer |

---

## Decision

| Decision | Choice |
|----------|--------|
| **V1 default engine** | **Chromium** (Puppeteer) |
| **V1.1 candidate** | **Hybrid** — Lightpanda fast path + Chromium fallback |
| **Lightpanda-only** | **Reject for V1** |
| **Firefox** | **Out of scope** (unchanged) |

### Follow-up actions

- [ ] Add `BROWSER_ENGINE` to configuration spec when hybrid work begins
- [ ] Build CDP capability probe (screenshot, multi-target) for runtime fallback
- [ ] Track Lightpanda releases for multi-tab and file-upload support
- [ ] Re-evaluate when Lightpanda reaches stable + full V1 CDP parity

---

## References

- [Lightpanda documentation](https://lightpanda.io/docs/)
- [Lightpanda GitHub — lightpanda-io/browser](https://github.com/lightpanda-io/browser)
- [@lightpanda/browser npm](https://www.npmjs.com/package/@lightpanda/browser)
- [Markdown and AXTree guide](https://lightpanda.io/docs/guides/markdown-axtree)
- [Hermes Agent + Lightpanda integration](https://lightpanda.io/blog/posts/lightpanda-is-a-browser-backend-hermes-agent)
- [Playwright Firefox BiDi channels](https://github.com/microsoft/playwright/issues/37277)
- [OLTestStack requirements README](../README.md)
