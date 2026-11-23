---
cron: "0 8,14 * * 1-5"
---

Resume FastAmps Connect launch readiness.

1. Call `load_checkpoint`.
2. Probe https://connect.fastamps.com , /login , /register , /privacy , /terms , /manifest.json .
3. If production still lacks published launch fixes (privacy 404 / Base44 PWA icon), record that as a publish blocker.
4. Continue the highest-priority unresolved P0/P1 under feature freeze — do not add features.
5. Update issues, health, simulation stats, then `save_checkpoint` and refresh the launch report.
6. Do not run the full 400-install production stress test unless checkpoint.environment is production-authorised.
