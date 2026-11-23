# Launch readiness checkpoint

Updated: 2026-11-23 (Europe/London)

| Field | Value |
| --- | --- |
| Mission | V1 final audit (PR #10 baseline → UX → USD Testbed → stress) |
| Interim decision | **CONDITIONAL GO** (see `BASELINE_PR10.md`) |
| Feature freeze | In force |
| Base URL | https://connect.fastamps.com |
| Frontend deploy | `index-Dqk2xKAX.js` (installer UX polish after admin search deploy) |
| Backend wholesaler publish | `submit-install-claim` + `v2` deployed with required company/branch |

## Phase status

| Phase | Status |
| --- | --- |
| 1 PR #10 baseline | **Done** — `BASELINE_PR10.md` |
| 2 Admin UI | **Done (browser)** — search + include demo/excluded verified live; photos + GPS on production claim; QA cohort 3→1204 when toggled |
| 3–4 Installer UX / install flow | **Mostly done** — PIN + `/rewards` retest PASS; wholesaler step-2 UI check in progress |
| 5 Wholesaler required fields | **Published** (UI + backend) |
| 6 Data/privacy audit | **Done (draft)** — `DATA_PRIVACY_AUDIT.md` |
| 7 Mobile UI | **In progress** — PIN placeholder, 44px header targets, `/rewards`→`/earnings` |
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

## Admin UI browser evidence (2026-11-23 Europe/London)

| Check | Result |
| --- | --- |
| Default list (demo off) | 3 live approved claims; photos + device GPS visible |
| Include demo / excluded QA | Pending 2; Approved **1204**; QA-LAUNCH serials visible |
| Search | Filters on `QA-LAUNCH` |
| Vouchers copy | Live: “1 reward request **needs** attention” (grammar OK) |
| Typical review | ~15–20s / ~5–6 clicks with search |

Artifacts: `admin-installs-without-demo.webp`, `admin-installs-with-demo-qa.webp`, `admin-installs-search.webp`, `admin-vouchers-gbp-testbed.webp`

## Next

1. Installer UX / mobile audits; freeze-safe fixes only.
2. Execute isolated 50×20 stress per plan.
3. Final GO / CONDITIONAL GO / NO-GO report for Links Electrical Shrewsbury 200-charger beta.
