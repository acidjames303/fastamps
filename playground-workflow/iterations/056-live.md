# Iteration 056 — live (stability)

**Published:** 23 Nov 2026, ~13:38 Europe/London  
**Lever:** mobile validation/gate scroll uses `block: "center"`; skip AnalysisGate autofocus on phones

## Changes (Base44 sandbox → deploy)
- `playground.jsx`: validation failure scroll centers the analysis card on ≤767px so sticky CTA does not cover errors; opening the email gate on mobile also centers the card
- `AnalysisGate.jsx`: skip autofocus on small screens (avoids keyboard fighting sticky CTA)

## Checkpoint / deploy
- Checkpoint: `6b0441a1027ad6299767994a`
- Commit: `6dca078f30414ab4b3d0733ab7eac4aa8a8f82b0`
- Deployed: 23 Nov 2026, 13:37 UTC

## Remeasure
Gates still green (zoom 77%, canvasY 584, sticky CTA). Bundles contain center-scroll and mobile autofocus skip.
