# Manners patch (verified against StickmanOverlay-DaYzQLaO.js)

Exact replacements for the live minified controller:

| Find | Replace | Effect |
|------|---------|--------|
| `Ot=7e3` | `Ot=1/0` | D-pad/hint never auto-hide while playing (`Infinity`) |
| `mt=3e3` | `mt=9e3` | Ground idle exit 3s → 9s |
| `ht=2600` | `ht=9e3` | Fly idle exit 2.6s → 9s |
| `xt=270` | `xt=420` | Double-tap fly window 270ms → 420ms |

Apply via Base44 sandbox (`npm run apply:manners`) once logged in, or paste `prompts/NEXT_BASE44.md`.

Do **not** change scroll-choreography anchors or pose art this round.
