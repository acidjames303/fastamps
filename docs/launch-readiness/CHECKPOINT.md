# Launch readiness checkpoint

Updated: 2026-11-23 (Europe/London)

| Field | Value |
| --- | --- |
| Mission | V1 final audit (PR #10 baseline → UX → USD Testbed → stress) |
| Interim decision | **CONDITIONAL GO** (see `BASELINE_PR10.md`) |
| Feature freeze | In force |
| Base URL | https://connect.fastamps.com |

## Phase status

| Phase | Status |
| --- | --- |
| 1 PR #10 baseline | **Done** — `docs/launch-readiness/BASELINE_PR10.md` |
| 2 Admin UI browser | **In progress** (computer-use agent) |
| 3–4 Installer UX / install flow | Pending browser + freeze-safe polish |
| 5 Wholesaler required fields | **Fixed in source** (UI + submit-install-claim / v2) — needs publish |
| 6 Data/privacy audit | Pending written assessment |
| 7 Mobile UI | Pending |
| 8 USD Giftbit Testbed | **Done (isolated)** — $10 Amazon `DELIVERED` / `SENT_AND_REDEEMABLE`; duplicate ID rejected |
| 9 UK GBP unchanged | **Verified** — reward amounts £10; live bundle £10/£30; no USD wallet; no QA voucher sent |
| 10 International feasibility | Pending read-only note |
| 11 50×20 stress | Pending isolated plan (not disruptive live) |
| 12–14 Scenarios / report | Pending |

## Cohort (unchanged safety)

1205 QA claims; 1201 approved / 2 rejected / 2 needs_information; all `is_demo` + `excluded_from_reporting`; rewards held; wallets £0 redeemable.

## Giftbit

| Probe | Result |
| --- | --- |
| GBP Testbed | `INFO_CAMPAIGN_CREATED_FUNDS_REQUIRED` — no delivery — do not resend |
| USD Testbed | Marketplace gift id 1 @ 1000¢ — **DELIVERED** / **SENT_AND_REDEEMABLE** (`amazonus`) — isolated harness only |
| Duplicate campaign id | Rejected (`ERROR_CAMPAIGN_INVALID_ID`) |
| Live UK auto-fulfililment | **NO-GO** until live GBP funds/permissions |

## Next

1. Finish admin UI browser evidence.
2. Publish wholesaler required-field fix (`deploy-dist` + backend functions).
3. Continue installer UX / mobile audits; only freeze-safe fixes.
4. Plan 50×20 stress in isolated environment.
