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

### Isolated probe result (2026-11-23 Europe/London)

| Step | Result |
| --- | --- |
| Mode | `testbed` only (`GIFTBIT_MODE` confirmed non-live) |
| Ping | HTTP 200 |
| Funds | HTTP 200 |
| GBP £30 campaign create | HTTP 200 |
| Provider code | `INFO_CAMPAIGN_CREATED_FUNDS_REQUIRED` |
| Stage reached | `gbp_awaiting_funds_boundary` |
| Voucher delivered to recipient | **No** |
| Resend | **Forbidden** — stop here |
| Production payout proof | **No** |
| QA `VoucherRequest` rows sent | **0** |

Provider message: *Campaign creation has begun, but additional funds are required. You do not need to resend this campaign.*

This matches Connect’s `admin-voucher-action` awaiting-funds handling. Live UK Giftbit remains a separate FastAmps permissioned check.

## Harness commands

```bash
export CONNECT_QA_MODE=production-authorised CONNECT_QA_CONFIRM=QA-LAUNCH-2026
npm run lifecycle-harness --prefix launch-readiness/simulation
npm run giftbit-testbed-probe --prefix launch-readiness/simulation
npm test --prefix . -- tests/giftbitTestbedBoundary.test.mjs
```

## Next action

1. Optional: admin UI spot-check photos on a sample of the 1201 approved claims.
2. Live UK Giftbit funding/permissions remain outside this QA cohort (NO-GO for auto-fulfililment).
3. Keep feature freeze; no live financial control changes; no further unapproved deploys of payout behaviour.

## Notes

Rate limit: Base44 `entity_update` ≈ 350/min — lifecycle harness paces approvals (~220ms) and retries 429s.
