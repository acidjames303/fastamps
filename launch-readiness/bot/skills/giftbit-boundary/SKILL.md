---
name: giftbit-boundary
description: Investigate Giftbit production readiness without spending real money or emailing fictional installers.
---

# Giftbit boundary

1. Prefer Admin → Vouchers → “Check Giftbit UK readiness” (read-only).
2. Confirm Testbed GBP limitation remains; do not resend awaiting-funds campaigns.
3. Trace `request-voucher-v2` and `admin-voucher-action` for auth, currency, idempotency, duplicate guards.
4. If no official production-safe validation exists, stop at non-fulfilment boundary and document.
5. Never place chargeable Giftbit orders for QA identities.
6. Record status with `record_simulation_stats.giftbitStatus`.
