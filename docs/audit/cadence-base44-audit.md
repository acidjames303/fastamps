# Cadence — Base44 app audit

**Date:** 5 Nov 2026 (Europe/London)  
**App id:** `6a7338f6106b1962aa31c00a`  
**Live:** https://cadence.base44.app  
**Editor:** https://app.base44.com/apps/6a7338f6106b1962aa31c00a  
**Scope:** Public surface (browser) + production JS/CSS bundle reverse-engineering. No Base44 API key / eject / authenticated session was available in this environment, so entity RLS and server policies were not verified live.

**Not the same product as** FastAmps Connect (`6adf6de7ebdb4cb382e8779f`). Cadence is a small communication decision-support tool (meeting vs email vs async), not the installer claim programme.

## Verdict

**Internal MVP / early beta — not customer-ready.** The authenticated product is coherent and tightly scoped (3 pages, 1 entity, client-side scoring + LLM drafts). Before sharing outside a trusted group: finish the Cadence rename, decide invite vs open signup, hide the Base44 edit badge for end users, and confirm Base44 entity permissions so one user cannot read another’s decisions.

| Scope | Status |
|---|---|
| Product idea & meta description | Clear and accurate |
| Auth-gated Home / NewDecision / History | Built and wired |
| Public landing / acquisition | Missing (hard auth wall) |
| Branding consistency | Incomplete (CommDecide leftover) |
| Security (public surface) | Acceptable for private MVP; RLS unverified |
| Customer / self-serve launch | Not ready |

## What the product is

Cadence recommends **meeting**, **email**, or **async message** from a short intake wizard, then uses Base44 `InvokeLLM` to draft agenda / email / Slack-style copy. Users can save drafts to **History** and see efficiency stats (meetings avoided, channel mix).

**Authenticated pages** (from production bundle `index-BQoHtkdm.js`):

| Route | Page key | Role |
|---|---|---|
| `/` → Home | `Home` | Marketing-style hero + CTAs (behind auth) |
| `/NewDecision` | `NewDecision` | Wizard → score → LLM draft → save |
| `/History` | `History` | Past `CommunicationDecision` rows + archive |

Nav labels: Home · Start a new cadence · History · Logout.

**Data model (client-visible):** single entity `CommunicationDecision` with fields used in-app including `title`, `purpose`, `urgency`, `complexity`, `decision_type[]`, `stakeholder_count`, `emotional_risk`, `change_impact`, `cross_team_dependencies`, `communication_style`, `recommendation`, `confidence_score`, `rationale`, `meeting_length`, `meeting_cadence`, `participants`, `best_practices`, `time_saved_minutes`, `generated_agenda` / `generated_email` / `generated_message`, `status` (`draft` / `archived`).

**No custom Base44 functions** are invoked from the client. Decision scoring is a static class in the frontend; content generation calls `Yt.integrations.Core.InvokeLLM`.

## Architecture (condensed)

```
[Anon] cadence.base44.app
        → Base44 login shell (/login?from_url=…)
        → [Auth] Home
              → NewDecision (wizard)
                    → client DecisionEngine.score + applyDecisionRules
                    → InvokeLLM (agenda | email | async message)
                    → CommunicationDecision.create
              → History (list / archive via entity.update)
```

Evidence: [production-bundle-snippets.md](./cadence-evidence/production-bundle-snippets.md), [index.snippet.html](./cadence-evidence/index.snippet.html).

## What’s solid

- Tight scope: three pages, one entity, one job (“when to meet / message / email”).
- Meta / PWA / OG copy correctly describe the product.
- App CSS is **compiled** Tailwind (`index-CnLU3NpY.css`); not a CDN in the app bundle.
- Auth wall on `/`, `/Dashboard`-style unknowns, `/NewDecision`, `/History` for anonymous users.
- No hardcoded API secrets / JWTs found in the app JS bundle.
- LLM prompts are structured and channel-specific (meeting agenda vs email vs async).
- Mobile bottom nav + desktop top nav present.

## P0 — fix before wider sharing

### 1. Incomplete rename: footer still says CommDecide

Production Layout footer: `© 2024 CommDecide. Intelligent communication decision-support for leaders.` while title, PWA name, and hero say **Cadence**.

