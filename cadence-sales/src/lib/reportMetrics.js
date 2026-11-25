// Client-report helpers — IR dedupe and client-safe note selection.

const IR_OUTCOMES = new Set([
  "connected_information_requested",
  "send_info",
]);

export function isInfoRequestLog(log) {
  if (!log) return false;
  return IR_OUTCOMES.has(log.primary_outcome || log.outcome);
}

/** Unique key for an IR (contact preferred, else company). */
export function infoRequestKey(log) {
  return log.contact_id || log.company_id || log.id;
}

/**
 * Count unique information requests vs raw IR call rows.
 * Recalls (is_info_recall or duplicate contact/company in period) inflate raw.
 */
export function countInfoRequests(logs) {
  const irLogs = (logs || []).filter(isInfoRequestLog);
  const uniqueKeys = new Set();
  let recalls = 0;
  for (const log of irLogs) {
    const key = infoRequestKey(log);
    if (log.is_info_recall) recalls += 1;
    if (uniqueKeys.has(key)) {
      if (!log.is_info_recall) recalls += 1;
    } else {
      uniqueKeys.add(key);
    }
  }
  return {
    raw: irLogs.length,
    unique: uniqueKeys.size,
    recalls: Math.max(recalls, Math.max(0, irLogs.length - uniqueKeys.size)),
  };
}

/** Prefer client_notes; never export internal_notes. */
export function clientSafeNotes(log) {
  if (!log) return "";
  return (log.client_notes || log.outcome_notes || log.notes || "").trim();
}

/** Date only (en-GB), never timestamps — clients scrutinised lunch breaks. */
export function clientSafeDate(log) {
  const raw = log?.started_at || log?.created_date || log?.outcome_saved_at;
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("en-GB");
  } catch {
    return String(raw).slice(0, 10);
  }
}
