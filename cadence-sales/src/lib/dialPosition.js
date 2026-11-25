// Remembers the company a caller was on in each dialling queue, so reopening
// the Dialer resumes where they left off instead of restarting at company 1.
// Keyed per user and per queue (list, calling session, or the whole pool).

const KEY_PREFIX = "cadence_dial_pos_";

const storageKey = (userId, queueKey) => (userId && queueKey ? `${KEY_PREFIX}${userId}_${queueKey}` : null);

export function readDialPosition(userId, queueKey) {
  const key = storageKey(userId, queueKey);
  if (!key) return "";
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function saveDialPosition(userId, queueKey, companyId) {
  const key = storageKey(userId, queueKey);
  if (!key || !companyId) return;
  try {
    localStorage.setItem(key, companyId);
  } catch { /* private mode or storage full */ }
}

export function clearDialPosition(userId, queueKey) {
  const key = storageKey(userId, queueKey);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}