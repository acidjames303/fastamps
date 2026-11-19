# SmartFunction SEO Audit — 19 Nov 2026 (Europe/London)

**Site:** https://smartfunction.io  
**Platform:** Base44 (Render/Cloudflare edge)  
**Contact:** jp@smartfunction.io · Founder-led · United Kingdom

## Executive score

| Area | Score | Notes |
|------|------:|-------|
| Technical foundations | 72/100 | HTTPS, www→apex, robots allow, canonicals present |
| Index hygiene | 28/100 | Private pages in sitemap + llms.txt; thin auth pages indexable |
| On-page meta | 45/100 | Homepage strong; other pages use boilerplate descriptions |
| Structured data | 55/100 | WebSite + Organization + Breadcrumb; missing LocalBusiness/FAQ/Service |
| Content / GEO | 35/100 | Strong service copy; Insights empty; no FAQ schema; thin AI citation surface |
| Authority / off-site | 20/100 | Almost no indexed brand SERP; LinkedIn launch post only; no company page / GBP / directories |
| Social / OG | 70/100 | OG + Twitter cards on; image OK; missing twitter:site / sameAs profiles |

**Overall: ~46/100** — solid homepage craft, weak discovery infrastructure.

## What is already good

- Clear brand H1 and differentiated positioning (“built around your business”)
- Homepage custom title + description (not the Base44 template)
- Canonical tags on audited pages
- Organization + WebSite JSON-LD present
- BreadcrumbList on interior pages
- `robots.txt` allows crawl and points at sitemap
- `llms.txt` exists (good for AI crawlers once cleaned)
- HTTPS + HSTS; www and http redirect to apex
- Privacy/cookies correctly `noindex`
- Playground is a unique interactive asset (linkable, demoable)
- Honest Work / Approach content suitable for trust and AI citations

## Critical issues (fix first)

### 1. Private / utility URLs are in the sitemap and llms.txt

Currently listed at priority 0.8:

- `/admin` and all `/admin/*`
- `/login`, `/register`, `/mfa`
- `/forgot-password`, `/reset-password`

These dilute crawl budget, risk thin-page indexing, and teach AI crawlers the wrong site map.

**Fix in Base44 → SEO & GEO → Pages → turn “In search” OFF** for each. That removes them from sitemap + llms.txt and adds `noindex,nofollow`.

### 2. Template meta descriptions on almost every non-home page

Pattern observed:

> `{Page} on SMARTFUNCTION. A premium digital agency platform delivering bespoke business applications.`

That language is generic, not UK-intent, and weak for snippets / AI Overviews. Ready replacements live in `seo/base44/page-meta.json`.

### 3. Insights has zero published articles

AI Overviews and long-tail organic rely on answer-shaped content. An empty Insights hub is a missed GEO/SEO asset. Drafts: `seo/content/insights-drafts.md`.

### 4. Near-zero off-site authority

`site:smartfunction.io` returns effectively no meaningful third-party corroboration. Brand SERPs are dominated by unrelated “Smart*” competitors. Need NAP consistency, Google Business Profile, LinkedIn Company Page, and curated directories.

### 5. Organization schema is minimal

Missing: `sameAs`, `email`, `description`, `areaServed`, `contactPoint`, `foundingDate`, address/country. Weak for Knowledge Panel / entity understanding.

## Medium priority

| Issue | Impact | Action |
|-------|--------|--------|
| No `FAQPage` schema despite Approach FAQs | Lost rich results + AI answers | Inject FAQ JSON-LD (`seo/schema/faq.json`) |
| No `ProfessionalService` / `Service` schema | Weak entity for “bespoke apps UK” queries | Add service schema |
| Homepage canonical lacks trailing consistency vs interior | Minor | Prefer `https://smartfunction.io/` everywhere |
| No social profile links in footer / schema | Authority + OG click-through | Add LinkedIn company + sameAs |
| Admin pages return 200 without robots noindex | Index risk | noindex via Base44 toggle |
| Google/Bing sitemap ping endpoints deprecated/410 | Process | Use Search Console / Webmaster Tools / IndexNow |
| Brand confusion (“Smart Function”, SmartApps, SCA) | Cannibalization | Consistent “SmartFunction” + jp@ + UK founder NAP |

## AI Overviews / GEO checklist

1. Clean `llms.txt` to public pages only with useful one-line blurbs (`seo/base44/llms.txt`)
2. Publish 4–6 Insights posts that answer “how / what / when” questions UK operators ask
3. Mark up Approach FAQs
4. Keep Playground and Work case narratives factual (AI systems prefer citeable specifics)
5. Earn mentions on LinkedIn, directories, and partner sites with exact brand + URL

## Social & Google awareness

| Channel | Status | Next step |
|---------|--------|-----------|
| Google Search Console | Unknown / not evidenced | Verify property, submit sitemap, request indexing for `/`, `/services`, `/work`, `/playground` |
| Bing Webmaster | Unknown | Same |
| Google Business Profile | Not found | Create UK service-area business (founder consultancy) |
| LinkedIn Company | Not found (personal launch post exists) | Create SmartFunction company page; link from site + schema `sameAs` |
| X / Twitter | No clear brand handle in markup | Optional; add `twitter:site` if created |
| Product Hunt / BetaList / Indie Hackers | Not listed | Use copy in `seo/directories/` |
| UK directories | Not listed | Yell / FreeIndex / Clutch / DesignRush packages prepared |

## Measurement

Run weekly:

```bash
python3 scripts/seo_monitor.py --json reports/latest.json --md reports/latest.md
```

GitHub Action: `.github/workflows/seo-monitor.yml` (Mondays).

Pass criteria after Base44 apply:

- Sitemap ≤ public URLs only
- Zero public pages with boilerplate “on SMARTFUNCTION” description
- Admin/auth pages `noindex`
- Organization schema includes `sameAs` + `email`
- Insights ≥ 1 live article
