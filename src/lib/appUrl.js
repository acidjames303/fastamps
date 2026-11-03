// QR codes are printed and scanned away from the app, so every generated link
// must use the live custom domain rather than a preview or stale host.
export const FASTAMPS_CONNECT_URL = 'https://connect.fastamps.com';

export const createClaimUrl = (claimToken) =>
  `${FASTAMPS_CONNECT_URL}/claim/${encodeURIComponent(claimToken)}`;

export const GENERIC_REGISTRATION_URL = `${FASTAMPS_CONNECT_URL}/register-install`;

// Tradeshow QR: opens the stand charger with its serial number and PIN already
// resolved, and flags the sign-up as a demo so rewards are never paid.
export const createTradeShowUrl = (claimToken) =>
  `${createClaimUrl(claimToken)}?demo=1`;