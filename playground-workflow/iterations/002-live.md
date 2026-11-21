# Iteration 002 — live

**Published:** 20 Nov 2026, ~14:58–15:03 Europe/London  
**Remeasured:** 20 Nov 2026, 15:03 Europe/London  
**Live:** https://smartfunction.io/playground  
**Zoom after sales template:** **77%** (was ~48% mid-iter; previously often ~75% clipped)  
**Desktop canvas in first viewport:** true (`canvasY` ≈ 665 on 1280×800)  
**Nodes visible in first viewport:** yes (5-step sales chain)

## Changes shipped
1. Compact template cards (`line-clamp-1`, shorter padding, horizontal scroll)
2. Tighter Playground section spacing + optional `PageHero compact` (Playground only)
3. Canvas fit uses width+height, horizontal centre, **top-aligned** pan (so chain isn’t centred below the fold)
4. Full-width canvas until a step is selected; refit when inspector opens/closes
5. Softer `getBounds` minimums

## Regression checks (playtest)
- `boilerplateMeta: false`
- `slashTipsPresent: false`
- `mobileStickyCta: true`
- Analysis/gate still works
- 001 copy intact

## Rubric delta
| # | Was (001) | Now | Notes |
|---|----------:|----:|-------|
| 2 Template start | 4 | 4.5 | Strip shorter; canvas sooner |
| 3 Mapping ease | 4 | 4.5 | Fit + full-width first look |
| 10 Mobile | 4.5 | 4.5 | Sticky unchanged |

**Average ~4.4** — next lever if needed: pull canvas still higher (toolbar density / hero line-clamp), or conversion microcopy polish.

## Checkpoints
- `6b006000cec84d7c839d7479` compact templates + fit  
- `6b0060377dbae04e4b6ee578` compact hero  
- `6b0060c923353b77fa6a72a0` full-width + bounds  
- `6b00612c7f3a6444f36a7d40` top-align fit  
