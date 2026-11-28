// Remembers the company a caller was on in each dialling queue, so reopening
// the Dialer resumes where they left off instead of restarting at company 1.
// Keyed per user and per queue (list, calling session, or the whole pool).
// Also keeps a single "last resume" snapshot for Today → one-click continue.

const KEY_PREFIX = "cadence_dial_pos_";
const LAST_RESUME_PREFIX = "cadence_last_dial_";

const storageKey = (userId, queueKey) => (userId && queueKey ? `${KEY_PREFIX}${userId}_${queueKey}` : null);
const lastResumeKey = (userId) => (userId ? `${LAST_RESUME_PREFIX}${userId}` : null);

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

export function readLastDialResume(userId) {
  const key = lastResumeKey(userId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.companyId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLastDialResume(userId, snapshot) {
  const key = lastResumeKey(userId);
  if (!key || !snapshot?.companyId) return;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        companyId: snapshot.companyId,
        companyName: snapshot.companyName || "",
        listId: snapshot.listId || "",
        campaignName: snapshot.campaignName || "",
        queueKey: snapshot.queueKey || "",
        at: snapshot.at || new Date().toISOString(),
      }),
    );
  } catch { /* ignore */ }
}

export function clearLastDialResume(userId) {
  const key = lastResumeKey(userId);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}