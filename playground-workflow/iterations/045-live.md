# Iteration 045 — live (stability)

**Published:** 23 Nov 2026, ~11:34 Europe/London  
**Lever:** Escape closes inspector; MAX_NODES toast on Add

## Changes (Base44 sandbox → deploy)
- `playground.jsx`: Escape (outside inputs) clears selection / closes inspector
- `playground.jsx`: `addNode` refuses past `MAX_NODES` with a toast (toolbar already disables)

## Checkpoint / deploy
- Checkpoint: `6b0424a2df6373518ea435e9`
- Commit: `848fe22e253415c6d9a68ee3ef26cc7943e56f3d`
- Deployed: 23 Nov 2026, 11:34 UTC

## Remeasure
Gates still green:
- meta clean · sticky CTA + list cue · connect tip · canvas in first viewport
- zoom **77%** · `canvasY` 584 · 5 template nodes · analysis/gate ok
