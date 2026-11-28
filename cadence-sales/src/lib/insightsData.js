import { isConnectedCall, isConversation } from "@/lib/outcomeRules";

const DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const RANGES = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "all", label: "All time" },
];

const rangeDays = (range) => ({ "7d": 7, "30d": 30, "90d": 90 }[range] || null);

const callDate = (call) => {
  const raw = call.started_at || call.created_date;
  return raw ? new Date(raw) : null;
};

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export function filterCalls(calls, range) {
  const days = rangeDays(range);
  if (!days) return calls || [];
  const cutoff = Date.now() - days * DAY;
  return (calls || []).filter((call) => {
    const date = callDate(call);
    return date && date.getTime() >= cutoff;
  });
}

export function filterMeetings(meetings, range) {
  const days = rangeDays(range);
  if (!days) return meetings || [];
  const cutoff = Date.now() - days * DAY;
  return (meetings || []).filter(
    (meeting) => meeting.created_date && new Date(meeting.created_date).getTime() >= cutoff
  );
}

const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

export function computeStats(calls, meetings) {
  const total = calls.length;
  const connected = calls.filter(isConnectedCall).length;
  const conversations = calls.filter(isConversation).length;
  const decisionMakers = calls.filter(
    (call) => isConversation(call) && (call.conversation_type || "") === "decision_maker"
  ).length;
  const meetingCount = meetings.length;

  return {
    total,
    connected,
    conversations,
    decisionMakers,
    meetings: meetingCount,
    connectRate: pct(connected, total),
    convRate: pct(conversations, total),
    meetingRate: pct(meetingCount, conversations),
  };
}

export function busiestDay(calls) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  calls.forEach((call) => {
    const date = callDate(call);
    if (date) counts[date.getDay()] += 1;
  });
  const max = Math.max(...counts);
  if (!max) return null;
  return { day: names[counts.indexOf(max)], count: max };
}

// Buckets match the selected range: days for 7/30, weeks for 90, months for all time.
export function buildTrend(calls, range) {
  const now = new Date();
  const buckets = [];

  if (range === "all") {
    for (let i = 11; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      buckets.push({
        label: MONTHS[start.getMonth()],
        from: start.getTime(),
        to: end.getTime(),
        calls: 0,
        connected: 0,
      });
    }
  } else if (range === "90d") {
    const endToday = startOfDay(now) + DAY;
    for (let i = 12; i >= 0; i -= 1) {
      const to = endToday - i * 7 * DAY;
      const from = to - 7 * DAY;
      buckets.push({
        label: new Date(from).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        from,
        to,
        calls: 0,
        connected: 0,
      });
    }
  } else {
    const days = range === "7d" ? 7 : 30;
    for (let i = days - 1; i >= 0; i -= 1) {
      const from = startOfDay(now) - i * DAY;
      const date = new Date(from);
      buckets.push({
        label:
          days === 7
            ? date.toLocaleDateString("en-GB", { weekday: "short" })
            : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        from,
        to: from + DAY,
        calls: 0,
        connected: 0,
      });
    }
  }

  calls.forEach((call) => {
    const date = callDate(call);
    if (!date) return;
    const time = date.getTime();
    const bucket = buckets.find((item) => time >= item.from && time < item.to);
    if (bucket) {
      bucket.calls += 1;
      if (isConnectedCall(call)) bucket.connected += 1;
    }
  });

  return buckets;
}

export function trendCaption(range) {
  if (range === "all") return "Monthly totals, last 12 months.";
  if (range === "90d") return "Weekly totals across the last 90 days.";
  if (range === "7d") return "Daily totals across the last 7 days.";
  return "Daily totals across the last 30 days.";
}

export function tickInterval(range) {
  if (range === "30d") return 4;
  if (range === "90d") return 1;
  return 0;
}