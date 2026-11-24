# FastAmps Connect V1 — Final launch-readiness recommendation

Updated: 2026-11-23 (Europe/London)  
Audience: Links Electrical Shrewsbury **200-charger** beta  
Feature freeze: **in force** throughout

## Decision: **CONDITIONAL GO**

Core installer and admin paths are reliable enough for a bounded UK beta, with explicit external caveats. See also `RELEASE_INTEGRITY_CHECK.md` (2026-11-23).

### Conditions (must remain true)

1. **UK Giftbit auto-fulfililment stays NO-GO** until live GBP funds/permissions are confirmed; continue manual / held voucher handling.
2. **QA/demo segregation** remains enabled; do not include `QA-LAUNCH-2026` rows in commercial reporting.
3. No production reward-rule or currency changes.
4. Complete human manual testing checklist (`MANUAL_TESTING_HANDOVER.md`) on real phones before treating field usability as proven.

### Owner real-device verification (2026-11-23)

Product owner confirmed repeated handset testing on **Samsung Android** and **iPhone**. The previous DEVICE-CAM / real-device camera–QR open item is closed on that evidence (agent-side work remains browser emulation only).

---

## Evidence summary

### Technical performance

| Area | Result |
| --- | --- |
| PR #10 baseline | 20 installers; ≥1200 claims; concurrency harness; wallets £0 for QA |
| Phase 11 stress | **50 installers**, **1811** QA claims, photos complete; 25-way claim wave 600/600 |
| Wholesaler server guard | Live **400** on empty/whitespace company or branch (after `POST /deploy`) |
| Security/data integrity | Demo holds + exclusion; accidental blank-wholesaler probes quarantined |

### Installer experience

| Area | Result |
| --- | --- |
| Login / dashboard GBP copy | Pass (emulation) |
| PIN placeholder | Fixed + retested (`e.g. 012345` + hint) |
| `/rewards` | Redirects to `/earnings` |
| Wholesaler UI labels | **Pass** (browser) — required markers, prefill, empty submit blocked |
| Real iPhone/Android camera | **Owner pass** — repeated tests on Samsung Android + iPhone (2026-11-23) |

### Administrator experience

| Area | Result |
| --- | --- |
| Search + include demo/excluded | Pass — 3 live vs ~1200+ QA when toggled |
| Photos + GPS on live claim | Pass |
| Scalability | Search required; default list stays lean |

### Giftbit

| Area | Result |
| --- | --- |
| GBP Testbed | Funds-required — no delivery |
| USD Testbed | Isolated delivery proven — **not** UK production proof |
| Live UK auto-send | **NO-GO** |

### Feature-freeze compliance

No new journeys, reward amounts, multi-currency UK wallets, white-label, or unauthorised redesign. SPA restored via `deploy-dist` after function deploy.

---

## Remaining defects / follow-ups

| ID | Severity | Notes |
| --- | --- | --- |
| GIFTBIT-UK | High (ops) | Manual vouchers until live GBP ready |
| DEVICE-CAM | **Closed** | Owner: repeated Samsung Android + iPhone testing |
| WHOL-UI-SHOT | Done | Browser step-2 verified on S00008 — see artifacts `installer-ux-wholesaler-s00008/` |
| DEMO-CREATE | **Closed (deployed)** | Create-time held/excluded live — verified 2026-11-24 without harness patch |
| PHOTO-CLASS | Info | Mass stress photos = synthetic URL load; genuine-upload E2E = 1 claim only |

---

## Recommendation for Links Electrical Shrewsbury 200-charger beta

**GO for human manual testing** (checklist in `MANUAL_TESTING_HANDOVER.md`). **CONDITIONAL GO for Links beta ops:** complete the manual phone checklist, keep Giftbit manual until live UK funds/permissions, keep QA excluded from reporting, spot-check printed 200-code labels.
