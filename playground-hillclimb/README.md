# Playground hillclimb

Iterative UX / copy agent for [SmartFunction Playground](https://smartfunction.io/playground).

Same operating pattern as `stickman-hillclimb`, scoped to workflow discovery:

> Collect useful maps of how customers work today, run one honest free analysis, then convert into a call or project so SmartFunction can improve that workflow with real solutions and services.

## Quick start

```bash
cd playground-hillclimb
npm install
npm run playtest -- --out artifacts/latest
```

Requires Chrome/Chromium. Optional Base44 apply:

```bash
# set BASE44_API_KEY + BASE44_APP_ID (see .env.example)
npm run sandbox:grep
```

## Files

| Path | Role |
|------|------|
| `AGENT_TASK.md` | Loop, scope lock, done criteria |
| `BRIEF.md` | Stable product brief — do not drift |
| `RUBRIC.md` | Scoring + must-fix gates |
| `CONSTANTS.md` | Live flow facts / validation strings |
| `iterations/` | One markdown log per cycle |
| `prompts/NEXT_BASE44.md` | Paste into Base44 chat this round |
| `reference/PRIOR_ART.md` | Earlier Smart Builder audit + what is already fixed |
| `scripts/playtest.mjs` | Desktop + mobile smoke of the public flow |
| `scripts/sandbox-grep.mjs` | Locate Playground files in Base44 sandbox |

## How to run a cycle

1. Read `BRIEF.md` + latest `iterations/*.md`.
2. Playtest live; score with `RUBRIC.md`.
3. Choose **one** lever.
4. Rewrite `prompts/NEXT_BASE44.md`.
5. Apply via Base44 (API or paste).
6. Re-test; log the result.
