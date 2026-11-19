# SmartFunction SEO Monitor

Operational SEO toolkit for **[smartfunction.io](https://smartfunction.io)** (Base44).

This repo does not host the marketing site. The live app runs on Base44. Use this project to:

1. **Audit** live technical and on-page SEO
2. **Apply** ready-made Base44 SEO settings (dashboard paste or API)
3. **Expand** authority via directories, AI overviews, and social presence
4. **Monitor** regressions on a schedule

## Quick start

```bash
python3 scripts/seo_monitor.py --json reports/latest.json --md reports/latest.md
```

Optional Base44 apply (needs secrets):

```bash
export BASE44_APP_ID=...
export BASE44_API_KEY=...
python3 scripts/apply_base44_seo.py --dry-run
python3 scripts/apply_base44_seo.py
```

## Layout

| Path | Purpose |
|------|---------|
| `seo/AUDIT.md` | Current audit findings |
| `seo/base44/` | Meta, noindex, schema, llms.txt payloads for Base44 |
| `seo/directories/` | Listing copy + submission tracker |
| `seo/content/` | AI Overview / Insights drafts |
| `scripts/seo_monitor.py` | Live crawl + scoring |
| `scripts/apply_base44_seo.py` | Push settings via Base44 API |
| `.github/workflows/seo-monitor.yml` | Weekly crawl report |

## Priority fixes (Base44 dashboard)

1. Turn **In search** OFF for admin, login, register, MFA, password pages
2. Replace template meta descriptions on public pages
3. Enrich Organization schema (sameAs, email, areaServed, description)
4. Publish first Insights articles (empty blog blocks AI Overview growth)
5. Submit sitemap in Google Search Console + Bing Webmaster Tools

Details: [`seo/AUDIT.md`](seo/AUDIT.md)
