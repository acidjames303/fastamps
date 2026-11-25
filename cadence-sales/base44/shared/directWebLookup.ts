// Direct web lookup — fast fallback when InvokeLLM's web search times out
// or returns nothing for obscure UK companies.
//
// Two strategies to find the company website:
//   1. Direct domain guessing — tries common UK TLDs derived from the name
//      (e.g. "Burnham Waters" → burnhamwaters.co.uk). Fast, no search engine.
//   2. Bing search — broader coverage for companies with non-obvious domains.
//
// Then fetches the homepage + contact/about pages and extracts phone numbers,
// emails, and decision-maker names from the page text.

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(limited|ltd|plc|inc|corp|llp|holdings|group|uk)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function slugifyHyphenated(name: string): string {
  return name.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(limited|ltd|plc|inc|corp|llp|holdings|group|uk)\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isNoiseDomain(domain: string): boolean {
  return /bing|microsoft|facebook|instagram|twitter|linkedin|youtube|wikipedia|yelp|trustpilot|companieshouse|find-and-update\.company-information|goo\.gl|google|statcounter|cookies|biographie|dictionary|encyclopedia|britannica|wiktionary|wikihow|archive\.org|reddit|quora|medium|glassdoor|indeed|zillow|rightmove|zoopla|primelocation|checkatrade|trustatrader/i.test(domain);
}

// Validate that the domain is plausibly the company's website — the domain
// slug should contain at least part of the company name slug (or vice versa).
function domainMatchesCompany(domain: string, companyName: string): boolean {
  const domainSlug = domain.replace(/\.(co\.uk|com|org|net|uk|io|co)$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const nameSlug = slugify(companyName);
  if (!domainSlug || !nameSlug) return false;
  // Check either direction — domain contains name, or name contains domain.
  // Allow partial matches (at least 4 chars) to handle abbreviations.
  const minLen = Math.min(domainSlug.length, nameSlug.length, 4);
  return domainSlug.includes(nameSlug.slice(0, minLen)) || nameSlug.includes(domainSlug.slice(0, minLen));
}

async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response | null> {
  try {
    return await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CadenceBot/1.0)' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
  } catch {
    return null;
  }
}

// Strategy 1: Guess the domain from the company name and check if it exists.
// Tries all protocols in parallel to avoid burning 16s on a non-existent domain.
async function tryDomain(domain: string): Promise<string | null> {
  const protos = ['https://www.', 'https://', 'http://www.', 'http://'];
  const results = await Promise.all(
    protos.map((proto) => fetchWithTimeout(`${proto}${domain}`, 3000))
  );
  for (let i = 0; i < protos.length; i++) {
    if (results[i] && results[i]!.ok) return `${protos[i]}${domain}`;
  }
  return null;
}

async function guessCompanyWebsite(companyName: string): Promise<string | null> {
  const compact = slugify(companyName);
  const hyphen = slugifyHyphenated(companyName);
  const candidates: string[] = [];

  for (const slug of [compact, hyphen]) {
    if (!slug) continue;
    candidates.push(`${slug}.co.uk`, `${slug}.com`);
  }

  // Try shorter variant: drop last word (e.g. "Briar Retirement Living" → "briarretirement")
  const words = companyName.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(limited|ltd|plc|inc|corp|llp|holdings|group|uk)\b/g, '')
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 1);
  if (words.length > 2) {
    const shorter = words.slice(0, -1).join('');
    candidates.push(`${shorter}.co.uk`, `${shorter}.com`);
  }

  for (const domain of [...new Set(candidates)]) {
    const url = await tryDomain(domain);
    if (url) return url;
  }
  return null;
}

// Strategy 2: Bing search (fallback when domain guessing fails).
async function bingSearch(companyName: string): Promise<string[]> {
  const query = `${companyName} UK`;
  const res = await fetchWithTimeout(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, 7000);
  if (!res || !res.ok) return [];
  const html = await res.text().catch(() => '');
  if (!html) return [];

  const urls = new Set<string>();
  // Bing wraps result domains in <cite> tags.
  const citeRe = /<cite[^>]*>([^<]+)<\/cite>/gi;
  let m;
  while ((m = citeRe.exec(html)) !== null) {
    let domain = m[1].replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (domain && !isNoiseDomain(domain)) {
      urls.add(`https://${domain}`);
    }
  }
  // Also scan href links.
  const linkRe = /href="(https?:\/\/(?!www\.bing|go\.microsoft|cc\.bing)[^"]+)"/gi;
  while ((m = linkRe.exec(html)) !== null) {
    const domain = extractDomain(m[1]);
    if (domain && !isNoiseDomain(domain)) {
      urls.add(`https://${domain}`);
    }
  }
  // Prefer .co.uk domains.
  return [...urls].sort((a, b) => {
    const aUk = a.includes('.co.uk') ? 0 : 1;
    const bUk = b.includes('.co.uk') ? 0 : 1;
    return aUk - bUk;
  }).slice(0, 3);
}

