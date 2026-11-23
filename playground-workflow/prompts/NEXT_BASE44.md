# Base44 prompt — Playground iteration 047+ (stability)

Iterations **001–011**, **042–046** are live. Keep shipping **stability** edits.

## Next levers (ship one at a time)
1. Soft-reset orphan tip when the map becomes fully connected again (re-teach if they disconnect later).
2. Persist contact name/email across gate ↔ analysis so visitors do not retype after a failed second run.
3. When analysis returns `limited === "contact"`, prefill AnalysisGate from `contact` state (already stored) — verify empty fields do not wipe typed values.
4. Canvas: prevent accidental pan start while linking (already stopPropagation on startLink — verify).

Out of scope: stickman, model/quota, new templates, non-Playground pages.
