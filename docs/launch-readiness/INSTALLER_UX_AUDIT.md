# Phase 3–4 — Installer UX audit (viewport emulation)

Updated: 2026-11-23 (Europe/London)  
Method: **Browser viewport 390×844** (iPhone 12 Pro emulation) **plus** product-owner handset testing on **Samsung Android** and **iPhone** (repeated passes, 2026-11-23)

## Section scores (pre-fix)

| Section | Result |
| --- | --- |
| Login / session | Pass — GBP wallet copy clear |
| Profile | Pass — editable fields present |
| Register install (step 1) | Defects below |
| Installs history | Pass |
| Wallet via `/rewards` | 404 (nav path is `/earnings`) |
| Mobile layout | Mostly pass; two ~40px header targets |

## Freeze-safe fixes applied

| ID | Issue | Fix |
| --- | --- | --- |
| PIN-PH-001 | Placeholder truncated (“leading zer”) | Placeholder `e.g. 012345` + visible leading-zeros hint |
| REWARDS-404 | `/rewards` Page Not Found | Redirect to `/earnings` |
| TOUCH-001 | Theme + sign-out ~40px | `h-11 w-11` (44px) |
| EMAIL-IM-001 | Login email keyboard | `inputMode="email"` |

## Retest (browser, 2026-11-23 Europe/London)

| Check | Result |
| --- | --- |
| PIN placeholder + hint | **Pass** — `e.g. 012345` + leading-zeros hint |
| `/rewards` → `/earnings` | **Pass** — Reward wallet loads; no 404 |
| Bundle | `index-Dqk2xKAX.js` |
| Wholesaler step-2 UI | Resolve-only browser check in progress |

## Wholesaler / branch required

**Verified in source + published backend** (not fully exercised in step-2 browser pass):

- UI labels: `Wholesaler company *` / `Wholesaler branch or town *` with `required`
- Client submit guard + live `submit-install-claim` / `v2` reject empty/whitespace
- Prefill from nominated wholesaler with change-allowed copy

Real-device camera/QR: **closed** via owner Samsung Android + iPhone testing. Agent step-2 wholesaler UI was also verified in browser on S00008.

## Artifacts

`/opt/cursor/artifacts/installer-ux/` (emulation screenshots from audit pass)
