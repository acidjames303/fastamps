# Directory & authority submissions tracker

Updated: 19 Nov 2026 (Europe/London)

Status key: `ready` = copy prepared · `owner` = needs James/JP login or verification · `submitted` · `live` · `blocked`

| Destination | Type | Priority | Status | Notes |
|-------------|------|----------|--------|-------|
| Google Search Console | Indexing | P0 | owner | Verify domain, submit sitemap, inspect `/` `/services` `/playground` |
| Bing Webmaster Tools | Indexing | P0 | owner | Import GSC or verify; submit sitemap; enable IndexNow if available |
| Google Business Profile | Local/entity | P0 | owner | Service-area business (UK consultancy); categories: Software company / Business management consultant |
| LinkedIn Company Page | Social/entity | P0 | owner | Create **SmartFunction**; add website + logo; post Playground launch; add to schema `sameAs` |
| LinkedIn personal amplification | Social | P1 | ready | Reshare company posts from JP; pin Playground + Services |
| IndexNow | Indexing | P1 | ready | Add key file via Base44 once Bing/IndexNow enabled |
| FreeIndex (UK) | Directory | P1 | ready | Use listing-copy.md medium blurb |
| Yell.com | Directory | P1 | owner | UK business listing; verify phone/email |
| Clutch.co | Agency directory | P1 | ready | Apply as custom software / AI |
| DesignRush | Agency directory | P2 | ready | Web / custom software profile |
| GoodFirms | Directory | P2 | ready | Software development |
| Capterra / G2 | Software | P2 | blocked | Productised SaaS fit is weak; skip until a packaged product exists |
| Product Hunt | Launch | P2 | owner | Launch “SmartFunction Playground” as maker |
| BetaList | Launch | P2 | ready | Startup listing |
| Indie Hackers | Community | P2 | owner | Product page + build-in-public thread |
| AlternativeTo | Directory | P2 | ready | Alternatives to spreadsheet-heavy ops tools / generic automation |
| SaaSHub | Directory | P2 | ready | Business automation |
| Reddit (r/smallbusinessuk, r/EntrepreneurUK) | Community | P3 | owner | Value-first answers only; no spam |
| Companies House / legal entity page | Trust | P1 | owner | If Ltd exists, publish consistent legal name on About + schema |
| GitHub Topics / public repo | Developer presence | P2 | submitted | This `fastamps` SEO monitor repo documents the brand + URL |

## Submission package checklist (every directory)

- [ ] Brand spelled **SmartFunction** (one word, capital S+F)
- [ ] URL https://smartfunction.io (no UTM on canonical listings)
- [ ] Email jp@smartfunction.io
- [ ] UK / United Kingdom location
- [ ] Categories match software + automation (not “marketing agency” unless forced)
- [ ] No fabricated reviews or client logos
- [ ] Link back target: homepage or /services

## Automated outreach this agent can do without your login

- Maintain listing copy + tracker in this repo  
- Ping public sitemap endpoints (legacy; prefer GSC/Bing)  
- Re-crawl live site weekly via `seo_monitor.py`  
- Prepare Base44 SEO payloads for dashboard/API apply  

## Needs your login / verification (cannot complete from this VM)

- Google Search Console & Business Profile  
- Bing Webmaster  
- LinkedIn Company Page creation  
- Yell / most UK directories that email-verify the owner  
- Product Hunt maker account  

When those accounts exist, paste invite access or run `apply_base44_seo.py` with `BASE44_*` secrets so the next agent pass can push on-site fixes automatically.
