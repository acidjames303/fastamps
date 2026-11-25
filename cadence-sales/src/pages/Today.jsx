import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Loader2, PhoneCall, Sunrise, AlertCircle, CheckCircle2, Clock, Inbox,
  ArrowRight, Users, Search,
} from "lucide-react";
import TodayStats from "@/components/today/TodayStats";
import DayFlow from "@/components/today/DayFlow";
import OpportunitiesModal from "@/components/today/OpportunitiesModal";
import TodayResultsModal from "@/components/today/TodayResultsModal";
import TaskRow from "@/components/today/TaskRow";
import RescheduleOverdue from "@/components/today/RescheduleOverdue";
import ScheduleDialog from "@/components/today/ScheduleDialog";
import { firstName, formatLastCalled } from "@/lib/today";
import { useAuth } from "@/lib/AuthContext";
import { getActiveCampaign } from "@/lib/campaignContext";

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
  const [teamSnapshot, setTeamSnapshot] = useState(null);

  const role = user?.app_role || "";
  const isAdmin = ["platform_owner", "organisation_admin"].includes(role);
  const isManager = ["platform_owner", "organisation_admin", "sales_manager"].includes(role);
  const isCaller = ["bdm", "internal_bd"].includes(role) || (!isManager && role !== "reporting_user");
  const sticky = getActiveCampaign();

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

  useEffect(() => {
    if (!isManager) { setTeamSnapshot(null); return undefined; }
    let cancelled = false;
    const loadTeam = async () => {
      try {
        const res = await base44.functions.invoke("getTeamWorkload", {});
        if (!cancelled) setTeamSnapshot(res.data || res);
      } catch {
        if (!cancelled) setTeamSnapshot(null);
      }
    };
    loadTeam();
    const id = setInterval(loadTeam, 45000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isManager]);

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
      const list = first.target_list_id || sticky?.id || "";
      navigate(`/dialer?list=${list}&session=true`);
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

  const dueNow = (sections.due_now || []).length;
  const overdue = (sections.overdue || []).length;
  const newProspects = (sections.new_prospects || []).length;
  const remaining = Number(stats.remaining_tasks || 0) || dueNow + overdue + newProspects;
  const hasWork = Object.values(sections).some((s) => s && s.length > 0) || needsScheduling.length > 0;

  const callersOnline = Array.isArray(teamSnapshot?.callers)
    ? teamSnapshot.callers.filter((c) => c?.live_status && c.live_status !== "offline").length
    : Number(teamSnapshot?.active_callers || teamSnapshot?.callers_active || 0);

  const primaryLabel = starting
    ? "Starting…"
    : hasWork || remaining > 0
      ? "Continue calling"
      : "Open dialer";

  return (
    <div className="space-y-6">
      {/* Header — one primary action */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">
            {greeting}, {name}.
          </h1>
          <p className="text-slate-500 mt-2 text-base">
            {isManager && !isCaller
              ? "Who needs you — approvals, callers, and follow-ups."
              : sticky?.name
                ? `Ready on ${sticky.name}.`
                : "Your next calls, in one place."}
          </p>
        </div>
        {(isCaller || !isManager || hasWork) && (
          <Button
            onClick={startCalling}
            disabled={starting}
            className="rounded-full bg-emerald-600 hover:bg-emerald-700 h-12 px-7 text-base"
          >
            {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PhoneCall className="w-4 h-4 mr-2" />}
            {primaryLabel}
          </Button>
        )}
      </div>

      {/* Compact status — fewer competing numbers */}
      <div className="flex flex-wrap gap-2">
        <StatusChip label="Due now" value={dueNow} tone="text-rose-600" />
        <StatusChip label="Overdue" value={overdue} tone="text-rose-600" />
        <StatusChip label="New" value={newProspects} tone="text-emerald-600" />
        {remaining > 0 && <StatusChip label="Left today" value={remaining} tone="text-slate-700" />}
      </div>

      {/* Manager focus strip */}
      {isManager && (pendingIrs > 0 || callersOnline > 0 || overdue > 0) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pendingIrs > 0 && (
            <Link
              to="/manager-inbox"
              className="flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 hover:border-violet-300 transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                  <Inbox className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {pendingIrs} approval{pendingIrs === 1 ? "" : "s"}
                  </p>
                  <p className="text-sm text-slate-600 mt-0.5">Review and send</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-violet-700 shrink-0" />
            </Link>
          )}
          <Link
            to="/team"
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 hover:border-slate-300 transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  {callersOnline > 0 ? `${callersOnline} caller${callersOnline === 1 ? "" : "s"} active` : "Team workload"}
                </p>
                <p className="text-sm text-slate-600 mt-0.5">See who needs help</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          </Link>
          {overdue > 0 && (
            <button
              type="button"
              onClick={startCalling}
              className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 hover:border-amber-300 transition-colors text-left"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{overdue} overdue</p>
                  <p className="text-sm text-slate-600 mt-0.5">Clear the backlog</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-700 shrink-0" />
            </button>
          )}
        </div>
      )}

      {/* Admin inbox alone (when manager strip not shown for other reasons) */}
      {isAdmin && pendingIrs > 0 && !isManager && (
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
                {pendingIrs} info request{pendingIrs === 1 ? "" : "s"} waiting
              </p>
              <p className="text-sm text-slate-600 mt-0.5">Draft the reply, then send.</p>
            </div>
          </div>
          <span className="inline-flex items-center text-sm font-medium text-violet-700 shrink-0">
            Open inbox <ArrowRight className="w-4 h-4 ml-1" />
          </span>
        </Link>
      )}

      {/* Stats stay, but after the primary path */}
      <TodayStats stats={stats} onOpportunitiesClick={() => setShowOpps(true)} onResultsClick={(f) => setResultsFilter(f)} />

      <DayFlow dayFlow={work?.day_flow} />

      {err && <p className="text-sm text-rose-600">{err}</p>}

      {!hasWork && (
        <div className="rounded-3xl bg-white border border-slate-200 p-10 text-center">
          <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <h2 className="font-display text-xl font-semibold text-slate-900">You're caught up</h2>
          <p className="text-slate-500 mt-1">No tasks due. Build the queue or open a campaign.</p>
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            <Button asChild className="rounded-full bg-emerald-600 hover:bg-emerald-700">
              <Link to="/campaigns?tab=prospect">
                <Search className="w-4 h-4 mr-2" /> Find prospects
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/campaigns">Open campaigns</Link>
            </Button>
          </div>
        </div>
      )}

      <Section title="Due now" icon={Clock} tone="text-rose-600" rows={sections.due_now} tz={tz} onChanged={load} />
      {work?.is_manager && overdue > 0 && (
        <RescheduleOverdue overdueCount={overdue} onApplied={load} />
      )}
      <Section title="Overdue" icon={AlertCircle} tone="text-rose-600" rows={sections.overdue} tz={tz} onChanged={load} />
      <Section
        title="Previously called"
        icon={Sunrise}
        tone="text-amber-600"
        rows={sections.previous_conversations}
        tz={tz}
        onChanged={load}
        count={(sections.previous_conversations || []).reduce((s, r) => s + (r.contact?.call_count || r.task?.attempt_number || 0), 0)}
      />
      <Section title="New prospects" icon={PhoneCall} tone="text-emerald-600" rows={sections.new_prospects} tz={tz} onChanged={load} />
      <Section title="Needs review" icon={AlertCircle} tone="text-sky-600" rows={sections.needs_review} tz={tz} onChanged={load} />

      {needsScheduling.length > 0 && (
        <div className="rounded-3xl bg-white border border-slate-200 p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900">Needs scheduling</h2>
          <p className="text-sm text-slate-500 mt-1">Pick a time for these follow-ups.</p>
          <div className="mt-3 space-y-2">
            {needsScheduling.slice(0, 20).map((r) => (
              <div key={r.contact.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {r.contact.full_name}{" "}
                    <span className="text-slate-400">· {r.company?.name || r.contact.company || ""}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Status: {r.call_status} · Last called: {formatLastCalled(r.last_called, tz)}
                  </p>
                </div>
                <button
                  type="button"
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

function StatusChip({ label, value, tone }) {
  return (
    <div className="rounded-full bg-white border border-slate-200 px-4 py-2 text-sm">
      <span className={`${tone} font-semibold`}>{value}</span>
      <span className="text-slate-400 ml-1.5">{label}</span>
    </div>
  );
}

function Section({ title, icon: Icon, tone, rows, tz, onChanged, count }) {
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
