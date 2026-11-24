import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Phone, MessageSquare, UserCheck, Target, TrendingUp, Award } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { isConversation, isConnectedCall } from "@/lib/outcomeRules";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

export default function PerformanceInsights() {
  const { user } = useAuth();
  const [calls, setCalls] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30d");

  useEffect(() => {
    (async () => {
      try {
        const [callRes, meetingRes] = await Promise.all([
          base44.entities.CallLog.list("-created_date", 500),
          base44.entities.Meeting.list("-created_date", 200).catch(() => []),
        ]);
        const isCallerOnly = user?.app_role === "bdm";
        const scoped = isCallerOnly
          ? (callRes || []).filter((c) => c.user_id === user?.id || c.assigned_user_id === user?.id || c.created_by_user_id === user?.id)
          : (callRes || []);
        setCalls(scoped);
        setMeetings(meetingRes || []);
      } catch {} finally { setLoading(false); }
    })();
  }, [user?.id, user?.app_role]);

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;

  const filtered = useMemo(() => {
    if (!calls) return [];
    if (range === "all") return calls;
    const cutoff = new Date(Date.now() - days * 86400000);
    return calls.filter((c) => {
      const d = c.started_at || c.created_date;
      return d && new Date(d) >= cutoff;
    });
  }, [calls, range, days]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const connected = filtered.filter(isConnectedCall).length;
    const conversations = filtered.filter(isConversation).length;
    const dm = filtered.filter((c) => isConversation(c) && (c.conversation_type || "") === "decision_maker").length;
    const meetingCount = meetings.filter((m) => {
      if (range === "all") return true;
      const cutoff = new Date(Date.now() - days * 86400000);
      return m.created_date && new Date(m.created_date) >= cutoff;
    }).length;
    return {
      total, connected, conversations, dm, meetings: meetingCount,
      connectRate: total ? Math.round((connected / total) * 100) : 0,
      convRate: total ? Math.round((conversations / total) * 100) : 0,
      meetingRate: conversations ? Math.round((meetingCount / conversations) * 100) : 0,
    };
  }, [filtered, meetings, range, days]);

  const perDay = useMemo(() => {
    const buckets = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().split("T")[0];
      buckets.push({ date: d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit" }), key, calls: 0, connected: 0 });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    for (const c of calls || []) {
      const d = c.started_at || c.created_date;
      if (!d) continue;
      const b = map.get(new Date(d).toISOString().split("T")[0]);
      if (b) { b.calls++; if (isConnectedCall(c)) b.connected++; }
    }
    return buckets;
  }, [calls]);

  const bestDay = useMemo(() => {
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const c of filtered) {
      const d = c.started_at || c.created_date;
      if (d) counts[new Date(d).getDay()]++;
    }
    const max = Math.max(...counts);
    return max === 0 ? null : { day: dow[counts.indexOf(max)], count: max };
  }, [filtered]);

  const funnel = [
    { stage: "Calls attempted", value: stats.total, fill: "#64748b" },
    { stage: "Connected", value: stats.connected, fill: "#0ea5e9" },
    { stage: "Conversations", value: stats.conversations, fill: "#10b981" },
    { stage: "DM reached", value: stats.dm, fill: "#6366f1" },
    { stage: "Meetings", value: stats.meetings, fill: "#8b5cf6" },
  ];

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">Performance Insights</h1>
          <p className="text-slate-500 mt-2">Your personal calling productivity — connect rates, conversion progress and momentum.</p>
        </div>
        <select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Phone} label="Calls attempted" value={stats.total} tone="text-slate-900" />
        <Stat icon={Phone} label="Connect rate" value={`${stats.connectRate}%`} sub={`${stats.connected} connected`} tone="text-sky-600" />
        <Stat icon={MessageSquare} label="Conversations" value={stats.conversations} sub={`${stats.convRate}% of calls`} tone="text-emerald-600" />
        <Stat icon={Target} label="Meetings" value={stats.meetings} sub={`${stats.meetingRate}% of conversations`} tone="text-violet-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-1">Conversion funnel</h3>
          <p className="text-xs text-slate-400 mb-4">From dialled number to booked meeting.</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funnel} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: "#94a3b8" }} allowDecimals={false} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 12, fill: "#475569" }} width={110} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {funnel.map((f, i) => <Cell key={i} fill={f.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-1">Calls per day</h3>
          <p className="text-xs text-slate-400 mb-4">Last 14 days — total vs connected.</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={perDay}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} interval={1} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="calls" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="connected" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <Award className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-2xl font-display font-semibold text-slate-900">{bestDay ? bestDay.day : "—"}</p>
          <p className="text-xs text-slate-400 mt-1">{bestDay ? `${bestDay.count} calls — your best day` : "No calls in range yet"}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <UserCheck className="w-5 h-5 text-indigo-500 mb-2" />
          <p className="text-2xl font-display font-semibold text-slate-900">{stats.dm}</p>
          <p className="text-xs text-slate-400 mt-1">Decision-maker conversations</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <TrendingUp className="w-5 h-5 text-emerald-500 mb-2" />
          <p className="text-2xl font-display font-semibold text-slate-900">{perDay.reduce((s, d) => s + d.calls, 0)}</p>
          <p className="text-xs text-slate-400 mt-1">Calls in the last 14 days</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <Icon className="w-5 h-5 text-slate-400 mb-2" />
      <p className={`text-2xl font-display font-semibold ${tone}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}{sub ? ` · ${sub}` : ""}</p>
    </div>
  );
}