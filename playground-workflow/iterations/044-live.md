# Iteration 044 — live (stability)

**Published:** 23 Nov 2026, ~11:32 Europe/London  
**Lever:** block call/project paths when analysis is stale; call-form double-submit lock

## Changes (Base44 sandbox → deploy)
- `ProjectPaths.jsx`: `blocked` prop hides forms and shows re-run cue (`data-playground-paths-blocked`)
- `playground.jsx`: pass `blocked={analysisStale}`; `sendToSmartFunction` refuses stale maps
- `CallRequestForm.jsx`: ignore submit while already submitting

## Checkpoint / deploy
- Checkpoint: `6b0424349f829f3ad75c234b`
- Commit: `1dafd22425ca51c387cb32939aa0a478aa1c9ef5`
- Deployed: 23 Nov 2026, 11:32 UTC

## Remeasure
Gates still green (zoom 77%, canvasY 584, sticky CTA + list cue, connect tip). Bundle contains `data-playground-paths-blocked`.
