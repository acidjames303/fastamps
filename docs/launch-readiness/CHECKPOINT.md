# Launch readiness checkpoint

Updated: 2026-11-23 (Europe/London)

| Field | Value |
| --- | --- |
| Cycle | 2 (authorised production QA — in progress) |
| Clean cycles | 0 / 3 |
| Phase | QA mailbox / 20 synthetic installers → 400 claims → concurrency |
| Environment | production-authorised (no further deploys without approval) |
| Simulation prefix | QA-LAUNCH-2026 |
| Base URL | https://connect.fastamps.com |

## Safety: five earlier QA claims

All five `QA-LAUNCH-2026-S00001`–`S00005` claims now:

- `reward_status=held` (admin fraud-review hold)
- `excluded_from_reporting=true`
- `is_demo=true`, `demo_label=QA-LAUNCH-2026`

They no longer appear in installer “active” wallet counts and cannot qualify Giftbit fulfilment paths that skip demo/excluded/held rewards. No Giftbit campaign was created for them.

## OTP mailbox

- **Provider:** Mailosaur (not personal Gmail).
- Base44 register accepts unique addresses and emails a real OTP.
- Blocked on secrets: `MAILOSAUR_API_KEY` + `MAILOSAUR_SERVER_ID`.
- See `docs/launch-readiness/QA_MAILBOX.md`.

## Next action

1. Wait for Mailosaur secrets / “Mailosaur ready”.
2. Verify two addresses end-to-end (register → OTP via Mailosaur API → verify).
3. Provision 20 `QA-LAUNCH-2026` installers; import remaining chargers; run 20×20 with photos; admin reconcile; three clean cycles.
4. No further production deploys without explicit approval.

## Notes

Feature freeze remains in force. Two exploratory registrations to disposable `qa.launch.2026+…@gmail.com` probes were API-only and are not part of the programme dataset (OTP not completed).
