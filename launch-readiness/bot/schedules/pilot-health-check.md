---
cron: "0 8,14 * * 1-5"
---

Resume FastAmps Connect launch readiness for Base44 app **6adf6de7ebdb4cb382e8779f** only.

1. Call `load_checkpoint`.
2. Probe https://connect.fastamps.com and confirm `appIdMatch` / login-info id `6adf6de7ebdb4cb382e8779f`.
3. Also probe /login , /register , /privacy , /terms , /manifest.json .
4. If production still lacks published launch fixes (privacy/terms / Base44 PWA icon / Alpha 7 tile), record that as a publish blocker.
5. Continue the highest-priority unresolved P0/P1 under feature freeze — do not add features.
6. Update issues, health, simulation stats, then `save_checkpoint` and refresh the launch report.
7. Do not run the full 400-install production stress test unless checkpoint.environment is production-authorised.
8. Never treat another Base44 app id as Connect.
