// Printed charger labels leave the app, so production claim links always use
// the live custom domain. Beta/custom hosts generate claim links for their own
// origin so test scans never hit the production database.
export const FASTAMPS_CONNECT_URL = 'https://connect.fastamps.com';

/** Static website QR only — never a /claim path, never ?demo=1. */
export const STATIC_WEBSITE_URL = FASTAMPS_CONNECT_URL;

const BETA_CLAIM_HOSTS = new Set([
  'connect-test.fastamps.com',
]);

export function getClaimBaseUrl() {
  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (BETA_CLAIM_HOSTS.has(hostname)) return origin;
  }
  return FASTAMPS_CONNECT_URL;
}

export const createClaimUrl = (claimToken) =>
  `${getClaimBaseUrl()}/claim/${encodeURIComponent(claimToken)}`;

export const GENERIC_REGISTRATION_URL = `${getClaimBaseUrl()}/register-install`;
