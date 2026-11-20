# FastAmps Connect — Launch Readiness Report

**Generated:** Friday 20 November 2026, afternoon (Europe/London)  
**Updated:** Friday 20 November 2026 — follow-up from codepath audit  
**Application:** https://connect.fastamps.com  
**Pilot window:** Monday 23 – Tuesday 24 November 2026  
**Initial rollout:** One electrical wholesaler + real installers  
**Agent:** `launch-readiness/` (Agent SDK QA agent in this repository)

---

## Executive summary

FastAmps Connect is a live Base44 web/PWA at **connect.fastamps.com**. Production already includes the QR trade-show retirement work (no `TRADE-SHOW` / `demo=1` / `trade_show` auto-claim paths in the live bundle), claim-path session resume, and PIN withheld on the anonymous claim gate. Local unit and import harnesses pass, including a synthetic **500 unique serial/PIN** import.

Follow-up from the static codepath audit closed the Critical proof-docs / wallet gap in source (server + Earnings UI), removed the misleading free Alpha 7 tile, hid unfinished More-menu surfaces for pilot, added `AdminRoute`, hardened bootstrap query persistence, and tightened password / mobile / camera capture polish. **These fixes still require Base44 publish** to affect production.

**Authenticated installer and admin end-to-end runs were not completed in this environment** (no pilot credentials / Base44 secrets). Giftbit live GBP funding is not confirmed. Native App Store / Play Store packages do not exist — launch as **mobile web**, not as a published store app.

### Decisions (20 Nov 2026)

| Track | Decision |
| --- | --- |
| Controlled wholesaler pilot | **CONDITIONAL GO** |
| Android / Google Play submission | **NO-GO** (Blocked — not a native package) |
| iOS / Apple App Store submission | **NO-GO** (Blocked — not a native package) |

**Pilot condition:** Before Monday installer onboarding, complete authenticated regression with dedicated test admin + installer accounts, confirm one physical trade-show/website QR opens only `https://connect.fastamps.com`, run one labelled admin import of the wholesaler pilot batch, and keep Giftbit live sends held/manual until UK funds readiness is confirmed.

---

## Application health

| Area | Status | Notes |
| --- | --- | --- |
| Installer journey | **Blocked** | Public auth pages up; signed-in claim/wallet not E2E-verified here |
| Admin journey | **Blocked** | Admin UI/API role checks present in code/prod bundle; live admin login not run |
| Code registration | **Pass** | Prod QR claim path + local resolve/import tests; trade-show shortcuts absent in live JS |
| Photo uploads | **Blocked** | Two-photo claim flow present in source; camera/upload not exercised on device here |
| Incentive and wallet | **Pass** | Rules encoded; proof-docs gate now enforced in `request-voucher-v2` + Earnings (pending publish) |
| Giftbit integration | **Fail** | Testbed GBP limitation known; live funds not verified — do not treat as ready to pay |
| Security and permissions | **Pass** | Admin role gates in UI; backend import/voucher functions require admin; no cross-account testing with two installers yet |
| Mobile usability | **Pass** | Responsive auth/app shell; PWA standalone; icon branding fix pending publish |
| Google Play readiness | **Blocked** | Web/PWA only |
| Apple App Store readiness | **Blocked** | Web/PWA only |

---

## Issues

