# Iteration 057 — live (funnel / UI)

**Published:** 23 Nov 2026, ~13:51 Europe/London  
**Lever:** clearer funnel orientation — live stage progress, map-ready cue, mapping label, scroll-padding

## Funnel assessment (brief)
Gates were already green; weak spots were **orientation** (flat step strip) and **analysis CTA readiness** (no affirmative “you’re ready” signal). Conversion honesty was already solid.

## Changes (Base44 sandbox → deploy)
- Live funnel steps under the hero (`data-playground-funnel`) with current/done states
- “Mapping {template}” label on TemplatePicker (`data-playground-mapping`)
- Map-ready cue + soft electric border on the analysis card when validation passes (`data-playground-map-ready`)
- Sticky CTA reflects readiness while keeping the list-order cue
- `scroll-padding-bottom` on mobile for sticky CTA clearance
- Clearer conversion bridge copy after analysis

## Checkpoint / deploy
- Checkpoint: `6b0444b032a048cf33c06f57` (list-cue fix after `6b0444637ac170d3c658e962`)
- Deployed: 23 Nov 2026, 13:51 UTC

## Remeasure
Gates green: sticky CTA + list cue · connect tip · canvas in first viewport · zoom **77%** · analysis/gate ok
