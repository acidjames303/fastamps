# Continuous improvement scheduling

## What this environment supports

Cursor Cloud Agents do **not** permanently daemonise inside the git repo. Supported alternatives:

### 1. Cursor Automations (recommended for unattended cadence)

1. Open https://cursor.com/automations  
2. Create an automation against repo `acidjames303/fastamps` (or the Cadence environment).  
3. Schedule daily or weekday runs (e.g. `0 8 * * 1-5` Europe/London).  
4. Prompt (paste):

```
Follow .cursor/rules/cadence-continuous-improvement.mdc.
Read docs/continuous-improvement/BACKLOG.md and RELEASE-HISTORY.md.
Audit recent changes and the live Cadence app when credentials allow.
Implement the single highest-impact safe P0/P1 item (or report none).
Update living docs. Do not expand scope. Protect all data and secrets.
```

5. Attach the CI audit PDF / prior agent context if available.

### 2. Active Cloud Agent + `subscribe_timer`

On a running Cloud Agent conversation, subscribe a recurring timer (e.g. every 24h) with the same prompt. Timers only fire when the agent run is otherwise free; they are not a substitute for Automations if the chat ends.

### 3. Repo-only fallback (always present)

Even without a schedule, any agent opening this repo receives the always-apply rule and living backlog. Human or one-shot Cloud Agents continue the loop from BACKLOG.md.

## Coordination

Before publishing, check open PRs on `cursor/*-2475` branches (especially UX audit and prospecting-search) to avoid conflicting Builder deploys.
