# Iteration 043 — live (stability)

**Published:** 23 Nov 2026, ~11:30 Europe/London  
**Lever:** stop canvas fit thrash; Escape cancels connect; stale-analysis cue; form double-submit locks

## Changes (Base44 sandbox → deploy)
- `BuilderCanvas.jsx`: `applyFit` no longer rebinds on bounds changes; ResizeObserver ignores manual zoom/pan and sub-24px noise; Escape cancels in-progress connect drag
- `playground.jsx`: structure-only fingerprint marks analysis stale when steps/edges change (not x/y); template/clear bump `analysisGen` and reset gate/submit; stale banner under before/after
- `AnalysisGate.jsx` / `LeadForm.jsx`: ignore submit while already submitting

## Checkpoint / deploy
- Checkpoint: `6b04239ec0b014ccd5ea39c2`
- Commit: `3ddd095c358c7f122bcd9d1f08cc3c14a3bd8be1`
- Deployed: 23 Nov 2026, 11:29 UTC

## Remeasure
Gates still green:
- meta clean · sticky CTA + list cue · connect tip · canvas in first viewport
- zoom **77%** · `canvasY` 584 · 5 template nodes
- Live bundles contain `data-playground-analysis-stale`, Escape cancel path, orphan tip
