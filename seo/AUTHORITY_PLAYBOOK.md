# Authority, AI Overviews, social & Google — playbook

Goal: make **SmartFunction** a citeable entity for UK “bespoke apps / AI automation / sales systems” queries.

## 1. Entity consistency (do first)

Everywhere the brand appears, use the same facts:

- Name: **SmartFunction**
- URL: https://smartfunction.io
- Email: jp@smartfunction.io
- Geo: United Kingdom
- Positioning: founder-led studio · bespoke apps · AI automation · connected operations

Add LinkedIn Company URL to site footer + Organization `sameAs` as soon as the page exists.

## 2. Google

1. **Search Console** — verify domain, submit sitemap after private URLs are removed  
2. **URL Inspection** — request indexing for `/`, `/services`, `/playground`, `/work`, `/approach`  
3. **Business Profile** — service-area consultancy (not a storefront); categories Software company / IT consultant  
4. **Reviews** — only request after real delivered work; never fabricate  

## 3. AI Overviews / GEO

AI answer engines prefer clear entities + answer-shaped pages.

| Lever | Action |
|-------|--------|
| Clean `llms.txt` | Public pages only with blurbs (`seo/base44/llms.txt`) |
| FAQ schema | Approach FAQs already drafted in `seo-settings-payload.json` |
| Insights | Publish drafts in `seo/content/insights-drafts.md` |
| Citeable Work | Keep honest case narratives; avoid empty marketing adjectives |
| Playground | Unique interactive URL — share it; it differentiates SERP/AI citations |

## 4. Social

| Channel | Action |
|---------|--------|
| LinkedIn Company | Create page; weekly post: bottleneck → system sketch → CTA to Playground or Contact |
| LinkedIn personal (JP) | Amplify company posts; pin “Introducing SmartFunction” + Playground |
| X / YouTube | Optional later — only if cadence is sustainable |
| Newsletter | If relaunched, archive issues on Insights for indexable permanence |

Post ideas (no hype):

1. “We mapped a 5-step sales follow-up that lived in memory — here’s the system shape.”  
2. “Spreadsheet → app decision checklist.”  
3. “One free Playground analysis — what we look for.”  

## 5. Directories (quality over volume)

Priority order in `seo/directories/submissions.md`. Prefer UK-relevant and software directories with editorial review (Clutch, GoodFirms, FreeIndex, Yell) over mass submission sites.

Skip G2/Capterra until there is a packaged product with seats/reviews.

## 6. Linkable assets to create on-site

1. Playground (exists) — promote  
2. Insights series (drafted)  
3. Public “smallest useful version” checklist PDF/page  
4. Open process templates exported from Playground  

## 7. Measurement

Weekly: `python3 scripts/seo_monitor.py`  
Monthly: Search Console impressions for brand + “bespoke business app UK” style queries; directory referral traffic; LinkedIn company followers.
