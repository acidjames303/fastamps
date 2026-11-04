# QR registration fixtures (beta only)

Non-destructive fixtures for Phase 8. **Do not run against production.**

Populate only after Base44 eject + isolated beta app/database are available.

## Planned entities

| Entity | Purpose |
|---|---|
| `chargers.available.json` | Unique serial, 6-digit PIN, product model, `claim_token` (no PIN in QR) |
| `chargers.claimed.json` | Already-claimed charger for duplicate-claim tests |
| `chargers.demo.json` | `is_demo=true` chargers — must never trigger payable vouchers |
| `chargers.legacy-label.json` | Historical printed QR payload samples (token and legacy serial/PIN forms) |
| `installers.fresh.json` | New installer registration from claim QR |
| `installers.existing.json` | Signed-in installer scan path |
| `qrs.static-website.json` | Payload: `https://connect.fastamps.com` only |
| `qrs.invalid.json` | Malformed / unknown payloads |

## Rules

- Never delete production chargers, claims, or installer accounts.
- Historical `TRADE-SHOW` / `TRADE-SHOW-01` rows: archive/flag only.
- Trade-show static website QR must not appear as a charger claim fixture.
