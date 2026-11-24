# FastAmps Connect V1 — Controlled live beta & nationwide pre-registration

Updated: 2026-11-24 (Europe/London)  
Production: https://connect.fastamps.com  
Checkpoint tag: `checkpoint/controlled-beta-pre-20261124`  
Branch: `cursor/controlled-beta-readiness-fb1b`

## GO / NO-GO

| Gate | Decision | Notes |
| --- | --- | --- |
| Nationwide pre-registration (technical) | **CONDITIONAL GO** | Workflow, validation, membership hold, admin demand view, SPA live. Email DNS/`no-reply@connect.fastamps.com` still external. JP public-copy approval required before marketing. |
| Links Electrical commercial beta | **NO-GO** | Programme configured as **draft/inactive**. No genuine codes. Giftbit live UK payouts remain held. Activation requires Edd + JP. |

## 1. Current application audit

| Area | Live state |
| --- | --- |
| Frontend asset | `index-vRWzqKAZ.js` |
| Installers / claims / chargers | 55 / 1823+ / 2434 (QA cohort preserved) |
| Create-time QA claim protections | Still live on `submit-install-claim-v2` |
| Wholesaler required on claims | Still enforced frontend + backend |
| Giftbit UK auto-fulfililment | Still **NO-GO** |
| Links programme | `links-electrical-shrewsbury` · status **draft** · payout **held_pending_authorisation** |

## 2. Existing functionality retained

- Auth, OTP email verification, onboarding, claim/QR sticker flows, admin installs/chargers/vouchers
- £10 welcome + £10/install + 3-install first redemption rules
- Import-charger-batch validation + official sticker template
- Demo/QA exclusion and reward holds
- Previous stress/QA data untouched (except one accidental eligibility-probe claim quarantined as demo/held)

## 3. Missing functionality identified (pre-change)

- No public Join vs Pre-register gateway
- No nationwide pre-registration journey / confirmation
- No installer membership lifecycle (`pre_registered` → `active`)
- No IncentiveProgramme entity / Links draft programme
- No programme invitation QR (Type B)
- No admin programme/demand management
- No server block for pre-registered claim attempts
- WholesalerBranch search not available to public pre-reg

## 4. Changes implemented

- Public `/welcome` gateway (Join / Pre-register / Sign in)
- `/pre-register` with email verify, wholesaler+branch search, manual fallback, privacy + notify consents, confirmation screen
- `/invite/:programmeCode` invitation landing (inactive → pre-register)
- Admin `/admin/programmes` (Links draft controls, invitation QR, pre-reg list, demand by branch)
- Backend: `pre-register-installer`, `search-wholesaler-branches`, `manage-incentive-programme`, `activate-installer-membership`
- Claim submitters block non-`active` membership; Links-allocated non-demo claims blocked while programme inactive
- Email HTML templates prepared; runtime SendEmail attempted (DNS dependency)
- Docs: genuine code import instructions + this readiness report + manual pack

## 5. Backend / database changes

| Resource | Change |
| --- | --- |
| `Installer` | `membership_status`, town/postcode/coverage, notify/privacy fields, `welcome_reward_status=deferred` |
| `WholesalerBranch` | town/postcode/county/programme_availability |
| `IncentiveProgramme` | new entity; Links beta seed record **draft** |
| Functions | listed above + claim eligibility updates |

**Ops note:** `POST /api/apps/{id}/deploy` can rewrite live entity schemas from the git revision Base44 associates with publish. After each full deploy, re-push entity schemas (or ensure the published git revision contains them) then restore SPA with `deploy-dist`.

## 6. Security & regression tests

| Test | Result |
| --- | --- |
| Unit (`npm test`, 17) | **PASS** |
| Pre-registered claim API (direct) | **PASS** — HTTP **403** with membership message |
| Activation without confirm | **PASS** — rejected |
| Public invite while draft | **PASS** — `active:false` |
| Wholesaler search Links/CEF/Edmundson | **PASS** |
| SPA contains welcome / invite / admin programmes | **PASS** |
| Accidental probe claim quarantine | Done (`held` + excluded) |

## 7–8. Published deployment verification

| Item | Value |
| --- | --- |
| SPA | `https://connect.fastamps.com` → `assets/index-vRWzqKAZ.js` |
| Backend publish | Redeploy-function + `POST /deploy` + schema re-push + `deploy-dist` |
| Links status after publish | Still **draft** |

## 9. Nationwide pre-registration status

Technically ready for JP review. Pre-registered accounts:

- Reuse the same User/Installer identity (no duplicate wallets)
- Get `membership_status=pre_registered`, `welcome_reward_status=deferred`, reward account held
- Cannot submit incentive claims until admin activation
- Prefer exact wholesaler **and** branch (directory search + manual fallback)

## 10. Links Electrical beta configuration

- Name: FastAmps Connect – Links Electrical Beta
- Code: `links-electrical-shrewsbury`
- Wholesaler/branch: Links Electrical / Shrewsbury
- Currency: GBP · verification: manual · payout: held
- Expected allocation: 200 (placeholder until Edd/JP)
- Status: **draft / inactive**

## 11. Programme invitation QR readiness

- URL: `https://connect.fastamps.com/invite/links-electrical-shrewsbury`
- Admin → Programmes can render printable QR
- Inactive programme routes to pre-registration
- Invitation alone never proves purchase / reward eligibility

## 12. Genuine charger import readiness

See `GENUINE_CODE_IMPORT_INSTRUCTIONS.md`. Existing Admin QR batches importer is the path. **Do not invent codes.**

## 13. Email / DNS

| Item | Status |
| --- | --- |
| Templates | Prepared under `base44/emails/` |
| Sender `no-reply@connect.fastamps.com` | **Outstanding** — JP/DNS |
| OTP verification emails | Existing Base44 path (already used in production) |
| Custom confirmation/availability sends | Best-effort via Core.SendEmail; treat as dependency until DNS proven |

## 14. Giftbit payout protection

Unchanged: UK live auto-fulfililment **NO-GO**. Programme payout mode held. QA/demo continues excluded/held.

## 15. Outstanding dependencies

1. Edd authorisation + JP genuine serial/PIN file  
2. Email DNS / sender authentication for `no-reply@connect.fastamps.com`  
3. JP approval to open public nationwide pre-registration marketing  
4. JP explicit approval to activate Links programme after import + manual tests  
5. Live GBP Giftbit funds/permissions (separate from beta claim collection)

## 16. Manual testing pack

See `CONTROLLED_BETA_MANUAL_TESTING.md`.

## 17. Rollback

1. SPA: redeploy previous known-good `dist` via `deploy-dist`  
2. Functions: redeploy prior `entry.ts` versions + `POST /deploy` + restore SPA  
3. Programme: keep/ensure Links status `draft` (never leave `active` without JP)  
4. Git: recover from `checkpoint/controlled-beta-pre-20261124`  
5. Do **not** delete Installer/Claim/Charger QA data

## 18. Decisions

- **Pre-registration:** CONDITIONAL GO (technical) pending JP + email DNS  
- **Links commercial beta:** **NO-GO** until Edd codes + import + manual pack + JP activation
