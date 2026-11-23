# Launch readiness checkpoint

Updated: 2026-11-23 (Europe/London)

| Field | Value |
| --- | --- |
| Mission | V1 final audit (PR #10 baseline → UX → USD Testbed → stress) |
| Interim decision | **CONDITIONAL GO** (see `BASELINE_PR10.md`) |
| Feature freeze | In force |
| Base URL | https://connect.fastamps.com |
| Frontend deploy | `index-sfvJjKvU.js` @ 2026-11-23T14:21:13Z (Europe/London same instant) |
| Backend wholesaler publish | `submit-install-claim` + `v2` deployed with required company/branch |

## Phase status

| Phase | Status |
| --- | --- |
| 1 PR #10 baseline | **Done** — `BASELINE_PR10.md` |
| 2 Admin UI | **In progress** — search + include demo/excluded shipped; browser re-verify running |
| 3–4 Installer UX / install flow | Pending browser + freeze-safe polish |
| 5 Wholesaler required fields | **Published** (UI + backend) |
| 6 Data/privacy audit | **Done (draft)** — `DATA_PRIVACY_AUDIT.md` |
| 7 Mobile UI | Pending |
| 8 USD Giftbit Testbed | **Done (isolated)** |
| 9 UK GBP unchanged | **Re-verified** after admin deploy — £10/£30 present; `$10`/`USD` absent in wallet bundle |
| 10 International feasibility | **Done (read-only)** — `INTERNATIONAL_FEASIBILITY.md` |
| 11 50×20 stress | Plan ready — `STRESS_50x20_PLAN.md` |
| 12–14 Scenarios / report | Pending |

## Cohort (unchanged safety)

1205 QA claims; 1201 approved / 2 rejected / 2 needs_information; all `is_demo` + `excluded_from_reporting`; rewards held; wallets £0 redeemable.

## Giftbit

| Probe | Result |
| --- | --- |
| GBP Testbed | `INFO_CAMPAIGN_CREATED_FUNDS_REQUIRED` — no delivery |
| USD Testbed | Marketplace gift delivered in isolated harness only |
| Live UK auto-fulfililment | **NO-GO** until live GBP funds/permissions |

## Next

1. Finish admin UI browser evidence (photos + search + toggle).
2. Installer UX / mobile audits; freeze-safe fixes only.
3. Execute isolated 50×20 stress per plan.
4. Final GO / CONDITIONAL GO / NO-GO report for Links Electrical Shrewsbury 200-charger beta.
