# Iteration 151 — live (dictate)

**Published:** 24 Nov 2026, ~21:15 Europe/London  
**Lever:** voice dictate for mapping steps and lead notes (Web Speech API)

## Changes (Base44 sandbox → deploy)
- `src/hooks/use-dictate.js` — SpeechRecognition helper + transcript splitter
- `src/components/playground/DictateButton.jsx` — compact Mic control
- `StepEditor` — per-step description dictate + **Dictate a step** (creates a new step from speech)
- `NodeInspector` — dictate on “What happens here”
- `LeadForm` — dictate on goal + anything else

## Checkpoint / deploy
- Checkpoint: `6b05fe4c399ae4afe1663ed1`
- Deployed: 24 Nov 2026, 21:15 UTC

## Remeasure
All gates green (zoom 77%, sticky CTA + list cue, canvas Y 609). Dictate markers present on live assets.
