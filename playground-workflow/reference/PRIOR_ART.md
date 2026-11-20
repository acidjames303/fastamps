# Prior art — Playground / Smart Builder

Earlier audits of the workflow mapper (not character/overlay work).

Primary references: early Smart Builder browser audit from [Smartfunction.io stick man audit](bc-305b50f8-7ad5-47a6-9ad2-b13627fdb57d); SEO pack in PR #8 ([SmartFunction SEO monitor](bc-77ee7ae2-257e-41b6-b5ee-56c7000513b9)).

## Product identity
Playground **is** Smart Builder at `https://smartfunction.io/playground` (app id `6afb374c91d1c9194f9d6554`). Admin surface `/admin/playground` must stay noindex.

## Status of Nov 17 must-fixes (re-checked live 20 Nov)

| Prior must-fix | Live status |
|-----------------|-------------|
| Step selection never populates sidebar | **Fixed** — clicking a step opens Step settings |
| Typo `Details retupe…` | **Fixed** — `Details retyped into the CRM when there is time.` |
| Missing Make it Smarter / Analyze CTA | **Fixed** — button present; enters Analysing… |

## Still open — feed this agent’s backlog

1. Default canvas zoom often ~75% — prefer fit / 100% so the full chain is readable.
2. Dual CTAs: nav `Let's make it smarter` vs in-page `Make it smarter` — clarify mapping vs analysis.
3. `CIRCLE TO CONNECT` discoverability — weakest mapping teach.
4. Template strip tall → canvas below fold on laptop viewports.
5. Meta description still Base44 boilerplate (title already improved). Paste-ready copy in SEO PR #8 `seo/base44/page-meta.json`.
6. Mobile list-mode orientation (hero context + sticky analysis CTA).

## Explicit non-goals
Do **not** add or tune the stickman character on Playground. That work lives elsewhere and is stopped for Home/Work. This agent only improves the workflow-mapping application.
