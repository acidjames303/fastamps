# Iteration 001 — live

**Published:** 20 Nov 2026, ~14:53 Europe/London  
**Remeasured:** 20 Nov 2026, 14:56 Europe/London  
**Live:** https://smartfunction.io/playground  
**Bundle:** `playground-qXLDuHQy.js` (was `playground-CtM9Wm3V.js`)  
**Checkpoints:** `6b005ede3e50bcaef0f0134c` → sticky marker `6b005f57495b6ab5a2b72f6a`  
**Deploy:** `POST /api/apps/6afb374c91d1c9194f9d6554/deploy`

## Landed? Yes

| Signal | Expected | Live |
|--------|----------|------|
| Meta title | Playground-specific | `SmartFunction Playground — Map your process, then make it smarter` |
| Meta description | No agency boilerplate | New copy; `premium digital agency` gone (SEO settings + route head) |
| Hero intro | apps / automation / services | Present |
| Step strip | familiar process → talk solutions | Present |
| Analysis eyebrow | `Free Smart Builder analysis` | Present |
| Step tips | Plain English (no `//`) | Present |
| Connect circles | Always-on electric handle | Present |
| Sticky mobile CTA | Detectable + visible | `stickyCta: true` on mobile; screenshot shows bar |
| Header CTA on Playground | Scroll to `#playground-analysis` | Wired in `SiteHeader` |
| Analysis / email gate | Still works | `desktopAnalysisOrGate` / `mobileAnalysisOrGate` true |

## Playtest summary (14:56 Europe/London)

- `boilerplateMeta: false`
- `slashTipsPresent: false`
- `canvasNodesWhenTemplated: 5`
- Mobile sticky CTA: **true**
- In-flow mobile CTA still ~2294px (expected; sticky covers first-run reach)

## Rubric (quick)

| # | Criterion | Score | Notes |
|---|-----------|------:|-------|
| 1 | Orientation | 4.5 | Hero + strip + free analysis outcome clear |
| 2 | Template start | 4 | Templates fine; still tall before canvas (→ 002) |
| 3 | Mapping ease | 4 | Connect clearer; zoom/fit still soft |
| 4 | Connection clarity | 4.5 | Always-on circle + plain tips |
| 5 | Validation empathy | 4 | Unchanged; not this lever |
| 6 | Analysis CTA | 4.5 | Copy + sticky mobile |
| 7 | Email / privacy gate | 4 | Map stays mounted; gate copy updated |
| 8 | Before / after | 4 | Unchanged; strong already |
| 9 | Conversion honesty | 4 | Unchanged |
| 10 | Mobile flow | 4.5 | Sticky CTA + list note |

**Average ~4.2** — continue with iter 002 (first-viewport map / zoom-fit).

## How applied
Base44 sandbox `edit` on:

- `src/routes/_site/playground.jsx`
- `src/components/playground/{AnalysisGate,NodeInspector,BuilderCanvas,StepEditor,WorkflowNodeCard}.jsx`
- `src/components/SiteHeader.jsx`

Plus `PUT /api/apps/.../seo/settings` for Playground page title/description (platform injection was overriding route head in HTML).
