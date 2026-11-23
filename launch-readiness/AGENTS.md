# launch-readiness

Agent SDK project (`@grok/agent-sdk`) for FastAmps Connect **continuous** launch readiness, stress simulation orchestration, and QA under a hard **feature freeze**.

The served prompt is `bot/instructions.md`. The customer-facing Connect app lives in the parent directory. Do not add product features from this agent.

## Loop

```bash
npm install
npm run validate
npx --yes @grok/agent-sdk@0.7.0 info --dir . --json
npx --yes @grok/agent-sdk@0.7.0 tool call probe_url --dir . --input '{"url":"https://connect.fastamps.com"}'
npx --yes @grok/agent-sdk@0.7.0 tool call load_checkpoint --dir . --input '{}'
npx --yes @grok/agent-sdk@0.7.0 run --dir . --message "Load checkpoint, smoke connect.fastamps.com, update health, save checkpoint."
npx --yes @grok/agent-sdk@0.7.0 eval --dir .
npm run check
```

Simulation harness (fixtures + publish smoke; production 400-run gated):

```bash
cd simulation
npm run generate:fixtures
npm run dry-run
npm run smoke
npm run concurrency-plan
```

Run under Node, never Bun. Do not point `serve` at the parent FastAmps Connect folder.

## Layout

- `bot/tools/` — probe, issues, health, report, checkpoint, simulation stats
- `bot/skills/` — continuous-cycle, stress-simulation, giftbit-boundary, installer/admin/store audits
- `bot/schedules/pilot-health-check.md` — weekday 08:00 / 14:00 UTC
- `simulation/` — QA-LAUNCH-2026 fixtures and env-gated runners
- Parent `docs/launch-readiness/` — report, CHECKPOINT, CONTINUOUS_AGENT ops route