| ID | Severity | Status | Workflow | Blocks pilot | Description | Action taken | Verification | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E2E-AUTH-001 | Critical | blocked | full pilot simulation | Yes | No pilot test credentials / Base44 secrets in this environment — authenticated journeys not executed | Anonymous probes, production bundle analysis, source audit, unit tests only; no production data mutation | `probe_url` 200 on `/`, `/login`, `/register`; `agent-sdk whoami` unsigned | Dedicated pilot admin + installer accounts; Monday regression |
| QR-PROD-001 | Critical | verified | QR / charger registration | No (resolved) | Trade-show auto-claim must not remain in production | Confirmed live bundle clean | `index-VjhfXl0Z.js`: TRADE-SHOW=0, demo=1=0, trade_show=0; claim gate shows model+serial only | Spot-check one physical printed website QR |
| IMPORT-500-001 | High | verified | admin charger import | No (resolved in harness) | Historical 500-code import/download failure risk | Extended `tests/chargerCsvImport.test.mjs` with PILOT-500-SYNTH | `npm test` → `pilot_csv:500`, `pilot_500_unique:true` | One live admin import of labelled pilot batch |
| GIFTBIT-GBP-001 | High | open | incentive fulfilment | No* | Giftbit Testbed cannot fund GBP; live UK funds unconfirmed | No live sends; code/UI already avoid marking failed campaigns as sent | Prod Admin Vouchers + `admin-voucher-action` funds/error handling | Approve live Giftbit funds; run admin “Giftbit UK readiness”; prefer manual/held redemptions for pilot |
| STORE-NATIVE-001 | High | open | App Store / Play Store | No | Not a native store app | Documented mobile-web vs store; PWA meta polish | Vite/Base44 SPA; no ios/android native projects | Only if native packaging is later required |
| PWA-ICON-001 | Medium | fixed | mobile PWA branding | No | Live manifest still uses Base44 `logo_v2.svg` | Updated `public/manifest.json` + apple-touch-icon meta | Live manifest still old until publish; repo fixed | Base44 publish of this branch |
| BETA-HOST-001 | Medium | open | beta environment | No | `connect-test` not confirmed as isolated Connect runtime; legacy `fastamps-connect-v1.base44.app` 404 | Documented | probe 302→/login; connect-test serves Monaco editor shell titled “FastAmps Connect Test” | Publish true isolated test deployment |
| PROOF-DOCS-001 | Critical | fixed | incentive fulfilment | No (resolved in source) | Terms required FastAmps-approved proof docs before wallet claim, but voucher path did not check | Enforce `hq_training_completed` or `certificates_received` in `request-voucher` / `request-voucher-v2` and Earnings `canRequest` | Source updated; unit suite still green | Base44 publish + admin training verification SOP for pilot redeemers |
| ALPHA7-TILE-001 | High | fixed | installer dashboard | No | “20 installs unlock a free Alpha 7” had no fulfilment backend | Removed progress tile; kept £10+£10 offer card with monthly approved count | Source updated | Base44 publish |
| MORE-MENU-001 | High | fixed | installer navigation | No | Academy / Opportunities / Leaderboard / Coach exposed unfinished surfaces | Removed from installer More menu (routes retained for deep links) | Source updated | Base44 publish |
| ADMIN-ROUTE-001 | High | fixed | security / permissions | No | Admin URLs mounted for any signed-in user | Added `AdminRoute` wrapper + AdminOverview role guard | Source updated | Base44 publish |
| MOBILE-DUP-001 | High | fixed | registration / profile | No | Profile could change mobile without duplicate check | `register-installer` `check_mobile` action + Profile pre-save check | Source updated | Base44 publish backend function |
| BOOTSTRAP-001 | Medium | fixed | security | No | Query `app_id` / `app_base_url` / `functions_version` / token could persist into localStorage | Ephemeral bootstrap params no longer persisted from arbitrary query strings | Source updated | Base44 publish |
| PHOTO-CAPTURE-001 | Medium | fixed | photo uploads | No | Install photo inputs lacked `capture="environment"` | Added on serial + install file inputs | Source updated | Base44 publish; retest on iOS/Android |
| AUTH-POLISH-001 | Medium | fixed | login / password reset | No | Forgot-password email not lowercased; reset lacked 8-char minimum; claim returnTo dropped on forgot-password | Normalise email, minLength 8, preserve returnTo | Source updated | Base44 publish |

\*Does not block registering installs and holding rewards; **does** block automatic Giftbit payouts.

---

## Evidence (Friday 20 Nov)

### Live availability

- `https://connect.fastamps.com` → 200, FastAmps Connect shell (`appId` `6adf6de7ebdb4cb382e8779f`)
- `/login`, `/register` → 200
- `/manifest.json` → 200 (icons still Base44 until publish)
- `https://fastamps-connect-v1.base44.app` → 404 App not found
- `https://connect-test.fastamps.com` → 302 `/login`

### Production bundle (QR / claim)

