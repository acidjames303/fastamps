# Phase 1 baseline — PR #10 evidence audit

Updated: 2026-11-23 (Europe/London)  
Source: [PR #10](https://github.com/acidjames303/fastamps/pull/10) + live Connect API re-check

## Evidence classification legend

| Tag | Meaning |
| --- | --- |
| **API** | Live Base44/Connect HTTP against production app |
| **Browser** | Real browser UI (partial — see gaps) |
| **Harness** | External Node/Python QA scripts |
| **Provider** | Actual Giftbit Testbed HTTP |
| **Untested** | Not yet verified for V1 launch |

## Confirmed checklist

| Criterion | Status | Evidence type | Notes |
| --- | --- | --- | --- |
| 20 independently authenticated synthetic installers | **Met** | API + Harness | Mailosaur OTP register/verify for installer01–20 |
| ≥400 valid charger registrations | **Exceeded** | API + Harness | **1200** cohort claims (60×20) + 5 earlier pilot = **1205** |
| Photographs uploaded and associated | **Met (URL)** | API | Both `serial_photo_url` + `install_photo_url` on all 1205; harness used HTTPS assets (not always device camera captures) |
| Concurrent installer activity | **Met (synthetic)** | Harness | Ramp 1→2→5→10→20 ThreadPool / Promise concurrency |
| Admin approval / rejection | **Partial** | API + Browser (in progress) | Entity updates mirroring AdminInstalls; **1201 approved**, **2 reject**, **2 needs_information**. Admin UI now lists all claims with search + include-excluded toggle (deployed); browser photo sample in progress |
| Wallet safeguards | **Met** | API | Eligible wallet **£0**; demo/exclusion + reward hold intact |
| Giftbit testing safe | **Met** | Provider | GBP → `FUNDS_REQUIRED` (no delivery). USD $10 Amazon Testbed → `CAMPAIGN_CREATED` (isolated harness; not UK wallet) |
| Three consecutive clean regression cycles | **Partial** | Harness | Three claim waves (C2/C3/C4) **0 submit fails**. Full critical UI regression triad after every fix **not** yet closed |
| Critical security / data integrity open | **None known blocking claim path** | API / source | Demo guards intact; live Giftbit still **NO-GO** for UK auto-fulfililment |

## What was *not* proven by backend success

- Human electrician usability on real phones (camera, keyboard, offline).
- Admin UI photo review comfort at thousands of rows (browser check outstanding).
- Production GBP Giftbit delivery (Testbed cannot fund GBP).
- USD Testbed email inbox delivery (campaign created; Mailosaur empty in first ~40s poll — recheck pending).
- Wholesaler/branch **required** enforcement historically missing (fix landing this phase).

## Live re-check snapshot (API)

| Metric | Value |
| --- | --- |
| QA claims | 1205 |
| Approved / rejected / needs info | 1201 / 2 / 2 |
| Reward held / rejected | 1203 / 2 |
| Both photos present | 1205 |
| Still demo + excluded | 1205 / 1205 |
| Live bundle | `index-sfvJjKvU.js` — £10/£30 present; no USD wallet strings; admin search/toggle live |

## Freeze-safe corrections started this phase

1. Require wholesaler company + branch on install submit (UI + `submit-install-claim` / `v2`) — **published**.
2. Isolated USD Giftbit Testbed probe (external harness only — UK production remains GBP).
3. Admin installs search + include demo/excluded QA toggle — **published**.

## Interim launch posture

**CONDITIONAL GO** for Links Electrical Shrewsbury 200-charger pilot **pending**:

- Browser admin + installer UX verification complete.
- Explicit acceptance that UK Giftbit auto-send remains manual/held until live GBP funds confirmed.
- Optional larger 50×20 stress in isolated environment (not disruptive live load).