function extractPhones(text: string): string[] {
  const phones = new Set<string>();
  const re = /(?:(?:\+44\s?|0)(?:\d[\s-]?){9,10})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    let p = m[0].replace(/\s|-/g, '');
    if (p.startsWith('+44')) p = '0' + p.slice(3);
    if (p.length >= 10 && p.length <= 13) phones.add(p);
  }
  return [...phones];
}

function extractEmails(text: string): { personal: string[]; generic: string[] } {
  const personal = new Set<string>();
  const generic = new Set<string>();
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const e = m[0].toLowerCase();
    if (/^(info|sales|enquiries|contact|admin|hello|office|mail|general|reception)@/i.test(e)) {
      generic.add(e);
    } else {
      personal.add(e);
    }
  }
  return { personal: [...personal], generic: [...generic] };
}

async function fetchPageText(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, 6000);
  if (!res || !res.ok) return '';
  const html = await res.text().catch(() => '');
  if (!html) return '';
  return stripHtml(html);
}

// Fetch common contact/about page paths on the company domain — in parallel
// for speed, then return the longest result (most likely to have contact data).
async function fetchContactPages(baseUrl: string): Promise<string> {
  const domain = extractDomain(baseUrl);
  if (!domain) return '';
  const paths = ['/contact', '/contact-us', '/about', '/about-us', '/team', '/privacy'];
  const texts = await Promise.all(paths.map((p) => fetchPageText(`https://${domain}${p}`)));
  // Return the longest non-empty page — it's most likely to contain the data we need.
  return texts.filter((t) => t.length > 200).sort((a, b) => b.length - a.length)[0] || '';
}

// Main entry point — finds the company website and extracts contact info.
// If existingDomain is provided (e.g. from AI research), uses it directly
// instead of searching.
export async function directCompanyLookup(companyName: string, existingDomain?: string): Promise<any> {
  const result: any = {
    domain: '', website: '', landline: '', alternative_phones: [], contacts: [], email: '', industry: '', location: '',
  };

  let website = '';

  // If AI already found a domain, use it directly.
  if (existingDomain) {
    const domain = existingDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    website = await tryDomain(domain) || '';
  }

  // Strategy 1: Guess the domain from the company name.
  if (!website) {
    website = await guessCompanyWebsite(companyName).catch(() => null) || '';
  }

  // Strategy 2: Bing search fallback. Only accept domains that plausibly match
  // the company name — filter out irrelevant results (biography sites, social
  // media, directories, etc.).
  if (!website) {
    const candidates = await bingSearch(companyName);
    for (const url of candidates) {
      const domain = extractDomain(url);
      if (!domain || !domainMatchesCompany(domain, companyName)) continue;
      const text = await fetchPageText(url);
      if (text.length > 500) { website = url; break; }
    }
  }

  if (!website) return result;
  result.website = website;
  result.domain = extractDomain(website);

  // Fetch homepage + contact/about page.
  const homepageText = await fetchPageText(website);
  const contactText = await fetchContactPages(website);
  const allText = `${homepageText} ${contactText}`;

  if (!allText.trim()) return result;

  // Extract phone numbers — store the first as the landline and any additional
  // numbers as alternatives so the caller always has a fallback.
  const phones = extractPhones(allText);
  if (phones.length) {
    result.landline = phones[0];
    if (phones.length > 1) result.alternative_phones = phones.slice(1, 4);
  }

  // Extract emails (personal + generic).
  const { personal, generic } = extractEmails(contactText || homepageText);
  if (personal.length) result.email = personal[0];
  else if (generic.length) result.email = generic[0];

  // Extract decision-maker names from the contact/about page.
  // Looks for patterns like "John Smith - Managing Director" or "Jane Doe, CEO"
  const nameTitleRe = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[-,–—]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
  const titleKeywords = ['director', 'manager', 'head', 'ceo', 'cfo', 'cto', 'founder', 'partner', 'chairman', 'principal', 'managing', 'development', 'commercial', 'sales', 'operations'];
  let nm;
  const contacts: any[] = [];
  const sourceText = contactText || homepageText;
  while ((nm = nameTitleRe.exec(sourceText)) !== null && contacts.length < 5) {
    const name = nm[1].trim();
    const title = nm[2].trim();
    if (titleKeywords.some(t => title.toLowerCase().includes(t))) {
      contacts.push({ name, title, phone: '', email: '', linkedin: '' });
    }
  }
  result.contacts = contacts;

  return result;
}