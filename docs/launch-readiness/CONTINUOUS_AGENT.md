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

## Why not “just hit production with 400 installs” today

- Production still needs **Base44 publish** of pending fixes.
- Creating 20 accounts × 400 claims on live without an isolated DB risks polluting real programme data.
- Mission requires **explicit authorisation** before production load tests.
- Giftbit must not receive chargeable QA orders.

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
