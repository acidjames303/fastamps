# Iteration 009 — live

**Published:** 20 Nov 2026, ~16:37 Europe/London  
**Lever:** ComparisonView cue when viewing “Your current process”

## Changes
When the visitor switches to the current-process tab after analysis:
> This is your original map. Tap **Your smarter process** to see the proposal side by side.

Default tab remains “Your smarter process”.

## Remeasure
- Live bundle includes compare cue (`ComparisonView-*.js`)
- Playtest visits are often on the free-quota gate path (no before/after), so cue isn’t exercised every run — string verified in shipped asset
- Prior gates still pass

## Checkpoint
`6b00770dc0634578a5bbef50`
