// Client-side helpers for the Today workspace — labels, badges, formatting.

export const TASK_TYPE_LABELS = {
  new_call: "New call",
  callback: "Callback",
  follow_up: "Follow-up",
  revisit: "Revisit",
  research_review: "Research review",
  data_review: "Data review",
  opportunity_review: "Opportunity review",
  manual: "Task",
};

export const PRIORITY_BAND_STYLE = {
  urgent: "bg-rose-50 text-rose-700 border-rose-200",
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  normal: "bg-sky-50 text-sky-700 border-sky-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

export const TASK_TYPE_ICON = {
  new_call: "Phone",
  callback: "PhoneCall",
  follow_up: "CalendarClock",
  revisit: "MessageSquare",
  research_review: "Search",
  data_review: "AlertCircle",
  opportunity_review: "TrendingUp",
  manual: "ListTodo",
};

export function firstName(fullName) {
  if (!fullName) return "";
  return fullName.split(" ")[0];
}

export function formatDueTime(iso, tz) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz || "Europe/London",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function formatRelativeOverdue(iso, tz) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return formatDueTime(iso, tz);
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "overdue";
  if (hours < 24) return `${hours}h overdue`;
  return `${Math.floor(hours / 24)}d overdue`;
}

export function formatLastCalled(iso, tz) {
  if (!iso) return "Never";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz || "Europe/London",
      day: "numeric", month: "short",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export const SECTION_META = {
  due_now: { label: "Due now", tone: "text-rose-600" },
  overdue: { label: "Overdue", tone: "text-rose-600" },
  previous_conversations: { label: "Previous conversations", tone: "text-amber-600" },
  new_prospects: { label: "New prospects", tone: "text-emerald-600" },
  needs_review: { label: "Needs review", tone: "text-sky-600" },
  needs_scheduling: { label: "Needs scheduling", tone: "text-slate-500" },
  completed_today: { label: "Completed today", tone: "text-slate-400" },
};