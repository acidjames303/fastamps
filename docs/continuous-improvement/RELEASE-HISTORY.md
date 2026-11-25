# Cadence continuous improvement — release history

## CI cycle 1 — 25 Nov 2026 (Europe/London)

**Branch:** `cursor/continuous-improvement-agent-2475`  
**Focus:** Establish CI agent artefacts + highest-impact safe UX: research on Dialer + confirm-for-calling.

### Issue identified

1. AccountResearch from Prospecting was only copied into CompanyIntelligence at push time; dig-deeper / later research did not appear on Dialer with source URLs.
2. Provider-returned mobiles required buried “Use this number”; Confirm did not mark the prospect call-ready.

### Changes made

- Living CI docs + `.cursor/rules/cadence-continuous-improvement.mdc` + AGENTS.md pointer + Automations setup notes.
- Dialer loads matching `AccountResearch` and BriefPanel shows findings with evidence + source links.
- Prospecting: visible “Confirm for calling” when a usable number exists but is not yet verified/manually confirmed; PhoneCandidates Confirm also sets `phone_status: manually_confirmed` when appropriate.

### Data / security impact

Read-only research fetch on Dialer; optional Prospect/ContactPhone status updates already within existing entity permissions. No schema, secrets, auth, or billing changes.

### Publishing status

Code on `cursor/continuous-improvement-agent-2475` + PR. Unit test + production build passed. **Base44 production deploy held** — app only exposes `main`; live Dialer/Prospecting UI verify and a Builder rollback checkpoint are required before autonomous publish (see TESTING-RECORD).

### Rollback

Revert the PR / restore prior BriefPanel + PhoneCandidates + ProspectTable commits. No migrations.

### Next priority

CI-003 multi-file campaign ingest, or Dialer session continuity — whichever scores higher after live verification.
