# FastAmps Connect operations

Zero-AI scripts and GitHub Actions for production health, release verification, and security smoke checks.

| Command | Purpose |
| --- | --- |
| `npm run ops:health` | Live availability + SPA markers + Links draft check |
| `npm run ops:verify-release` | Deployment verification gate (`VERIFIED` / `DEPLOYMENT UNVERIFIED`) |
| `npm run ops:security-smoke` | Anonymous/admin permission smoke tests |

Docs: `docs/ops/`.

Routine monitoring must not invoke AI. See `docs/ops/GUARDIAN_IMPLEMENTATION_REPORT.md`.
