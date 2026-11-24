import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, PhoneCall, Sunrise, AlertCircle, CheckCircle2, Clock, Inbox, ArrowRight } from "lucide-react";
import TodayStats from "@/components/today/TodayStats";
import DayFlow from "@/components/today/DayFlow";
import OpportunitiesModal from "@/components/today/OpportunitiesModal";
import TodayResultsModal from "@/components/today/TodayResultsModal";
import TaskRow from "@/components/today/TaskRow";
import RescheduleOverdue from "@/components/today/RescheduleOverdue";
import ScheduleDialog from "@/components/today/ScheduleDialog";
import { firstName, formatLastCalled } from "@/lib/today";
import { useAuth } from "@/lib/AuthContext";
import ContextHelp from "@/components/help/ContextHelp";

export default function Today() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [work, setWork] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [scheduleRecord, setScheduleRecord] = useState(null);
  const [showOpps, setShowOpps] = useState(false);
  const [resultsFilter, setResultsFilter] = useState(null);
  const [pendingIrs, setPendingIrs] = useState(0);
  const isAdmin = ["platform_owner", "organisation_admin"].includes(user?.app_role);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setErr("");
    try {
      const res = await base44.functions.invoke("getTodayWork", {});
      const w = res.data || res;
      setWork(w);
    } catch (e) {
      setErr(e.message || "Could not load your work for today.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isAdmin) { setPendingIrs(0); return undefined; }
    let cancelled = false;
    const loadInbox = async () => {
      try {
        const res = await base44.functions.invoke("getManagerInbox", {});
        const data = res.data || res;
        if (!cancelled) setPendingIrs(Number(data.count || (data.items || []).length || 0));
      } catch {
        if (!cancelled) setPendingIrs(0);
      }
    };
    loadInbox();
    const id = setInterval(loadInbox, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isAdmin]);

  const startCalling = async () => {
    setStarting(true); setErr("");
    try {
      const res = await base44.functions.invoke("prepareCallingSession", {});
      const session = res.data || res;
      const q = session.queue || [];
      if (!q.length) {
        setErr("No eligible tasks to call right now.");
        return;
      }
      sessionStorage.setItem("calling_session", JSON.stringify(session));
      const first = q[0];
      navigate(`/dialer?list=${first.target_list_id || ""}&session=true`);
    } catch (e) {
      setErr(e.message || "Could not start calling session.");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (err && !work) {
    return (
      <div className="rounded-3xl bg-white border border-slate-200 p-12 text-center">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
        <p className="text-slate-600">{err}</p>
        <Button onClick={load} variant="outline" className="rounded-full mt-4 border-slate-300">Try again</Button>
      </div>
    );
  }

  const tz = work?.timezone || "Europe/London";
  const name = firstName(work?.user_name || user?.full_name || "");
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const sections = work?.sections || {};
  const needsScheduling = work?.needs_scheduling || [];
  const stats = work?.stats || {};

  const summary = [
    { label: "Due now", value: (sections.due_now || []).length, tone: "text-rose-600" },
    { label: "Overdue", value: (sections.overdue || []).length, tone: "text-rose-600" },
    { label: "New prospects", value: (sections.new_prospects || []).length, tone: "text-emerald-600" },
    { label: "Conversations", value: (sections.previous_conversations || []).length, tone: "text-amber-600" },
  ];

  const hasWork = Object.values(sections).some((s) => s && s.length > 0) || needsScheduling.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">
            {greeting}, {name}.
          </h1>
          <p className="text-slate-500 mt-2">
            Your day at a glance — who you've spoken to, who needs a follow-up, and which calls went better.
            {" "}
            <ContextHelp title="How callbacks work">When a call results in a callback, Cadence creates a Task with a due date. Callbacks appear in your Today list on the due date. Completed callbacks are tracked automatically — no notes or calls are lost.</ContextHelp>
          </p>
        </div>
        <Button onClick={startCalling} disabled={starting || !hasWork} className="rounded-full bg-emerald-600 hover:bg-emerald-700 h-11 px-6">
          {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PhoneCall className="w-4 h-4 mr-2" />}
          {starting ? "Starting…" : "Start calling"}
        </Button>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {summary.map(({ label, value, tone }) => (
          <div key={label} className="rounded-full bg-white border border-slate-200 px-4 py-2 text-sm">
            <span className={tone + " font-semibold"}>{value}</span>
            <span className="text-slate-400 ml-1.5">{label}</span>
          </div>
        ))}
      </div>

      {isAdmin && pendingIrs > 0 && (
        <Link
          to="/manager-inbox"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 hover:border-violet-300 transition-colors"
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
              <Inbox className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">
                {pendingIrs} info request{pendingIrs === 1 ? "" : "s"} waiting in Admin inbox
              </p>
              <p className="text-sm text-slate-600 mt-0.5">
                Draft the client reply from caller notes, then send from your mailbox.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center text-sm font-medium text-violet-700 shrink-0">
            Open inbox <ArrowRight className="w-4 h-4 ml-1" />
          </span>
        </Link>
      )}

      {/* Daily performance cards */}
      <TodayStats stats={stats} onOpportunitiesClick={() => setShowOpps(true)} onResultsClick={(f) => setResultsFilter(f)} />

      <DayFlow dayFlow={work?.day_flow} />

      {err && <p className="text-sm text-rose-600">{err}</p>}

      {/* Empty state */}
      {!hasWork && (
        <div className="rounded-3xl bg-white border border-slate-200 p-12 text-center">
          <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <h2 className="font-display text-xl font-semibold text-slate-900">You're all caught up</h2>
          <p className="text-slate-500 mt-1">No tasks due today. Approve prospects in Prospecting to build your queue.</p>
        </div>
      )}

      {/* Sections */}
      <Section title="Due now" icon={Clock} tone="text-rose-600" rows={sections.due_now} tz={tz} onChanged={load} empty="No callbacks due right now." />
      {work?.is_manager && (sections.overdue || []).length > 0 && (
        <RescheduleOverdue overdueCount={(sections.overdue || []).length} onApplied={load} />
      )}
      <Section title="Overdue" icon={AlertCircle} tone="text-rose-600" rows={sections.overdue} tz={tz} onChanged={load} empty="Nothing overdue." />
      <Section title="Previously called" icon={Sunrise} tone="text-amber-600" rows={sections.previous_conversations} tz={tz} onChanged={load} empty="No contacts to recall yet." count={(sections.previous_conversations || []).reduce((s, r) => s + (r.contact?.call_count || r.task?.attempt_number || 0), 0)} />
      <Section title="New prospects" icon={PhoneCall} tone="text-emerald-600" rows={sections.new_prospects} tz={tz} onChanged={load} empty="No call-ready prospects yet." />
      <Section title="Needs review" icon={AlertCircle} tone="text-sky-600" rows={sections.needs_review} tz={tz} onChanged={load} empty="No research or data reviews pending." />

      {/* Needs scheduling — ambiguous historical records */}
      {needsScheduling.length > 0 && (
        <div className="rounded-3xl bg-white border border-slate-200 p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900">Needs scheduling</h2>
          <p className="text-xs text-slate-400 mt-1">Records with a callback or interested status but no scheduled date. Schedule them manually.</p>
          <div className="mt-3 space-y-2">
            {needsScheduling.slice(0, 20).map((r) => (
              <div key={r.contact.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {r.contact.full_name} <span className="text-slate-400">· {r.company?.name || r.contact.company || ""}</span>
                  </p>
                  <p className="text-xs text-slate-400">Status: {r.call_status} · Last called: {formatLastCalled(r.last_called, tz)}</p>
                </div>
                <button
                  onClick={() => setScheduleRecord(r)}
                  className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors shrink-0 ml-3"
                >
                  Schedule
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {scheduleRecord && (
        <ScheduleDialog
          contact={scheduleRecord.contact}
          company={scheduleRecord.company}
          onClose={() => setScheduleRecord(null)}
          onScheduled={load}
        />
      )}

      <OpportunitiesModal open={showOpps} onClose={() => setShowOpps(false)} user={user} />

      <TodayResultsModal open={!!resultsFilter} onClose={() => setResultsFilter(null)} user={user} filter={resultsFilter} />

      {/* Completed today */}
      {stats.completed_today > 0 && (
        <div className="rounded-3xl bg-white border border-slate-200 p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Completed today
          </h2>
          <p className="text-2xl font-display font-semibold text-slate-900 mt-2">{stats.completed_today}</p>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, tone, rows, tz, onChanged, empty, count }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div>
      <h2 className={`font-display text-lg font-semibold mb-3 flex items-center gap-2 ${tone}`}>
        <Icon className="w-4 h-4" /> {title}
        <span className="text-slate-300 text-sm font-normal">({count !== undefined ? count : rows.length})</span>
      </h2>
      <div className="space-y-2">
        {rows.map((r) => (
          <TaskRow key={r.task.id} row={r} tz={tz} onChanged={onChanged} />
        ))}
      </div>
    </div>
  );
}