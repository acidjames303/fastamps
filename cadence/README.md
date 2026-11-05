# Cadence

Base44 app id: `6a7338f6106b1962aa31c00a`  
Live: https://cadence.base44.app

Communication decision-support for leaders: recommend **meeting / email / async**, then draft the content.

## Workflow (unchanged)

```
Home → NewDecision (intake) → generate recommendation + draft → Save → History (archive)
```

What changed is **where** the work runs:

| Step | Before (published client) | Now |
|---|---|---|
| Score intake | Client `DecisionEngine` | `generate-recommendation` function |
| LLM draft | Client `InvokeLLM` | Same function (service role) |
| Save | `CommunicationDecision.create` | `save-decision` (sets `owner_email`) |
| History | `entity.list` (no owner filter) | `list-decisions` (owner scoped) |
| Archive | `entity.update` by id | `archive-decision` (owner check) |

## Backend functions

- `generate-recommendation` — validate intake, score (same rules), InvokeLLM, return decision draft
- `save-decision` — persist with `owner_email` from `auth.me()`
- `list-decisions` — filter by `owner_email`
- `archive-decision` — update only if owner (or admin)

Scoring source of truth for tests: `src/lib/decisionEngine.js`  
Deployed copy is embedded in `base44/functions/generate-recommendation/entry.ts` — keep in sync.

## Local

```bash
cd cadence
cp .env.example .env.local
npm install
npm test
npm run dev
```

Deploy to the live Base44 app (requires Base44 CLI auth or `BASE44_API_TOKEN`):

```bash
npx base44 login
# link / deploy against app 6a7338f6106b1962aa31c00a
npx base44 deploy --app-id 6a7338f6106b1962aa31c00a
```

Also confirm in the Base44 entity editor that direct client `create/list/update` on `CommunicationDecision` is locked down so callers must use these functions.
