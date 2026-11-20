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
