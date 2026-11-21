# Iteration 000 — Playground workflow baseline (code + live playtest)

**Date:** 20 Nov 2026 (Europe/London)  
**URL:** https://smartfunction.io/playground  
**Method:** Public HTML/meta + minified bundles (`playground-*.js`, `ComparisonView-*.js`) + `npm run playtest` (desktop 1280×800 / mobile 390×844) + canvas DOM check.

## Rubric (baseline)

| # | Criterion | Score | Evidence |
|---|-----------|------:|----------|
| 1 | Orientation | 3.5 | Strong H1; 4-step strip present. Intro explains the builder, not the SmartFunction solutions/services outcome. |
| 2 | Template start | 4 | Five templates with honest pain summaries; blank available; Sales follow-up selected by default with 5 nodes in DOM. |
| 3 | Mapping ease | 3 | Desktop canvas works; connect-via-circle easy to miss; empty Step settings uses `//` tips. Mobile uses list mode (no canvas) — good fallback. |
| 4 | Connection clarity | 2.5 | “circle to connect” hint is low-contrast mono under the canvas; first-run teaching is weak. |
| 5 | Validation empathy | 4 | Clear blocking strings; orphan soft-notes. |
| 6 | Analysis CTA | 3.5 | CTA + free/no-account fine print good; “One click, plain English” under-explains the data trade. Live CTA enters Analysing… on template. |
| 7 | Email / privacy gate | 3.5 | Second-run gate fair; first free path good; privacy ack only later on conversion. |
| 8 | Before / after clarity | 3.5 | Comparison copy present in bundle; full after-state not locked in this baseline. |
| 9 | Conversion honesty | 4 | Call vs project + “neither commits you” + human review promises are solid. |
| 10 | Mobile flow | 3.5 | List editor reachable; analysis CTA works; hero + templates + add-step compete for first viewport attention. |

**Average (approx):** **3.5**  
**Must-fix:** Meta **description** still Base44 boilerplate (`premium digital agency platform…`). Title already improved to `Smart Builder — map your process…`.

## Product-goal fit
Playground already aims at workflow capture → free analysis → project/call. Gaps vs brief:
- Outcome (SmartFunction solutions/services) is soft in the hero.
- Mapping friction risks shallow or incomplete graphs → weaker lead quality.
- Boilerplate meta undersells a unique interactive asset.

## Ranked levers (do in order)
1. **Orientation + value-exchange copy** (hero, step strip, analysis band) — this iteration’s pick. Includes visitor-language tips + meta description (see `prompts/NEXT_BASE44.md`).
2. Connection teaching / affordance on first map (prior “CIRCLE TO CONNECT” finding — still open).
3. Canvas default zoom / fit so the full template chain is readable without zooming (still ~75% live).
4. Reduce first-viewport competition (hero + five template cards push canvas below fold).
5. Clarify dual CTAs: nav `Let's make it smarter` vs in-page analysis button.
6. Mobile list-mode polish after desktop orientation lands.
7. After/before comparison microcopy once analysis path is re-tested live.

Prior Nov 17 must-fixes (broken step selection, `retupe` typo, missing Analyze CTA) are **already fixed** live — see `reference/PRIOR_ART.md`.

This agent improves the **workflow mapper only** — not stickman / character work.

## Decision
Ship lever **1** via `prompts/NEXT_BASE44.md`. Do not change Smart Builder model behaviour, templates list, or conversion form fields in this round.
