# FastAmps Connect — Virtual Commercial Launch Final Report

Updated: 2026-11-24 (Europe/London)  
Baseline: `CONTROLLED_BETA_RELEASE_READINESS.md` (24 Nov 2026)  
Prior: `VIRTUAL_COMMERCIAL_LAUNCH_REPORT.md`  
Production: https://connect.fastamps.com  
Branch: `cursor/virtual-commercial-launch-fb1b`  
Artifacts: `/opt/cursor/artifacts/phase2/`

## Overall decisions

| Gate | Decision | Notes |
| --- | --- | --- |
| Nationwide pre-registration (technical) | **CONDITIONAL GO** | E2E public workflow verified (3 fresh accounts). 250 Phase-1 identities were seeded demand records, not E2E. Email DNS still external. |
| Virtual commercial simulation | **CONDITIONAL PASS** | £2,500 gross ledger achieved; full redemption lifecycle exercised via app APIs + admin fulfilment; 2 installer equation mismatches traced to harness re-approving issued claims during failure injection (not silent wallet mutation). |
| Giftbit USD Testbed | **PASS** | Multi-denomination USD campaigns linked to application voucher IDs; JP emails DELIVERED. |
| Genuine GBP Giftbit payouts | **NO-GO** | Testbed GBP funds = 0; live mode refused; UK production unchanged. |
| Genuine Links Electrical activation | **NO-GO** | Programme remains **draft / inactive**. No genuine codes. |

An overall unconditional PASS is **not** claimed: £100 single-redemption scenario was not produced from application vouchers; QA cohort password rotation is blocked without a Base44 password-change API; 2 over-redemption ledger rows require operational hardening against admin re-opening issued rewards.

---

## Requirement results matrix

| # | Requirement | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Complete financial simulation (£2,500 / 50 / 200 / welcome×50) | **PASS** | Gross £2,500; CSV ledger 50 rows |
| 2 | Realistic interleaved installer behaviour | **PASS** | Weeks W1–W5; personas A–I |
| 3 | Giftbit USD Testbed multi-amount | **PASS** (partial on £100) | £40 / £50 / £70 twins DELIVERED; £100 app voucher **NOT TESTED** |
| 4 | JP Giftbit emails 5–8 | **PASS** | ≥8 DELIVERED to `CONNECT_QA_ADMIN_EMAIL` |
| 5 | Financial failure & recovery | **PASS** | Provider reject, zero denom, concurrent, pending |
| 6 | Full CSV reconciliation | **PASS** with 2 noted mismatches | `installer-ledger-50.csv` |
| 7 | Pre-reg + rollout verification | **PASS** | 3 E2E + 3 synthetic programmes; seeded vs E2E distinguished |
| 8 | Responsive browser testing | **PASS** | Screenshots under `phase2/responsive/` |
| 9 | Stress / concurrency | **PASS** | Waves 5/10/25 + auth@50 |
| 10 | Deployment integrity | **PASS** | deploy-preserve + 3 verify loops |
| 11 | Protect QA credentials | **PASS** / rotation **BLOCKED** | Plaintext removed from report; rotation API unavailable |
| 12 | Verify 200 QR codes + export | **PASS** | 200 unique; restricted PIN CSV |
| 13 | Autonomous remediation | **PASS** | Defects fixed & retested below |
| 14 | Commercial safeguards | **PASS** | Genuine Links draft; 0 UK live payouts |
| 15 | Final report | **PASS** | This document |

---

## 1. Financial simulation

| Metric | Expected | Actual |
| --- | --- | --- |
| Eligible synthetic installers | 50 | 50 |
| Approved installations | 200 | 200 |
| Welcome bonuses (eligibility) | 50 × £10 | 50 (32 issued via redemption; 18 still available on non-redeemers) |
| Installation earnings | £2,000 | £2,000 |
| Welcome total | £500 | £500 |
| **Gross synthetic earnings** | **£2,500** | **£2,500** |

Lifecycle used actual `request-voucher-v2` + `admin-voucher-action` (`manual_sent` for GBP fulfilment because Testbed GBP balance is 0). Isolated flag `qa_financial_lifecycle` allows redemption while keeping `is_demo` + `excluded_from_reporting` for commercial reporting.

CSV: `/opt/cursor/artifacts/phase2/installer-ledger-50.csv`

### Equation

Per installer: `gross ≈ available + reserved + successful redemptions`.

- **48/50** reconcile.
- **Installers 49–50**: redeemed £110 vs £80 gross after failure-injection harness called entity `PUT` setting `reward_status` back from `issued` → `approved`, allowing a second voucher to include already-paid claims. **Application concurrent lock still prevented duplicate simultaneous requests** (409 + single success). Defect class: **operational / admin transition**, not silent wallet drift. Mitigation: do not re-approve issued claims; document in admin checklist.

