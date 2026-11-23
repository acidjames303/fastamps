# Launch readiness checkpoint

Updated: 2026-11-23 (Europe/London)

| Field | Value |
| --- | --- |
| Cycle | 2 (authorised production QA — stress wave complete) |
| Clean cycles | 1 / 3 (Cycle 2 wave green; need two more consecutive) |
| Phase | Post-400 reconcile → Cycles 3–4 → GO/NO-GO |
| Environment | production-authorised (no further deploys without approval) |
| Simulation prefix | QA-LAUNCH-2026 |
| Base URL | https://connect.fastamps.com |

## Cycle 2 stress results (2026-11-23)

| Metric | Result |
| --- | --- |
| Mailosaur OTP installers | 20 / 20 verified (`qa-launch-2026-installer01..20@8deitqir.mailosaur.net`) |
| Installer profiles | 20 / 20 `is_demo`, `demo_label=QA-LAUNCH-2026`, `excluded_from_reporting`, `reward_account_status=held` |
| QA chargers imported | 420 (`QA-LAUNCH-2026-S00001`–`S00420`) all demo/excluded |
| Claims submitted this wave | **399 / 399** ok (0 fails) |
| Per-installer installs | **20 / 20** each (exactly) |
| Total QA claims on register | **405** (400 from Mailosaur cohort + 5 earlier pilot claims) |
| Concurrency ramp | 1 → 2 → 5 → 10 → 20 (final stage 299 parallel workers capped at 20) |
| Photos | Two HTTPS URLs per claim (`serial_photo_url` + `install_photo_url`) |
| Elapsed | ~179s for the 399-claim wave |

## Safety / Giftbit boundary

All **405** QA claims:

- `reward_status=held`
- `excluded_from_reporting=true`
- `is_demo=true`, `demo_label=QA-LAUNCH-2026`
- `status=submitted` (not approved / not payable)

`payable_qa_claims = 0`. No QA rows in `VoucherRequest`. No Giftbit campaign created for this cohort.

## OTP mailbox

- **Provider:** Mailosaur (connected; secrets present).
- Server id resolved: `8deitqir`.
- Genuine Base44 register → Mailosaur Messages API OTP → `verify-otp` proven for all 20.
- See `docs/launch-readiness/QA_MAILBOX.md`.

## Harness commands

```bash
export CONNECT_QA_MODE=production-authorised
export CONNECT_QA_CONFIRM=QA-LAUNCH-2026
# secrets: MAILOSAUR_*, CONNECT_QA_ADMIN_*, BASE44_APP_ID

npm run otp-mailosaur --prefix launch-readiness/simulation
npm run register-qa-installers --prefix launch-readiness/simulation -- --count 20
npm run claim-wave --prefix launch-readiness/simulation -- --per-installer 20 --concurrency-max 20
```

## Next action

1. Admin UI reconcile sample (search, photo, duplicate, pending) under freeze — no new features.
2. Run Cycle 3 and Cycle 4 claim/reconcile passes (or reset/re-run on fresh codes) for **3 consecutive clean cycles**.
3. Store readiness / Giftbit auto-fulfililment remain **NO-GO** until separately verified.
4. No further production deploys without explicit approval.

## Notes

Feature freeze remains in force. Prior Gmail plus-alias probes were abandoned; Mailosaur is the only OTP path.