- Asset: `/assets/index-VjhfXl0Z.js`
- Trade-show shortcuts removed from client bundle
- `fastamps_pending_claim` session resume present
- Unauthenticated “Your charger is ready” shows model + serial (PIN withheld)

### Automated tests (this branch)

```text
npm test → 6/6 pass
chargerCsvImport: large_csv 1200 + pilot_csv 500 unique + duplicate retry rejected + rollback
```

### Safe fixes applied in repo (not yet live until Base44 publish)

1. PWA icons → FastAmps assets in `public/manifest.json`
2. Apple touch icon + web-app meta in `index.html`
3. Explicit 500-row pilot import assertions in `tests/chargerCsvImport.test.mjs`
4. Dedicated Agent SDK agent under `launch-readiness/` with probe/issue/health/report tools and weekday health schedule
5. Proof-docs / training approval gate on voucher request (v1 + v2) and Earnings UI
6. Removed free Alpha 7 dashboard tile; hid unfinished More-menu items for pilot
7. `AdminRoute` + AdminOverview admin guard
8. Profile mobile duplicate check via `register-installer` `check_mobile`
9. Bootstrap query hardening in `app-params.js`
10. Camera `capture="environment"` on install photos; password-reset polish

Codepath audit credit: [Audit Connect critical codepaths](bc-4747c9c1-0434-52e5-874d-8fd1d513891d). Prior transcript mining ([Summarize playground workflow transcript](bc-ff0479fb-e7f6-54ab-ae6b-e2d69430d432), [Summarize Base44 login transcript](bc-458d646d-81f1-539b-9994-27843e437a82)) confirmed Base44 device-login dependency and that Playground work is unrelated to Connect.

### Not performed (by design / access)

- Creating real installer accounts or production chargers
- Live Giftbit campaigns or wallet mutations
- Store console submissions
- Signing / TestFlight / Play internal testing

---

## One-wholesaler pilot runbook (existing product only)

1. Admin prepares wholesaler pilot CSV (serial + 6-digit PIN), validates, imports with a clear batch reference.
2. Activate/print charger label QRs that resolve to `/claim/{token}` on **connect.fastamps.com**.
3. Trade-stand / marketing QR prints **only** `https://connect.fastamps.com`.
4. Installer registers or signs in → completes serial/PIN or QR claim → uploads two photos.
5. Admin reviews evidence; demo/HOME-BETA/TRADE-SHOW historical rows must never pay.
6. Wallet progress updates under existing rules; first voucher needs three unique approved installs and £30 available balance.
7. Keep Giftbit sends manual/held until live UK readiness is confirmed.

---

## Mobile web vs store apps

| Capability | Status |
| --- | --- |
| Mobile web at connect.fastamps.com | Suitable for controlled pilot |
| PWA “Add to Home Screen” | Partial — works as standalone web; icon branding pending publish |
| Google Play downloadable app | **Not ready** — no Android package, signing, or listing |
| Apple App Store downloadable app | **Not ready** — no iOS package, certificates, TestFlight, or listing |
| Account deletion | Present in Profile (`delete-account` function) — helpful if native packaging comes later |

**Do not claim the app is published or approved on either store.**

---

## Monday 23 Nov — required before onboarding

1. Authenticated installer registration + claim with a labelled test charger.
2. Authenticated admin review of that claim.
3. Wholesaler pilot batch import (or confirmed already imported) with uniqueness check.
4. Physical QR spot-checks (website QR + one charger label).
5. Giftbit decision: manual fulfilment vs live send with funds confirmed.
6. Publish this branch’s PWA icon fix via Base44.

## Tuesday 24 Nov — early operation

Watch genuine installer submissions, photo quality, duplicate claims, and voucher requests. Fix only launch defects. Do not expand features.

---

## Agent usage

```bash
cd launch-readiness
npx @grok/agent-sdk validate --dir .
npx @grok/agent-sdk tool call probe_url --dir . --input '{"url":"https://connect.fastamps.com"}'
npx @grok/agent-sdk login   # once, for model turns / eval
npx @grok/agent-sdk run --dir . --message "Run Friday launch health and refresh the report."
npx @grok/agent-sdk eval --dir .
```

Model turns need a Cursor credential. `validate`, `tool call`, and `info` do not.
