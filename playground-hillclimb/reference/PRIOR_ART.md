# Prior art — Smart Builder / Playground

Mined from earlier SmartFunction agents (20 Nov 2026 Europe/London).  
Primary: [Smartfunction.io stick man audit](bc-305b50f8-7ad5-47a6-9ad2-b13627fdb57d) early browser audit; SEO pack in PR #8 ([SmartFunction SEO monitor](bc-77ee7ae2-257e-41b6-b5ee-56c7000513b9)).

## Product identity
Playground **is** Smart Builder at `https://smartfunction.io/playground` (app id `6afb374c91d1c9194f9d6554`). Admin surface `/admin/playground` must stay noindex.

## Status of Nov 17 must-fixes (re-checked live 20 Nov)

| Prior must-fix | Live status |
|-----------------|-------------|
| Step selection never populates sidebar | **Fixed** — clicking CRM opens Step settings with name input |
| Typo `Details retupe…` | **Fixed** — `Details retyped into the CRM when there is time.` |
| Missing Make it Smarter / Analyze CTA | **Fixed** — button present; enters Analysing… |
| Homepage CURRENT/SMARTER tabs | Out of Playground scope (Home) |

## Still open (should-fix / nice) — feed the hillclimb backlog

1. Default canvas zoom often ~75% (still observed) — prefer fit / 100% so the full chain is readable without hunting.
2. Dual CTAs: nav `Let's make it smarter` vs in-page `Make it smarter` — clarify which starts mapping vs analysis.
3. `CIRCLE TO CONNECT` discoverability — still the weakest mapping teach.
4. Template strip tall → canvas below fold on laptop viewports — first useful map competes with hero + five cards.
5. Meta description still Base44 boilerplate (title already improved). Paste-ready copy lives in SEO PR #8 `seo/base44/page-meta.json` → Playground entry.
6. Mobile/touch mapping audit beyond list mode.

## Explicit non-goals (from stickman loop)
Stickman hillclimb was scoped to **Home + Work only** and later **stopped**. Do not reopen stickman work under this Playground agent.