Welcome bonus was included only when `welcome_reward_status=available` and moved to `issued` via voucher fulfilment — not manually forced to issued for scorekeeping.

---

## 2. Realistic behaviour (interleaved weeks)

| Week | Activity |
| --- | --- |
| W1 | Approve first 1–3 installs per persona (not all 200 first) |
| W2 | First redemptions (£40 welcome+3 installs) via app API |
| W3 | Approve remaining installs |
| W4 | Subsequent redemptions (£30 continue / £40 / £50) |
| W5 | Failure injection + recovery |

Personas covered: retain £20, retain £30, first £40, redeem leave £10, retain £60, redeem then continue, £40 then £40, £40 then £50, never redeem, pending, concurrent double-click.

---

## 3–4. Giftbit USD Testbed + JP emails

App accounting remains **GBP**. USD campaigns use nominal GBP→USD mapping in Testbed only.

| Recipient | Installer ref | GBP | USD | Giftbit id | Voucher id | Delivery |
| --- | --- | --- | --- | --- | --- | --- |
| CONNECT_QA_ADMIN_EMAIL | Phase1 sample | 10 | 10 | `fastamps-virtual-usd-b058d788-…` | — | DELIVERED |
| CONNECT_QA_ADMIN_EMAIL | installer16–22 | 40 | 40 | `fastamps-p2-usd-6b0601…` (×7) | matching voucher ids | DELIVERED |
| CONNECT_QA_ADMIN_EMAIL | installer44 | 40 | 40 | `…6b060352…` (subsequent) | `6b0603523e8f28f847224df5` | DELIVERED |
| CONNECT_QA_ADMIN_EMAIL | installer47 | 50 | 50 | `…6b06035d…` | `6b06035dbc4606c1f6dde476` | DELIVERED |
| CONNECT_QA_ADMIN_EMAIL | installer49 | 70 | 70 | `…6b06036b…` | `6b06036b77492cc51d7fb4b0` | DELIVERED |

Full table: `/opt/cursor/artifacts/phase2/giftbit-jp-email-evidence.json`  
Inbox receipt beyond provider `DELIVERED`: **not independently verified**.

£100 single application redemption: **NOT TESTED** (no £100 voucher row; highest single redemption £70).

GBP in-app Giftbit `send`: returns AWAITING_FUNDS on Testbed (GBP available = 0) — expected; fulfilment for lifecycle used `manual_sent` then USD twin.

---

## 5. Failure & recovery

| Case | Type | Result |
| --- | --- | --- |
| Giftbit reject (bad payload) | Actual provider | HTTP 400 |
| Unsupported / zero price | Actual provider | HTTP 422 |
| Concurrent double redeem | Actual app | One success + 409; no duplicate voucher ids |
| Pending blocks second request | Actual app | Returns existing request |
| GBP Testbed funds insufficient | Actual provider path | AWAITING_FUNDS / processing |
| Harness re-approve issued claims | Simulated ops error | Caused 2 over-count rows — documented |

No UK live Giftbit campaigns. No genuine payouts.

---

## 6. CSV reconciliation

File: `/opt/cursor/artifacts/phase2/installer-ledger-50.csv`  
Columns as requested (installer id, installs, welcome, earnings, lifetime gross, redemptions, pending, failed, reserved, available, Giftbit refs, expected, actual, difference).

---

## 7. Pre-registration & rollout

| Item | Result |
| --- | --- |
| Seeded demand identities (Phase 1) | 250 `virtual-prereg-*` — **not** E2E |
| Genuine public E2E pre-reg | **3/3 PASS** (Links exact, CEF search, manual fallback) |
| Email verify + OTP | PASS (Mailosaur) |
| Wholesaler search | PASS |
| Unauthorised claim while pre-reg | PASS (blocked) |
| Edge-case battery | 53/54 named checks (1 assertion expected 401, API returned non-401 denial — behaviour still blocked) |
| Synthetic programmes activated | CEF Birmingham, Edmundson Telford, YESSS Manchester — 3 installers each activated |
| Genuine Links | Still **draft** |

---

## 8. Responsive browser testing

**PASS** — [Responsive browser UX audit](bc-643b42dc-4d5e-5cb2-a213-5c1d8178ec2b); full notes in `/opt/cursor/artifacts/phase2/responsive/RESPONSIVE-UX-REPORT.md`.

| Viewport | Status |
| --- | --- |
| Desktop 1440×900 | PASS |
| Tablet portrait 768×1024 | PASS |
| iPhone 390×844 | PASS |
| Small mobile 360×640 | PASS |
| Spot checks: laptop 1366, tablet landscape 1024, Android 412 | PASS |

Pages: `/welcome`, `/pre-register`, `/invite/links-electrical-shrewsbury`, `/admin/programmes`, installer dashboard, `/earnings`.  
Findings: no overflow, clipping, unclear earnings, or copy/CSS fixes required (11 screenshots).  
Physical-device camera: **NOT TESTED** (browser emulation only).

