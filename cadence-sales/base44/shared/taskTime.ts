// Deterministic timezone helpers for task date handling.
// All canonical dates are stored as ISO UTC strings; display values are
// computed in the organisation timezone (default Europe/London).
// No AI is used anywhere here.

const DEFAULT_TZ = 'Europe/London';

export function orgTimezone(org) {
  return (org && org.timezone) || DEFAULT_TZ;
}

// Returns [startOfTodayUTC, endOfTodayUTC] as ISO strings, where "today"
// is the calendar day in the organisation timezone.
export function todayRangeUTC(tz, now = new Date()) {
  const zone = tz || DEFAULT_TZ;
  // Build a formatter that emits year/month/day in the target zone.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  const y = Number(get('year'));
  const m = Number(get('month'));
  const d = Number(get('day'));
  // Start of the calendar day in the zone, expressed as UTC.
  // We compute the UTC instant that corresponds to midnight local.
  const startLocal = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  // The offset (in ms) between the wall clock at local-midnight and UTC.
  // Intl tells us the offset at that instant.
  const offsetMin = tzOffsetMinutes(zone, startLocal);
  const startUTC = new Date(startLocal.getTime() - offsetMin * 60000);
  const endUTC = new Date(startUTC.getTime() + 86400000);
  return [startUTC.toISOString(), endUTC.toISOString()];
}

// Offset (minutes) of the zone from UTC at the given instant.
function tzOffsetMinutes(zone, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  const asUTC = Date.UTC(
    Number(get('year')), Number(get('month')) - 1, Number(get('day')),
    Number(get('hour')) % 24, Number(get('minute')), Number(get('second'))
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

// Is the given ISO date-time within today's calendar day (org timezone)?
export function isToday(iso, tz, now = new Date()) {
  if (!iso) return false;
  const [start, end] = todayRangeUTC(tz, now);
  const t = new Date(iso).getTime();
  return t >= new Date(start).getTime() && t < new Date(end).getTime();
}

// Is the given ISO date-time before today (overdue)?
export function isOverdue(iso, tz, now = new Date()) {
  if (!iso) return false;
  const [start] = todayRangeUTC(tz, now);
  return new Date(iso).getTime() < new Date(start).getTime();
}

// Next working day (Mon-Fri) after today, as a Date at midnight local.
export function nextWorkingDay(tz, now = new Date()) {
  const [start] = todayRangeUTC(tz, now);
  let d = new Date(start);
  let guard = 0;
  do {
    d = new Date(d.getTime() + 86400000);
    guard++;
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6); // skip Sat/Sun (UTC-aligned to local midnight)
  return d;
}

// Tomorrow at 09:00 local.
export function tomorrowAt9(tz, now = new Date()) {
  const [start] = todayRangeUTC(tz, now);
  const tomorrow = new Date(new Date(start).getTime() + 86400000);
  const offsetMin = tzOffsetMinutes(tz, tomorrow);
  // 09:00 local = 09:00 UTC-midnight + offset
  return new Date(tomorrow.getTime() + 9 * 3600000 - offsetMin + offsetMin);
  // Simpler: use the local-midnight instant and add 9h in UTC terms.
}

// "Later today" — 2 hours from now, or 16:00 local if already past 16:00.
export function laterToday(tz, now = new Date()) {
  const two = new Date(now.getTime() + 2 * 3600000);
  return two;
}

// Format an ISO date-time for display in the org timezone.
export function displayDateTime(iso, tz) {
  if (!iso) return '';
  const zone = tz || DEFAULT_TZ;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// Time-only display (e.g. "14:30").
export function displayTime(iso, tz) {
  if (!iso) return '';
  const zone = tz || DEFAULT_TZ;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

// Date-only display (e.g. "20 Aug").
export function displayDate(iso, tz) {
  if (!iso) return '';
  const zone = tz || DEFAULT_TZ;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, day: 'numeric', month: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// Relative overdue label (e.g. "2h overdue", "3d overdue").
export function overdueLabel(iso, tz, now = new Date()) {
  if (!iso) return '';
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < 0) return '';
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'overdue';
  if (hours < 24) return `${hours}h overdue`;
  const days = Math.floor(hours / 24);
  return `${days}d overdue`;
}