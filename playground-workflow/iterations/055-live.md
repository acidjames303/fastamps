# Iteration 055 — live (stability)

**Published:** 23 Nov 2026, ~13:21 Europe/London  
**Lever:** busy undo/tidy/clear toasts; 1.5s toast dedupe; larger mobile scroll-margin under sticky CTA

## Changes (Base44 sandbox → deploy)
- `BuilderToolbar.jsx`: busy undo/tidy/clear stay clickable (`aria-disabled`) and call `onBusy`
- `playground.jsx`: `softToast` dedupes identical errors for 1.5s; busy toast for undo/tidy/clear; `scroll-mt-40` on analysis anchors when compact (sticky CTA)

## Checkpoint / deploy
- Checkpoint: `6b043d97d508b874f5e7ec6e`
- Commit: `6bf101ae9cf7a04a81e5ae5ef5b446264d875e2f`
- Deployed: 23 Nov 2026, 13:20 UTC

## Remeasure
Gates still green (zoom 77%, canvasY 584, sticky CTA). Bundles contain busy-toast copy and `scroll-mt-40`.
