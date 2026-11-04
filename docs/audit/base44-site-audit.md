# FastAmps Connect — Base44 site audit

**Date:** 4 Nov 2026 (Europe/London)  
**Scope:** Ejected Base44 app on `cursor/repair-qr-registration-flow-2436` (app id `6adf6de7ebdb4cb382e8779f`)  
**Live:** https://connect.fastamps.com  
**Builds on:** [QR registration root-cause](./qr-registration-root-cause.md) and the repair work in PR #1

## Verdict

Installer **claim programme** is **conditionally go-live ready**. Ship claim + installs + rewards + admin review only. Hide Academy / Opportunities / Leaderboard / Coach until content and incentives are real. Fix the proof-docs redemption gate and remove or fulfil the free Alpha 7 claim before broad installer rollout.

| Scope | Status |
|---|---|
| Claim journey (QR → register → dual photos → submit) | Ready with conditions |
| Installs + admin review / fraud / vouchers / QR batches | Ready |
| Earnings wallet | Fix docs gate first |
| Academy / Opportunities / Leaderboard / Coach | **Not ready — hide** |
| Full marketplace suite | Not ready |

## What’s solid

- Claim → auth → dual-photo submit path (`ChargerClaimEntry`, `SubmitInstall`, `authReturnTo`)
- Auth branding (navy / FastAmps blue) and mobile shell (tabs, safe-area, More drawer)
- Admin ops spine: review installs, QR batches, vouchers, fraud hold, reports
- Open-redirect hardening on `returnTo` (tested)
- CSV import trust boundary is server-side admin-only with collision/history checks
- Prior QR repair: trade-show contamination removed, PIN hidden pre-login, claim path preserved across auth

## P0 — fix before broad rollout

### 1. Proof-of-approval docs promised but not enforced at redemption

Terms (`ProgrammeTerms.jsx` §5) and Profile say the wallet cannot be claimed until docs are uploaded and FastAmps-approved. Onboarding allows empty docs. `request-voucher-v2` and `Earnings.canRequest` never check `approval_documents` / approval status.

**Fix:** Enforce in `request-voucher-v2` + client `canRequest`, **or** rewrite terms/Profile copy to match current behaviour.

### 2. Dashboard sells an unbacked “free Alpha 7” incentive

`Dashboard.jsx` shows “20 installs unlock a free Alpha 7” with a progress bar and no wallet/admin fulfilment path.

**Fix:** Remove the claim, or implement a tracked reward + admin fulfilment.

### 3. Marketplace suite exposed while unfinished

`Layout.jsx` `installerMoreItems` exposes Academy (checkbox-only, cash paused), Opportunities (empty), Leaderboard (RLS-broken / privacy risk), Coach (orphaned chat).

**Fix:** Hide behind a feature flag or remove from More until real.

## P1 — high

| ID | Issue | Where |
|---|---|---|
| P1-1 | Bootstrap param poisoning: `app_id` / `app_base_url` / `functions_version` / `access_token` from query → `localStorage` | `src/lib/app-params.js` |
| P1-2 | Admin routes not role-gated in router; `AdminOverview` has no own role check | `App.jsx`, `AdminOverview.jsx` |
| P1-3 | Profile mobile self-update bypasses `register-installer` uniqueness checks | `Profile.jsx` |
| P1-4 | Photo inputs lack `capture="environment"` (gallery-first on phones) | `SubmitInstall.jsx` |
| P1-5 | Beta test / QA lead admin nav ahead of live review tools | `Layout.jsx` `adminNav` |
| P1-6 | `connect-test.fastamps.com` still Base44 editor shell — no isolated beta DB | Environment |
| P1-7 | Leaderboard empty under Installer RLS; would leak names/regions if opened | `Leaderboard.jsx`, `Installer.jsonc` |

## P2 — polish

- MFA helpers in `authMfa.js` unused by Login / SocialAuthButtons
- Client-trusted photo GPS; admin claim approval via browser `entity.update`
- PWA icon still `base44.com/logo_v2.svg`; fonts are system defaults
- Desktop “Rewards” vs mobile “Wallet” for `/earnings`
- Dead deps: three, stripe, leaflet, quill, confetti, dnd, lodash, moment, react-markdown, react-hot-toast
- `OAuthConsent.jsx` unrouted
- Legacy serial+PIN-in-URL still supported (`qrPayload` class C)

## Recommended next moves

1. Align proof-docs policy (server enforce or rewrite copy).
2. Remove or implement free Alpha 7 incentive.
3. Hide unfinished More-menu features.
4. Add `AdminRoute`; stop persisting bootstrap params from arbitrary query strings in production.
5. Camera-first photo capture; unify Rewards/Wallet label; demote Beta/QA in admin nav.
6. Point `connect-test.fastamps.com` at an isolated published test app.
7. Merge or close GitHub PR #1 so `main` is not README-only while production runs repaired code.

## Architecture (condensed)

```
[QR /claim/{token}]
        → ChargerClaimEntry (anon resolve, no PIN)
        → auth (returnTo + sessionStorage stash)
        → SubmitInstall → submit-install-claim-v2
        → AdminInstalls / Fraud / Vouchers
```

**Entities:** User, Installer, Charger, ChargerCodeHistory, InstallClaim, VoucherRequest, Earning, Opportunity, Course, CourseProgress, WholesalerBranch, QrLabelTemplate, QrLabelDesignReview, RewardReviewAudit, QaTestResult

**Tests today:** `authReturnTo`, `qrPayload`, `appUrl`, `parseChargerCsv`, `chargerCsvImport`, `resolveChargerClaim` — no React/page or submit-claim-v2 coverage.
