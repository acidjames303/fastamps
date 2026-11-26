// How long an enrichment session ran, and how to show it.
//
// A finished session must be measured to its last recorded activity. Measuring it
// to "now" is what produced a runaway 121824:07 counter on a session that had
// finished in seven minutes weeks earlier.

const STALL_MINUTES = 30;

export function sessionElapsedSeconds(session, now = Date.now()) {
  const started = session?.started_at || session?.created_date;
  if (!started) return 0;
  const start = new Date(started).getTime();
  if (!Number.isFinite(start)) return 0;

  const running = ["queued", "processing"].includes(session?.status);
  const finishedAt = session?.completed_at || session?.last_activity_at;
  const endMs = running ? now : new Date(finishedAt || started).getTime();
  const end = Number.isFinite(endMs) ? Math.max(start, endMs) : start;
  return Math.max(0, Math.round((end - start) / 1000));
}

// A session still marked processing but with no activity for a long time is
// stalled, not running: its timer should stop rather than count up forever.
export function sessionIsStalled(session, now = Date.now()) {
  if (session?.status !== "processing") return false;
  const last = session?.last_activity_at || session?.started_at;
  if (!last) return false;
  const lastMs = new Date(last).getTime();
  if (!Number.isFinite(lastMs)) return false;
  return now - lastMs > STALL_MINUTES * 60 * 1000;
}

export function formatElapsed(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}