---
cron: "0 8 * * 1-5"
---

Run a FastAmps Connect launch health check for the wholesaler pilot window.

1. Probe https://connect.fastamps.com , /login , /register , /manifest.json with `probe_url`.
2. Summarise any regressions against the current Launch Readiness Report.
3. Record new Critical/High issues with `record_issue`.
4. Refresh health with `update_health` only where evidence changed.
5. Rewrite the report with `write_launch_report`.
6. Do not change production behaviour automatically. Do not issue Giftbit rewards.
