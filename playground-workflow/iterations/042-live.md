# Iteration 042 — live (stability)

**Published:** 23 Nov 2026, ~11:24 Europe/London  
**Lever:** Playground stability guards (double-submit, orphan dismiss, resize fit)

## Changes (Base44 sandbox → deploy)
- `playground.jsx`: `analysisGen` discard for stale analysis responses; skip first inspector `fitKey` bump; clear validation errors when the map changes; dismissible orphan tip (`sf-playground-orphan-tip`); submit button ignores double-clicks while `submitting`
- `BuilderCanvas.jsx`: shared `fitToBounds` + `ResizeObserver` so inspector open/close and window resize keep the chain in view

## Checkpoint / deploy
- Checkpoint: `6b04225025e3cb3e88787181`
- Commit: `debf2b5badec43b98129ab49f5afdcb49472c42b`
- Deployed: 23 Nov 2026, 11:24 UTC

## Remeasure
Gates still green:
- meta clean · sticky CTA + list cue · connect tip · canvas in first viewport
- zoom **77%** · `canvasY` 584 · 5 template nodes
- analysis / gate ok
- Live bundles contain `ResizeObserver`, `sf-playground-orphan-tip`, `Dismiss`
