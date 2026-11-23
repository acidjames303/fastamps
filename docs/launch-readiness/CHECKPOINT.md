# Launch readiness checkpoint

Updated: 2026-11-23 (Europe/London)

| Field | Value |
| --- | --- |
| Cycle | Lifecycle wave (admin approval + wallet/voucher boundary) |
| Clean claim waves | Cycle 2 + 3 + 4 claim submits green (0 fails each) |
| Phase | Admin approval done → Giftbit Testbed GBP boundary (secrets pending) |
| Environment | production-authorised (feature freeze) |
| Simulation prefix | QA-LAUNCH-2026 |
| Base URL | https://connect.fastamps.com |

## Cohort inventory

| Metric | Result |
| --- | --- |
| Mailosaur installers | 20 / 20 |
| Claims per installer | 60 each (Cycles 2–4 × 20) |
| Total QA claims | **1205** (1200 cohort + 5 earlier pilot) |
| Admin approved (photos/serial reviewed) | **1201** (`status=approved`, `warranty_status=registered`) |
| Needs information samples | **2** |
| Rejected samples | **2** |
| `reward_status` | **1203 held** + **2 rejected** |
| Safety flags | **All** still `is_demo=true`, `excluded_from_reporting=true`, `demo_label=QA-LAUNCH-2026` |

Approvals mirror `AdminInstalls.jsx`: approving a held reward **keeps** `reward_status=held` (non-payable).

## Wallet + voucher boundary (production path)

| Check | Result |
| --- | --- |
| Earnings-style eligible wallet | **£0** for every QA installer (demo/excluded filtered out) |
| Account reward hold | Still `held` on all 20 profiles |
| `request-voucher-v2` | **Blocked** for all 20 (`Installer profile not found.` because `excluded_from_reporting`) |
| Payable QA claims | **0** |
| Real Giftbit / live vouchers | **None issued** |

This is the correct production behaviour. Demo/exclusion guards were **not** lifted.

## Giftbit Testbed / GBP

**Confirmed constraint:** Giftbit Testbed virtual funding is **USD/CAD only**. GBP campaigns will **not** deliver vouchers to recipients on Testbed.

Harness stance:

1. Isolated probe: `npm run giftbit-testbed-probe` (requires `GIFTBIT_API_TOKEN` + `GIFTBIT_TEMPLATE_ID`, mode testbed only).
2. Expect stage `gbp_awaiting_funds_boundary` / `AWAITING_FUNDS` — **do not resend**.
3. That result is **not** production payout proof and is **not** a Connect defect.
4. Live UK Giftbit remains a separate FastAmps permissioned check.

Secrets for the isolated Testbed probe were requested from the environment (pending).

## Harness commands

```bash
export CONNECT_QA_MODE=production-authorised CONNECT_QA_CONFIRM=QA-LAUNCH-2026
npm run lifecycle-harness --prefix launch-readiness/simulation
npm run giftbit-testbed-probe --prefix launch-readiness/simulation
npm test --prefix . -- tests/giftbitTestbedBoundary.test.mjs
```

## Next action

1. Add Giftbit Testbed secrets → run probe once → record provider code → stop (no resend).
2. Optional: admin UI spot-check photos on a sample of the 1201 approved claims.
3. Keep feature freeze; no live financial control changes; no further unapproved deploys of payout behaviour.

## Notes

Rate limit: Base44 `entity_update` ≈ 350/min — lifecycle harness paces approvals (~220ms) and retries 429s.