**Fix:** Replace CommDecide everywhere; bump year; align logo (circular crown asset vs blue→emerald square icon in nav).

### 2. Entity RLS / ownership unverified

Client calls `CommunicationDecision.list("-created_date", 200)` with **no client-side user filter**, and `update` by id for archive. Correctness depends entirely on Base44 entity permissions.

**Fix:** In Base44, confirm create/list/update are owner-scoped (or add server functions). Treat open list as a P0 data-exposure risk until proven otherwise.

### 3. Signup / invite policy unclear on login

Login shows “Need an account? Sign up” and “Forgot password?”. Public browse could not complete those flows (links bounced to login). For a private leadership tool, **invite-only** is usually safer than open signup.

**Fix:** Decide invite-only vs public signup; hide or wire the links accordingly; test password reset end-to-end.

## P1 — high

| ID | Issue | Notes |
|---|---|---|
| P1-1 | Hard auth wall with no public product story | Meta description is excellent; login only says “Welcome to Cadence / Sign in to continue”. Home’s real pitch is locked behind auth. |
| P1-2 | “Edit with Base44” badge on the live app | Signals staging / builder mode to every visitor. Hide for production end-users if the platform allows. |
| P1-3 | LLM prompt injection via free-text `title` / `purpose` / context | User text is interpolated into `InvokeLLM` prompts. Low business risk for a private tool, but drafts can be steered. Sanitize or constrain if multi-tenant. |
| P1-4 | `cancel_meeting` / `no_action` UI labels unused by engine | Scoring only emits `meeting` \| `email` \| `async_message`. Dead recommendation chrome confuses future edits. |
| P1-5 | Base44 login shell loads Tailwind CDN | Warning in console on `/login`. Platform-owned, not Cadence app CSS — still looks unfinished to anyone inspecting DevTools. |
| P1-6 | `postMessage({type:"app_changed_url"}, "*")` | Broadcasts URL changes to any parent. Fine in Base44 editor iframe; unnecessary on standalone publish. |

## P2 — polish

- Nav CTA “Start a new cadence” is long vs page title “NewDecision”.
- Copyright year `2024` while the live asset path timestamps look like late 2025/2026.
- Home feature cards sit behind login — either expose a public landing or accept this as an invite-only tool and drop acquisition expectations.
- `from_url` open-redirect surface is on the Base44 login host; rely on platform allowlisting (do not reimplement casually).
- Efficiency metrics (`meetingsAvoided`, `time_saved_minutes`) are heuristic, not measured — fine if labelled as estimates.
- No automated tests observable from the published bundle.

## Public surface checklist (5 Nov 2026)

| Check | Result |
|---|---|
| `GET /` | Redirects to `/login?from_url=…` |
| `/login` | Google + email/password; Cadence logo; Base44 edit badge |
| `/NewDecision`, `/History`, `/Dashboard` (anon) | Redirect to login |
| App JS | `/assets/index-BQoHtkdm.js` (~638 KB) |
| App CSS | `/assets/index-CnLU3NpY.css` (compiled) |
| Manifest | name Cadence; start_url `https://cadence.base44.app` |
| Hardcoded secrets in app bundle | None found |
| Screenshots | `/opt/cursor/artifacts/cadence-audit/*.webp` (agent run artifacts) |

## Recommended next moves

1. Confirm Base44 **CommunicationDecision** permissions (owner-only list/update).
2. Finish **Cadence** rename (footer, icons, any CommDecide strings).
3. Choose **invite-only vs open signup**; fix or remove broken auth links.
4. Hide **Edit with Base44** for the published audience.
5. Optional: thin public landing that reuses Home hero copy, then auth for the wizard.
6. Eject or sync source into git if you want PR-based review (this repo’s `main` is still README-only; Connect lives on other branches).

## Method & limits

- Observation-only browser pass of the anonymous surface.
- Static analysis of the published Vite bundle and HTML shell.
- Did **not** authenticate, call Base44 management APIs, or inspect sandbox source / entity JSON schemas directly.
- Platform login chrome (Mixpanel, Turnstile, Datadog public tokens in `/api/frontend-config.js`) is Base44’s, not Cadence application code.
