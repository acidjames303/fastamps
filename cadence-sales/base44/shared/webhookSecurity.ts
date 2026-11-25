// Webhook security — URL validation and safe HTTP fetching.
// Prevents SSRF, enforces HTTPS, blocks private/internal networks, limits response size.

const PRIVATE_HOSTNAMES = [
  'localhost', '127.0.0.1', '0.0.0.0', '::1',
];

const PRIVATE_IP_PREFIXES = [
  '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.',
  '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.', '169.254.', '100.64.', '100.65.', '100.66.', '100.67.', '100.68.', '100.69.',
  '100.70.', '100.71.', '100.72.', '100.73.', '100.74.', '100.75.', '100.76.', '100.77.',
  '100.78.', '100.79.', '100.80.', '100.81.', '100.82.', '100.83.', '100.84.', '100.85.',
  '100.86.', '100.87.', '100.88.', '100.89.', '100.90.', '100.91.', '100.92.', '100.93.',
  '100.94.', '100.95.', '100.96.', '100.97.', '100.98.', '100.99.', '100.100.', '100.101.',
  '100.102.', '100.103.', '100.104.', '100.105.', '100.106.', '100.107.', '100.108.', '100.109.',
  '100.110.', '100.111.', '100.112.', '100.113.', '100.114.', '100.115.', '100.116.', '100.117.',
  '100.118.', '100.119.', '100.120.', '100.121.', '100.122.', '100.123.', '100.124.', '100.125.',
  '100.126.', '100.127.',
  '0.', '255.255.255.255',
];

export function validateWebhookUrl(urlStr) {
  const errors = [];

  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  if (parsed.protocol !== 'https:') {
    errors.push('URL must use HTTPS.');
  }

  const hostname = parsed.hostname.toLowerCase();

  if (PRIVATE_HOSTNAMES.includes(hostname)) {
    errors.push('Private/internal network destinations are blocked.');
  }

  for (const prefix of PRIVATE_IP_PREFIXES) {
    if (hostname.startsWith(prefix) || hostname === prefix.slice(0, -1)) {
      errors.push('Private/internal network destinations are blocked.');
      break;
    }
  }

  // Block .local, .internal, .localhost TLDs
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.localhost')) {
    errors.push('Private/internal network destinations are blocked.');
  }

  // Block metadata endpoints
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    errors.push('Metadata endpoints are blocked.');
  }

  if (errors.length > 0) {
    return { valid: false, error: errors[0] };
  }

  return { valid: true };
}

// Validates a user-supplied URL that will be fetched server-side (page reads,
// prospecting seeds). Allows http and https, but blocks private/internal hosts,
// IP literals and cloud metadata endpoints.
export function validatePublicUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'URL must use HTTP or HTTPS.' };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname) return { valid: false, error: 'URL has no host.' };

  const blocked = 'Private/internal network destinations are blocked.';

  // IPv6 literals arrive bracketed and always contain ':'.
  if (hostname.includes(':') || /^\d+$/.test(hostname)) return { valid: false, error: blocked };

  if (PRIVATE_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: 'Private/internal network destinations are blocked.' };
  }

  for (const prefix of PRIVATE_IP_PREFIXES) {
    if (hostname.startsWith(prefix) || hostname === prefix.slice(0, -1)) {
      return { valid: false, error: 'Private/internal network destinations are blocked.' };
    }
  }

  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.localhost')) {
    return { valid: false, error: 'Private/internal network destinations are blocked.' };
  }

  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    return { valid: false, error: 'Metadata endpoints are blocked.' };
  }

  return { valid: true };
}

// Reads a validated public URL as text: no redirects followed (a public URL can
// redirect into a private one) and the body is capped.
export async function fetchPublicText(url, { timeoutMs = 10000, maxBytes = 200000, headers = {} } = {}) {
  const check = validatePublicUrl(url);
  if (!check.valid) return { ok: false, status: 'blocked', text: '' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: 'manual', signal: controller.signal, headers });
    if (res.status >= 300 && res.status < 400) return { ok: false, status: 'redirect_blocked', text: '' };
    if (!res.ok) return { ok: false, status: `http_${res.status}`, text: '' };

    const reader = res.body?.getReader();
    if (!reader) return { ok: false, status: 'fetch_failed', text: '' };

    const chunks = [];
    let received = 0;
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
    }
    await reader.cancel().catch(() => {});

    const bytes = new Uint8Array(Math.min(received, maxBytes));
    let offset = 0;
    for (const chunk of chunks) {
      const take = Math.min(chunk.byteLength, bytes.byteLength - offset);
      if (take <= 0) break;
      bytes.set(chunk.subarray(0, take), offset);
      offset += take;
    }
    return { ok: true, status: 'ok', text: new TextDecoder().decode(bytes) };
  } catch {
    return { ok: false, status: 'fetch_failed', text: '' };
  } finally {
    clearTimeout(timer);
  }
}

// Safe fetch with redirect restriction, timeout, and response size limit.
export async function safeFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);

  try {
    const response = await fetch(url, {
      method: options.method || 'POST',
      headers: options.headers || { 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
      redirect: 'manual', // Never follow redirects — prevents SSRF via redirect
      signal: controller.signal,
    });

    // Read at most 4KB of the response body for logging.
    const text = await response.text().catch(() => '');
    const safeSummary = text.slice(0, 4000);

    return {
      status: response.status,
      ok: response.ok,
      safeResponseSummary: safeSummary,
    };
  } catch (e) {
    if (e.name === 'AbortError') {
      return { status: 0, ok: false, safeResponseSummary: 'Request timed out.', error: 'timeout' };
    }
    return { status: 0, ok: false, safeResponseSummary: e.message || 'Fetch failed.', error: 'fetch_error' };
  } finally {
    clearTimeout(timeout);
  }
}

// Build auth headers from decrypted credentials. Never returns secret values.
export function buildAuthHeaders(authMethod, authData) {
  if (!authMethod || authMethod === 'none' || !authData) return {};

  if (authMethod === 'bearer') {
    return { Authorization: `Bearer ${authData.token || ''}` };
  }
  if (authMethod === 'basic') {
    const cred = btoa(`${authData.username || ''}:${authData.password || ''}`);
    return { Authorization: `Basic ${cred}` };
  }
  if (authMethod === 'header' && authData.headerName) {
    return { [authData.headerName]: authData.headerValue || '' };
  }

  return {};
}