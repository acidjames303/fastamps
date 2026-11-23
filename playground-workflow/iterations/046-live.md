# Iteration 046 — live (stability)

**Published:** 23 Nov 2026, ~11:36 Europe/London  
**Lever:** coalesce mobile StepEditor typing into undo history

## Changes (Base44 sandbox → deploy)
- `playground.jsx`: `editSteps` routes list typing through `editNode` (1.5s coalesced history); add/remove/reorder/kind still use full `commit` snapshots

## Checkpoint / deploy
- Checkpoint: `6b042503980420ffd56d962c`
- Commit: `d42c5337a46d3e00e7e3d8321f7b63b22a11a944`
- Deployed: 23 Nov 2026, 11:35 UTC

## Remeasure
Gates still green (zoom 77%, canvasY 584, sticky CTA + list cue, connect tip, analysis/gate ok).
