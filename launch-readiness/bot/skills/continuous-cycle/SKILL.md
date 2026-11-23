---
name: continuous-cycle
description: Run the persistent test-fix-retest loop toward three clean critical regression cycles under feature freeze.
---

# Continuous cycle

1. `load_checkpoint`.
2. Confirm feature freeze still holds for any proposed change.
3. If environment is `dry-run`, only probe + unit/harness tests + code fixes; do not create 400 production installs.
4. If `isolated` or `production-authorised`, run the staged concurrency plan via `launch-readiness/simulation`.
5. Record defects with severity P0–P3 (`record_issue` Critical/High/Medium/Low).
6. Fix only freeze-compliant defects; retest; update `record_simulation_stats`.
7. If a P0/P1 appears after a clean cycle, reset `cleanCycles` to 0.
8. `save_checkpoint` + `write_launch_report` before ending.
