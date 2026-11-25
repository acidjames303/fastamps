# Iteration 152 — live (dictate visibility)

**Published:** 24 Nov 2026, ~21:39 Europe/London  
**Lever:** surface dictate on desktop (toolbar) so it is findable without selecting a node

## Why
151 shipped dictate only inside mobile `StepEditor`, selected-node inspector, and post-analysis lead fields. Desktop users saw no control until they clicked a step — reported as “can’t see the dictate feature.”

## Changes (Base44 sandbox → deploy)
- `BuilderToolbar` — always-visible **Dictate a step** (mic) next to Custom; creates a step from speech via `onDictateStep`
- `playground.jsx` — `addSpokenStep` + `splitDictateTranscript`; toast hints for listening / unsupported
- `DictateButton` — no longer returns `null` when Speech API missing; muted control + hint instead
- `StepEditor` — **Dictate a step** always shown (unsupported explains Chrome/Edge/Safari)
- `NodeInspector` / `LeadForm` — `onUnsupported` toasts

## Checkpoint / deploy
- Checkpoint: `6b060409139cee502e5ef5e0` (152b listening toast)
- Prior: `6b06008d71df9bff65257893` (152 toolbar surface)
- Deployed: 24 Nov 2026, 21:39 UTC → smartfunction.io/playground

## Remeasure
- Desktop: zoom **77%**, canvas Y **609**, toolbar `data-playground-dictate-toolbar` present, label “Dictate a step”
- Mobile: sticky CTA + list cue green; `data-playground-dictate-step` + field Dictate present
