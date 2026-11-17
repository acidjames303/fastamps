# Stickman quality rubric (Home + Work)

Score each criterion **1–5**. Target: average ≥ **4.5** on two consecutive iterations.

| # | Criterion | 1 | 3 | 5 |
|---|-----------|---|---|---|
| 1 | **Discoverability** | Invisible / confusing controls | Gamepad found by explorers | Clear “try me” without looking like a game HUD |
| 2 | **Play-mode clarity** | Hint gone; D-pad vanishes | Hint once; D-pad sometimes | Legend + D-pad while playing; obvious PLAYING state |
| 3 | **Motion smoothness** | Jank, pops, sticky edges | Mostly fine | Walk/jump/fly/land feel continuous and weighted |
| 4 | **Fly feel** | Lost / twitchy / hard to trigger | Works if you know the trick | Double-jump window forgiving; thrust readable; trails subtle |
| 5 | **Site interaction** | Floats over content unused | Lands on some panels | Uses Home/Work anchors: lands, slides, presses, parachutes with purpose |
| 6 | **Scroll choreography** | Random wandering | Hits a few stops | Journey reads as one composition tied to sections |
| 7 | **Anti-gimmick** | Arcade toy fighting the brand | Fun but loud | Delight that supports “people + systems” story; never blocks CTAs |
| 8 | **Idle / exit manners** | Kicks you out mid-play | Esc works; idle abrupt | Patient idle (~8–10s) + soft “returning…” cue |
| 9 | **Home polish** | Broken on `/` | Works | Hero → people flow → services → builder → work → founder → CTA feels authored |
| 10 | **Work polish** | Missing / thin | Present | Card landings, image walks, CTA hold feel intentional |

## Must-fix gates (any fail = not done)
- [ ] D-pad remains visible for entire play session
- [ ] Idle exit ≥ 8s on ground with no input
- [ ] Space/arrows do not scroll the page while playing
- [ ] Character never blocks primary CTAs (`Let's make it smarter`, contact)
- [ ] `prefers-reduced-motion` still disables him

## Anti-patterns (do not ship)
- Scoreboards, coins as primary UI, neon glow, emoji speech bubbles
- Constant unsolicited movement that distracts from reading
- Expanding to many new pages before Home + Work are excellent
- “More features” when the real problem is timing/feel
