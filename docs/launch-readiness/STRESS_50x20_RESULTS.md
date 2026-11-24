# Phase 11 — 50×20 stress results

Updated: 2026-11-23 (Europe/London)  
Environment: Connect production app with QA segregation (`is_demo` / `excluded_from_reporting` / reward `held`)  
Method: External harness (`stress-50-prepare`, `claim-wave-50`) — **not** browser UI concurrency

## Targets vs actual

| Target | Actual |
| --- | --- |
| 50 synthetic installers | **50** Mailosaur accounts (`installer01`–`50`) |
| ≥20 installs each | **All 50 ≥20** (max 60 on early cohort) |
| ≥1,000 successful installs | **1,811** QA-LAUNCH claims |
| Photo pairs | **1,811 / 1,811** |
| Concurrent sessions | Ramp **1 → 5 → 10 → 25** (wave for installers 21–50) |
| Verified concurrency limit | **25** (no higher peak required for this beta) |
| W2 claim wave | **600 / 600 ok** in **82s**; p50 **1353ms**, p95 **2063ms** |

## Safety

- New claims patched `is_demo`, `excluded_from_reporting`, `reward_status=held`
- Post-wave sweep quarantined **237** remaining unexcluded QA rows
- Live SPA still GBP (`£10` present; no `$10` wallet strings); bundle `index-Dqk2xKAX.js`
- No Giftbit production spend in this wave

## Bottlenecks observed

- Entity `PUT` quarantine pacing ~220ms to avoid 429
- Charger import PIN uniqueness requires careful ranges (duplicate PIN validation is strict)
- `register-installer` requires `terms_accepted` + `programme_terms_version=2026-10-v1`

## Not claimed

- Real-device camera/QR under 50 concurrent humans
- Live UK Giftbit fulfilment
- Disruptive 100-session peak (not required after 25-concurrency green wave)
