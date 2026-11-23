# Continuous launch-readiness agent — operating route

## Recommended route (what we set up)

1. **Persistent orchestrator:** Agent SDK project at `launch-readiness/`  
   - Full feature-freeze mission in `bot/instructions.md`  
   - Tools: probe, issues, health, report, checkpoint, simulation stats  
   - Skills: continuous cycle, stress simulation, Giftbit boundary, installer/admin audits  
   - Weekday schedules at 08:00 and 14:00 UTC

2. **External stress harness:** `launch-readiness/simulation/`  
   - Generates `QA-LAUNCH-2026` fixtures (20 installers, 420 codes)  
   - Hard env guard blocks accidental production load  
   - Smoke probes for publish detection

3. **This Cloud Agent / PR #10** applies freeze-compliant product **fixes** only, then the orchestrator retests.

## Authorised Cycle 2 load (completed 2026-11-23)

With `CONNECT_QA_MODE=production-authorised` + `CONNECT_QA_CONFIRM=QA-LAUNCH-2026` and Mailosaur secrets:

- 20 Mailosaur installers onboarded (genuine OTP).
- 420 QA chargers imported; **400** cohort claims + **5** earlier pilot = **405** QA claims.
- Concurrency ramp 1→20; **0** submit failures on the 399-claim wave.
- Every QA claim/installer marked demo / excluded / reward **held** — Giftbit-safe (`payable_qa_claims=0`).

Still required for GO: two more consecutive clean cycles, admin UI reconcile under load, store readiness, and Giftbit auto-fulfililment remaining NO-GO until separately verified. No further production deploys without approval.

## Target app (mandatory)

All testing must hit Base44 app **`6adf6de7ebdb4cb382e8779f`** (FastAmps Connect) at `https://connect.fastamps.com` unless an isolated clone of **that same app id** is provided.

```bash
export CONNECT_APP_ID=6adf6de7ebdb4cb382e8779f
export CONNECT_BASE_URL=https://connect.fastamps.com
npm run assert-app   # from launch-readiness/simulation
```

## How to authorise the full 20×20 cycle

```bash
# Preferred: isolated Connect deployment of the SAME app id
export CONNECT_APP_ID=6adf6de7ebdb4cb382e8779f
export CONNECT_BASE_URL="https://<isolated-connect-host>"
export CONNECT_QA_MODE=isolated
# plus admin/installer credentials via secrets — never paste into chat

# Or production after written approval:
export CONNECT_APP_ID=6adf6de7ebdb4cb382e8779f
export CONNECT_BASE_URL="https://connect.fastamps.com"
export CONNECT_QA_MODE=production-authorised
export CONNECT_QA_CONFIRM=QA-LAUNCH-2026
```

Then resume the Agent SDK agent / Cloud Agent from `docs/launch-readiness/CHECKPOINT.md`.

## Success bar (unchanged)

Three consecutive clean critical regression cycles after the last P0/P1, with ≥400 backend-verified installs, concurrency evidence, admin reconciliation, and documented Giftbit boundary — **without adding product features**.
