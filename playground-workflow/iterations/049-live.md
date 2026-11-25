# Iteration 049 — live (stability)

**Published:** 23 Nov 2026, ~11:53 Europe/London  
**Lever:** no canvas pan while linking/dragging; analysis CTA mutex with lead submit; scroll to validation errors

## Changes (Base44 sandbox → deploy)
- `BuilderCanvas.jsx`: surface pointer-down ignores pan while `linking` or `dragging`
- `playground.jsx`: Make it smarter disabled / no-op while lead submit in flight; validation errors scroll `#playground-analysis` into view

## Checkpoint / deploy
- Checkpoint: `6b0429117ff67c52dd33730e`
- Commit: `b9563d9c3ba9f1a91d80442c4fa2a5e41b3e9872`
- Deployed: 23 Nov 2026, 11:53 UTC

## Remeasure
Gates still green (zoom 77%, canvasY 584, sticky CTA + list cue, connect tip, analysis/gate ok).
