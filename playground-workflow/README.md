# Playground workflow agent

Iterative UX / copy work for the SmartFunction **Playground** app:  
[https://smartfunction.io/playground](https://smartfunction.io/playground)

Focus: help clients map their workflows, explain the free Smart Builder analysis, and collect useful process data so SmartFunction can improve those workflows with apps, automation, and services.

**Not in scope:** stickman character, Home/Work motion, or other site chrome.

## Quick start

```bash
cd playground-workflow
npm install
npm run playtest -- --out artifacts/latest
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

## Ship the current round

See **`APPLY.md`** — paste `prompts/NEXT_BASE44.md` into Base44, publish, then tell the agent.

## How to run a cycle

1. Read `BRIEF.md` + latest `iterations/*.md`.
2. Playtest live; score with `RUBRIC.md`.
3. Choose **one** lever.
4. Rewrite `prompts/NEXT_BASE44.md`.
5. Apply via Base44 (paste or API) — checklist in `APPLY.md`.
6. Re-test; log the result.