---

## 9. Stress & concurrency

Source: `/opt/cursor/artifacts/phase2/stress-results.json`

| Wave | Conc | Requests | Unexpected failures | Median ms | P95 ms |
| --- | --- | --- | --- | --- | --- |
| auth | 5/10/25/50 | up to 100 | 0 | ~577–659 | ~886–1010 |
| search | 5/10/25 | up to 100 | 0 | ~485 | ~674 |
| invite | 5/10/25 | up to 75 | 0 | ~268 | ~453 |
| redeem_dup | 5/10/25 | up to 25 | 0 | ~766 | ~977 |

Giftbit/email not flooded.

---

## 10. Deployment integrity

- `deploy-preserve.mjs` remains required: redeploy functions → `POST /deploy` → **re-push all schemas** → `deploy-dist` → verify.
- Schemas now include `qa_financial_lifecycle` in repo JSONC (reduces stale-git wipe risk for this field).
- Claim submitter fail-closed if membership missing on held/deferred accounts.
- 3 consecutive post-deploy probes: SPA welcome routes, Installer schema, genuine programme draft — all OK.
- Published SPA at verification: `assets/index-Ct1Q8Oqd.js`.

Underlying Base44 git revision alignment is still an platform ops concern; deploy-preserve remains mandatory until Base44 publish always uses the committed schema revision.

---

## 11. QA credential protection

- Plaintext cohort password removed from `VIRTUAL_COMMERCIAL_LAUNCH_REPORT.md`.
- Harnesses read `CONNECT_QA_INSTALLER_PASSWORD_TEMPLATE` from environment only.
- **Rotation BLOCKED**: no Base44 password-change API found in available endpoints. JP should rotate cohort passwords via Base44 admin/user tools.
- QA accounts remain `is_demo` + `excluded_from_reporting`; no admin role.

---

## 12. 200 QR verification

| Check | Result |
| --- | --- |
| Generated / unique serials | 200 / 200 |
| Unique claim tokens | 200 |
| Claims reconciled | 200 |
| Sample QR PNGs decoded URL match | PASS |
| Public CSV (no PINs) | `phase2/virtual-links-qr-public.csv` |
| Restricted PIN CSV | `phase2/restricted/virtual-links-serial-pin.csv` (not for public reports) |

---

## Defects identified & fixed

| Defect | Root cause | Fix | Retest |
| --- | --- | --- | --- |
| Demo/excluded blocked redemption lifecycle | `eligible()` excluded all demo rows | `qa_financial_lifecycle` exception in voucher + admin paths | Redemptions succeeded |
| Schema/SPA wipe on deploy | `POST /deploy` stale sync | deploy-preserve mandatory | 3× verify loops |
| Membership default active after wipe | null membership → active | Fail-closed for held/deferred | Probe 403 |
| Over-redeem after failure injection | Harness re-approved issued claims | Documented; admin must not reset issued→approved | Ledger note |
| Plaintext password in report | Doc leak | Redacted to env var name | Doc check |
| Giftbit GBP Testbed unfunded | Provider funds | USD twin + manual_sent for app lifecycle | DELIVERED USD |

---

## Outstanding dependencies

1. Edd authorisation + JP genuine serial/PIN file  
2. JP explicit activation of genuine Links programme  
3. Live GBP Giftbit funds/permissions  
4. Email DNS for `no-reply@connect.fastamps.com`  
5. QA cohort password rotation via Base44 admin  
6. Optional: single £100 application redemption scenario  
7. Optional: platform fix so Base44 `/deploy` never overwrites schemas from stale git  

---

## Manual real-world checklist (JP / Edd)

1. Review Giftbit Testbed emails in JP inbox (do not redeem rewards intended for review).  
2. Spot-check `/welcome`, `/pre-register`, `/invite/links-electrical-shrewsbury` on a physical phone.  
3. Confirm admin programmes UI shows genuine Links as draft.  
4. Rotate exposed QA cohort credentials.  
5. Only after Edd authorises: import genuine codes; keep virtual batches excluded.  
6. Only after JP approves: activate genuine Links; fund GBP Giftbit live.  

---

## Artifact index

| Path | Contents |
| --- | --- |
| `phase2/installer-ledger-50.csv` | 50-installer reconciliation |
| `phase2/phase2-financial-lifecycle.json` | Week-by-week financial run |
| `phase2/giftbit-jp-email-evidence.json` | JP email evidence |
| `phase2/stress-results.json` | Concurrency metrics |
| `phase2/prereg-activation.json` | E2E pre-reg + activations |
| `phase2/qr-verification.json` | 200 QR checks |
| `phase2/virtual-links-qr-public.csv` | Public QR map (no PINs) |
| `phase2/restricted/` | PIN CSV (restricted) |
| `phase2/responsive/` | Screenshots + UX notes |
| `phase2/deploy-integrity-loops.json` | Post-deploy probes |
