// Shared by the auth pages (Login, Register, and any page that resumes a flow
// after sign-in, e.g. the MCP OAuth consent page). Keep the redirect
// validation in one place — it is security-sensitive and easy to drift.

const PENDING_CLAIM_KEY = 'fastamps_pending_claim';

// Resolve our ?returnTo= parameter or Base44's ?from_url= parameter to a
// safe same-origin path, else "/". Base44 uses from_url when it redirects an
// unauthenticated visitor from a published deep link such as /claim/:token.
//
// The same-origin check alone is not enough: a value like /.//evil.com or
// /\evil.com parses same-origin but normalizes to a protocol-relative
// //evil.com when assigned to location.href — an open redirect. So require the
// resolved path to be exactly one leading slash (no "//" prefix, no backslash).
export function safeReturnTo() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("returnTo") || params.get("from_url");
  const fromParam = sanitiseAppPath(raw);
  if (fromParam && fromParam !== "/") {
    // Successful claim resume — drop any stale pending path.
    if (fromParam.startsWith("/claim/")) clearPendingClaimPath();
    return fromParam;
  }

  // Prefer a claim path stashed before login/register so a refresh or OAuth
  // round-trip cannot replace the pending charger with the dashboard.
  const pending = readPendingClaimPath();
  if (pending) return pending;
  return "/";
}

export function rememberPendingClaimPath(pathWithSearch) {
  const safe = sanitiseAppPath(pathWithSearch);
  if (!safe || !safe.startsWith("/claim/")) return;
  try {
    sessionStorage.setItem(PENDING_CLAIM_KEY, safe);
  } catch {
    // Private mode / blocked storage — returnTo query still carries the path.
  }
}

export function readPendingClaimPath() {
  try {
    return sanitiseAppPath(sessionStorage.getItem(PENDING_CLAIM_KEY) || "");
  } catch {
    return "";
  }
}

export function clearPendingClaimPath() {
  try {
    sessionStorage.removeItem(PENDING_CLAIM_KEY);
  } catch {
    // ignore
  }
}

function sanitiseAppPath(raw) {
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "";
    // Strip app-bootstrap params: app-params.js persists these from the URL into
    // localStorage before the SDK initializes, so a crafted returnTo could
    // otherwise poison the freshly issued session — repointing the app at an
    // attacker's backend (app_base_url/app_id/functions_version) or overwriting
    // the token. Also strip retired trade-show ?demo=1 so it cannot re-enter
    // installer registration or claim resolution.
    for (const p of [
      "access_token",
      "clear_access_token",
      "app_id",
      "app_base_url",
      "functions_version",
      "from_url",
      "returnTo",
      "demo",
    ]) {
      url.searchParams.delete(p);
    }
    const path = url.pathname + url.search;
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "";
    return path;
  } catch {
    return "";
  }
}
