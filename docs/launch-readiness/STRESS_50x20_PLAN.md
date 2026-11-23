# Phase 11 — 50×20 stress plan (isolated)

Updated: 2026-11-23 (Europe/London)

## Target

- 50 synthetic installer accounts (Mailosaur)
- ≥20 installations each → ≥1,000 successful claims
- ≥1,000 photo URL pairs (HTTPS evidence assets acceptable for capacity; camera captures tracked separately)
- Ramp concurrency: 1 → 5 → 10 → 25 → 50 sessions
- Bounded optional peak toward 100 only after 50 passes
- Concurrent admin approve/reject/needs_info samples
- Reward eligibility checks + voucher **request** path with demo holds intact (no live Giftbit spend)

## Isolation rules

- All records `is_demo=true` and `excluded_from_reporting=true`
- Reward status held; wallets not redeemable to live Giftbit
- Do **not** run disruptive load against unrelated production traffic windows without ops awareness
- Prefer Connect QA mode already used for PR #10 waves; extend cohort rather than inventing new product paths

## Metrics to capture

| Metric | Method |
| --- | --- |
| Login / OTP success rate | Harness counters |
| Claim submit latency p50/p95 | Harness timers |
| Photo upload / attach success | Claim payload validation |
| Entity update 429 rate | Admin pacing (≈220ms+) |
| DB consistency | Serial uniqueness; photo presence; status totals |
| Wallet integrity | Eligible £0 for demo cohort |
| Duplicate PIN/serial rejection | Negative tests |

## Exit criteria

- ≥1,000 successful installs; error rate within agreed band (document actual)
- Zero wallet leakage for demo cohort
- Admin can locate claims via search + include-excluded toggle
- UK GBP constants unchanged after run

## Status

Plan ready. Full 50×20 execution follows admin/installer UI verification close-out and continues to use existing harnesses under `launch-readiness/simulation`.
