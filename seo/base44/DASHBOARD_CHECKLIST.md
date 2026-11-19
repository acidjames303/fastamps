# Base44 SEO & GEO — apply checklist

Do this in the SmartFunction Base44 app dashboard. Takes ~20 minutes. Source files are in this folder.

## A. Hide private pages from search

**SEO & GEO → Pages → In search = OFF** for:

- Admin, Admin Insights, Admin Invite, Admin Playground, Admin Services, Admin Work  
- Login, Register, MFA  
- Forgot Password, Reset Password  

Confirm:

```bash
curl -sL https://smartfunction.io/sitemap.xml | grep -E 'admin|login|register|mfa|password' || echo 'CLEAN'
curl -sL https://smartfunction.io/llms.txt | grep -Ei 'admin|login|register' || echo 'CLEAN'
curl -sI https://smartfunction.io/login | tr -d '\r' | head -1
# page source should include noindex after toggle
```

## B. Replace meta titles & descriptions

**SEO & GEO → Meta tags** — edit each public page using `page-meta.json`.

Priority order: Home → Services → Playground → Work → Approach → About → Contact → Insights.

## C. Strengthen entity schema

**SEO & GEO → structured data / Organization & WebSite** (or ask Base44 AI to apply JSON-LD):

- Paste Organization + WebSite objects from `seo-settings-payload.json`
- Add FAQ schema from the same file (Approach FAQs)
- Optionally inject `../schema/professional-service.json` via custom JSON-LD

After LinkedIn Company Page exists, ensure `sameAs` includes it.

## D. llms.txt

Replace auto list with `llms.txt` in this folder (public pages only, useful blurbs).

## E. Search Console

1. Verify https://smartfunction.io in Google Search Console  
2. Submit https://smartfunction.io/sitemap.xml  
3. URL Inspection → Request indexing for `/`, `/services`, `/playground`, `/work`  
4. Repeat in Bing Webmaster Tools  

## F. API apply (optional)

```bash
export BASE44_APP_ID=...
export BASE44_API_KEY=...
python3 scripts/apply_base44_seo.py --dry-run
python3 scripts/apply_base44_seo.py
```

Endpoint used: `PATCH /api/apps/{app_id}/seo/settings` (Base44 public API).
