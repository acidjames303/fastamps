# launch-readiness

Agent SDK project (`@grok/agent-sdk`) for FastAmps Connect launch readiness and QA.

The served prompt is `bot/instructions.md`. The customer-facing Connect app lives in the parent directory.

## Loop

```bash
npx @grok/agent-sdk validate --dir .
npx @grok/agent-sdk info --dir . --json
npx @grok/agent-sdk tool call probe_url --dir . --input '{"url":"https://connect.fastamps.com"}'
npx @grok/agent-sdk run --dir . --message "Probe connect.fastamps.com and summarise launch health."
npx @grok/agent-sdk eval --dir .
npm run check
```

Run under Node, never Bun. Do not point `serve` at the parent FastAmps Connect folder.

## Layout

- `bot/tools/` — one tool per file
- `bot/skills/` — installer, admin, and store audits
- `bot/schedules/pilot-health-check.md` — weekday morning health prompt
- Parent `docs/launch-readiness/LAUNCH_READINESS_REPORT.md` — central report
