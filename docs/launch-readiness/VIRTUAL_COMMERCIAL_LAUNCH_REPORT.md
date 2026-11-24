# Executed virtual commercial launch report

Updated: 2026-11-24 (Europe/London)  
Baseline: `CONTROLLED_BETA_RELEASE_READINESS.md` (24 Nov 2026)  
Production: https://connect.fastamps.com  
Branch: `cursor/virtual-commercial-launch-fb1b`  
Artifact: `/opt/cursor/artifacts/virtual-commercial-launch.json`

## Verdict

**Virtual commercial launch simulation: PASS**

Genuine Links Electrical programme remains **draft / inactive**. No genuine charger codes created. UK live Giftbit payouts remain **0**.

## 1. Deployment integrity fix

| Item | Result |
| --- | --- |
| Root cause | `POST /deploy` could overwrite live entity schemas from stale git; SPA could also be replaced |
| Fix | `launch-readiness/simulation/src/deploy-preserve.mjs` + `DEPLOY_PRESERVE.md` |
| Post-deploy verify | SPA `index-Ct1Q8Oqd.js` contains `/welcome`, `/pre-register`, `/admin/programmes`; Installer schema retains `membership_status` + deferred welcome |

## 2. Accidental eligibility-probe claim

| Item | Detail |
| --- | --- |
| Claim id | `6b05d3017d2d919fa5cf34a6` (QA-LAUNCH-2026-W2-S00047) |
| Root cause | Schema overwrite prevented `membership_status=pre_registered` from persisting; defaulted to active; claim created |
| Current state | `reward_status=held`, `is_demo=true`, `excluded_from_reporting=true` |
| Earnings liability | **None** — 0 linked `Earning` rows |
| Permanent harden | Claim submitters check membership **before** charger reserve; also fail closed on held pre-reg reason / deferred welcome without activation |
| Retest | Pre-reg probe → HTTP **403**, **0** new claims, charger remains `available` |

## 3. QR independence

| Type | URL / behaviour | Result |
| --- | --- | --- |
| A Marketing | `https://connect.fastamps.com` → `/welcome` | PASS |
| B Invitation | `/invite/links-electrical-shrewsbury` | PASS — genuine programme `draft`, `active:false` |
| C Charger | `/claim/{token}` for VIRTUAL-LINKS codes | PASS — distinct tokens; not invite URLs |

## 4. Virtual Links programme + 200 chargers

| Item | Value |
| --- | --- |
| Programme code | `links-virtual-sim-2026` (active, `is_demo`, excluded) |
| Genuine programme | `links-electrical-shrewsbury` still **draft** |
| Chargers | **200** `VIRTUAL-LINKS-2026-S*****` with QR claim tokens |
| Batch | Isolated virtual simulation — not manufacturing stock |

## 5. 300-person simulation results

| Cohort | Count |
| --- | --- |
| Pre-registered (demo/excluded demand identities) | **250** |
| Active authenticated QA installers | **50** |
| Total identities | **300** |
| Installation claims submitted | **200** |
| Claims approved (rewards held) | **200** |

Realistic activity covered: nationwide pre-registration demand, virtual programme claims, admin approval, welcome-bonus once-only samples, redemption-path Giftbit USD Testbed sample.

## 6. Financial reconciliation

| Ledger | Amount / count |
| --- | --- |
| Virtual install claims @ £10 (held, demo/excluded) | 200 × £10 held — **not payable** |
| Welcome bonus issued samples (status=`issued`) | 10 installer samples — remains issued (no double grant) |
| UK live Giftbit campaigns | **0** |
| Giftbit USD Testbed samples delivered | **1** |
| Genuine Links payouts | **0** |

## 7. Giftbit USD Testbed evidence

| Field | Value |
| --- | --- |
| Order id | `fastamps-virtual-usd-b058d788-553c-48a2-a956-f3c4c434647f` |
| HTTP | 200 |
| Provider | Campaign created (`API_CREATING` → gift `SENT_AND_REDEEMABLE`) |
| Delivery status | **DELIVERED** |
| Brand | `amazonus` |
| Recipient | JP approved admin email (CONNECT_QA_ADMIN_EMAIL) |
| Notes | USD Testbed only — not UK production proof |

Raw gift payload: `/opt/cursor/artifacts/giftbit-virtual-sample.json`

## 8. Welcome bonus once-only

Atomic voucher path already compares `welcome_reward_status=available` before moving to `redemption_requested` / `issued`. Simulation marked 10 active QA profiles to `issued` and confirmed they remain `issued` (no automatic re-grant).

## 9. Copy tightening

Welcome / pre-register / interest-list dashboard copy shortened for clarity (less secondary prose, clearer CTAs). Published in `index-Ct1Q8Oqd.js`.

## 10. Defects found and fixed during this run

| Defect | Fix | Retest |
| --- | --- | --- |
| Published SPA lost controlled-beta routes | deploy-preserve + deploy-dist | Markers present |
| Schema wipe risk on deploy | Re-push schemas after every `/deploy` | membership_status present |
| Eligibility probe claim creation | Fail-closed eligibility before reserve + dual signals | 403, 0 claims |
| Virtual charger PIN collisions at 100 | Random unique PIN allocator vs full register | 200 chargers imported |
| Giftbit payload shape | Use `marketplace_gifts: [{id, price_in_cents}]` | DELIVERED |
| QA cohort password env mismatch | Use `CONNECT_QA_INSTALLER_PASSWORD_TEMPLATE` secret for installer01–50 | 50/50 logins |

## 11. Independent release verification (post-simulation)

| Check | Result |
| --- | --- |
| SPA asset | `assets/index-Ct1Q8Oqd.js` |
| Welcome / pre-reg routes in SPA | PASS |
| Genuine Links invite | `draft` / inactive |
| Virtual programme | active (demo/excluded only) |
| Membership eligibility harden | PASS |
| UK live payouts | 0 |

## 12. Outstanding external dependencies (unchanged)

1. Edd authorisation + JP genuine serial/PIN file  
2. Email DNS for `no-reply@connect.fastamps.com` (OTP still works via Base44)  
3. JP explicit activation of genuine Links programme  
4. Live GBP Giftbit funds/permissions  

## GO / NO-GO (unchanged for genuine beta)

| Gate | Decision |
| --- | --- |
| Virtual simulation readiness | **PASS** |
| Nationwide pre-registration (technical) | **CONDITIONAL GO** |
| Genuine Links commercial beta | **NO-GO** (draft; awaiting Edd + JP) |
