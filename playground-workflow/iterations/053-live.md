# Iteration 053 — live (stability)

**Published:** 23 Nov 2026, ~12:46 Europe/London  
**Lever:** reserved stale-banner slot; ProjectPaths tab lock while submitting; aria-live analysis status

## Changes (Base44 sandbox → deploy)
- `playground.jsx`: fixed-height stale cue slot (`data-playground-analysis-stale-slot`) so ComparisonView does not jump; `sr-only` aria-live status for analyse/error/ready
- `ProjectPaths.jsx`: disable path tabs while submitting or blocked
- `ComparisonView.jsx`: `overflow-anchor: none` to reduce browser scroll anchoring jumps

## Checkpoint / deploy
- Checkpoint: `6b04355bd70038eec4446edb`
- Commit: `eee811231038ece82a23fa1cc71f8a914b95bb6b`
- Deployed: 23 Nov 2026, 12:45 UTC

## Remeasure
Gates still green (zoom 77%, canvasY 584). Bundles contain stale-slot, aria-live copy, overflow-anchor.
