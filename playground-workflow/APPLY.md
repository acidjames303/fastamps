# Apply Playground iterations (Base44)

App: https://smartfunction.io/playground  
App id: `6afb374c91d1c9194f9d6554`  
Auth: `npx base44 login` (device) or `BASE44_API_KEY`

## Status
- **001 live** (20 Nov 2026) — see `iterations/001-live.md`
- **002 live** (20 Nov 2026) — see `iterations/002-live.md` (compact templates, fit, full-width canvas)
- **003 live** (20 Nov 2026) — see `iterations/003-live.md` (denser toolbar + tighter hero; canvasY 665→584)
- **004 live** (20 Nov 2026) — see `iterations/004-live.md` (conversion honesty copy)
- **005 live** (20 Nov 2026) — see `iterations/005-live.md` (post-analysis what-happens-next)
- **006 live** (20 Nov 2026) — see `iterations/006-live.md` (email-gate step/connection counts)
- **007 live** (20 Nov 2026) — see `iterations/007-live.md` (dismissible connect coachmark)
- **008 live** (20 Nov 2026) — see `iterations/008-live.md` (mobile sticky list-order cue)
- **009 live** (20 Nov 2026) — see `iterations/009-live.md` (compare-tab current cue)
- **010 live** (20 Nov 2026) — see `iterations/010-live.md` (validation empathy copy)
- **011 live** (20 Nov 2026) — see `iterations/011-live.md` (surface orphan validation notes)
- **012 hold** (20 Nov 2026) — see `iterations/012-remeasure-hold.md` (gates green; no ship)
- **013 hold** (20 Nov 2026) — see `iterations/013-remeasure-hold.md` (gates green; no ship)
- **014 hold** (20 Nov 2026) — see `iterations/014-remeasure-hold.md` (gates green; no ship)
- **015 hold** (20 Nov 2026) — see `iterations/015-remeasure-hold.md` (gates green; no ship)
- **016 hold** (20 Nov 2026) — see `iterations/016-remeasure-hold.md` (gates green; no ship)
- **017 hold** (20 Nov 2026) — see `iterations/017-remeasure-hold.md` (gates green; no ship)
- **018 hold** (21 Nov 2026) — see `iterations/018-remeasure-hold.md` (gates green; no ship)
- **019 hold** (21 Nov 2026) — see `iterations/019-remeasure-hold.md` (gates green; no ship)
- **020 hold** (21 Nov 2026) — see `iterations/020-remeasure-hold.md` (gates green; no ship)
- **021 hold** (21 Nov 2026) — see `iterations/021-remeasure-hold.md` (gates green; no ship)
- **022 hold** (21 Nov 2026) — see `iterations/022-remeasure-hold.md` (gates green; no ship)
- **023 hold** (21 Nov 2026) — see `iterations/023-remeasure-hold.md` (gates green; no ship)
- **024 hold** (21 Nov 2026) — see `iterations/024-remeasure-hold.md` (gates green; no ship)
- **025 hold** (21 Nov 2026) — see `iterations/025-remeasure-hold.md` (gates green; no ship)
- **026 hold** (21 Nov 2026) — see `iterations/026-remeasure-hold.md` (gates green; no ship)
- **027 hold** (21 Nov 2026) — see `iterations/027-remeasure-hold.md` (gates green; no ship)
- **028 hold** (21 Nov 2026) — see `iterations/028-remeasure-hold.md` (gates green; no ship)

## Apply via sandbox (preferred when authenticated)
```bash
# edit files under src/routes/_site/playground.jsx and src/components/playground/*
npx base44 --app-id 6afb374c91d1c9194f9d6554 sandbox edit <path> --edits-json '...'
npx base44 --app-id 6afb374c91d1c9194f9d6554 sandbox checkpoint --name "…"
npx base44 --app-id 6afb374c91d1c9194f9d6554 api fetch POST /api/apps/6afb374c91d1c9194f9d6554/deploy --body '{}'
```

Key paths:
- `src/routes/_site/playground.jsx`
- `src/components/playground/*`
- `src/components/SiteHeader.jsx`
- SEO page meta: `PUT /api/apps/{id}/seo/settings` → `pages.Playground`

## Apply via Base44 chat
1. Paste `prompts/NEXT_BASE44.md`
2. Preview `/playground` → Publish
3. Reply **published** here

## Quick check after publish
- Meta not agency boilerplate  
- Hero mentions apps / automation / services  
- No `//` tips; sticky mobile CTA  
- After 002: canvas visible earlier; default fit shows 5-step chain
