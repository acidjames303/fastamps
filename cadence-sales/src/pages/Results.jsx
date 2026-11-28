import React, { useEffect, useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Phone, Users, Target, MessageSquare, UserCheck, Clock, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getOutcomeLabel, OUTCOME_CATEGORIES, isConversation, isConnectedCall } from "@/lib/outcomeRules";
import { useAuth } from "@/lib/AuthContext";
import ContextHelp from "@/components/help/ContextHelp";
import CallNoteModal from "@/components/results/CallNoteModal";
import ConversionFunnel from "@/components/insights/ConversionFunnel";
import ActivityTrend from "@/components/insights/ActivityTrend";
import { computeStats, buildTrend, busiestDay } from "@/lib/insightsData";
import { countInfoRequests, clientSafeNotes, isInfoRequestLog } from "@/lib/reportMetrics";
import { LEAD_HEADERS, loadLeadContext, buildLeadRows, areaName, toCsv } from "@/lib/resultsCsv";
import LeadSheetFolder from "@/components/leadsheet/LeadSheetFolder";
import { canReviewLeadSheet } from "@/lib/leadSheet";
import { useNavigate } from "react-router-dom";

export default function Results() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isCallerOnly = user?.app_role === "bdm";
  const canClientReport = ["platform_owner", "organisation_admin", "sales_manager", "reporting_user"].includes(user?.app_role);
  const [calls, setCalls] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [filterCampaign, setFilterCampaign] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [members, setMembers] = useState([]);
  const [reporting, setReporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null); // { label, predicate, dedupe? }

  const rangeCutoff = useMemo(() => {
    if (dateRange === "custom") {
      const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
      const end = customEnd ? new Date(`${customEnd}T23:59:59`) : null;
      return { start, end };
    }
    if (dateRange === "all") return { start: null, end: null };
    const now = new Date();
    let start = new Date(0);
    if (dateRange === "today") {
      start = new Date();
      start.setHours(0, 0, 0, 0);
    }
    if (dateRange === "7d") start = new Date(now.getTime() - 7 * 86400000);
    if (dateRange === "30d") start = new Date(now.getTime() - 30 * 86400000);
    if (dateRange === "90d") start = new Date(now.getTime() - 90 * 86400000);
    return { start, end: null };
  }, [dateRange, customStart, customEnd]);

  useEffect(() => {
    (async () => {
      setErr("");
      try {
        const [callRes, campRes, meetingRes, memberRes] = await Promise.all([
          base44.entities.CallLog.list("-created_date", 500),
          base44.entities.Campaign.list("-created_date", 100),
          base44.entities.Meeting.list("-created_date", 200).catch(() => []),
          base44.entities.TargetListMember.list("-created_date", 2000).catch(() => []),
        ]);
        // SDRs only see their own calls — BDM/admin see the org.
        const scopedCalls = isCallerOnly
          ? (callRes || []).filter((c) => c.user_id === user?.id || c.assigned_user_id === user?.id || c.created_by_user_id === user?.id)
          : (callRes || []);
        setCalls(scopedCalls);
        setCampaigns(campRes || []);
        setMeetings(meetingRes || []);
        setMembers(memberRes || []);
      } catch (e) {
        setErr(e.message || "Could not load results.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isCallerOnly, user?.id]);

  const inDateRange = (raw) => {
    if (!raw) return false;
    if (!rangeCutoff.start && !rangeCutoff.end) return true;
    const d = new Date(raw);
    if (rangeCutoff.start && d < rangeCutoff.start) return false;
    if (rangeCutoff.end && d > rangeCutoff.end) return false;
    return true;
  };

  // Every company on each target list, so calls dialled from a list still count
  // for that campaign even when the log itself carries no campaign id.
  const campaignCompanyIds = useMemo(() => {
    const map = new Map();
    (members || []).forEach((m) => {
      if (!m.target_list_id || !m.company_id) return;
      const set = map.get(m.target_list_id) || new Set();
      set.add(m.company_id);
      map.set(m.target_list_id, set);
    });
    return map;
  }, [members]);

  const inCampaign = useCallback((log, campaignId) => {
    if (log.campaign_id) return log.campaign_id === campaignId;
    return campaignCompanyIds.get(campaignId)?.has(log.company_id) || false;
  }, [campaignCompanyIds]);

  const filtered = useMemo(() => {
    if (!calls) return [];
    let result = calls;
    if (filterCampaign) {
      result = result.filter((c) => inCampaign(c, filterCampaign));
    }
    if (dateRange !== "all") {
      result = result.filter((c) => inDateRange(c.started_at || c.created_date));
    }
    return result;
  }, [calls, filterCampaign, dateRange, rangeCutoff, inCampaign]);

  const filteredMeetings = useMemo(() => {
    let result = meetings;
    if (filterCampaign) {
      result = result.filter((m) => m.campaign_id === filterCampaign);
    }
    if (dateRange !== "all") {
      result = result.filter((m) => inDateRange(m.created_date));
    }
    return result;
  }, [meetings, filterCampaign, dateRange, rangeCutoff]);

  const irCounts = useMemo(() => countInfoRequests(filtered), [filtered]);

  const stats = useMemo(() => {
    if (!filtered.length) return {
      total: 0, connected: 0, conversations: 0,
      dmConversations: 0, gatekeeperConversations: 0,
      callbacks: 0, meetings: 0, uniqueContacts: 0,
      conversationRate: 0, dmRate: 0, meetingConversionRate: 0,
      irUnique: 0, irRaw: 0,
    };
    const conversations = filtered.filter(isConversation);
    const connected = filtered.filter(isConnectedCall);
    const dmConversations = conversations.filter((c) => (c.conversation_type || "") === "decision_maker");
    const gatekeeperConversations = conversations.filter((c) => (c.conversation_type || "") === "gatekeeper");
    const callbacks = filtered.filter((c) => c.next_action_type === "callback");
    const contactIds = new Set(filtered.map((c) => c.contact_id).filter(Boolean));
    const meetingCount = filteredMeetings.length;
    return {
      total: filtered.length,
      connected: connected.length,
      conversations: conversations.length,
      dmConversations: dmConversations.length,
      gatekeeperConversations: gatekeeperConversations.length,
      callbacks: callbacks.length,
      meetings: meetingCount,
      uniqueContacts: contactIds.size,
      conversationRate: Math.round((conversations.length / filtered.length) * 100),
      dmRate: Math.round((dmConversations.length / filtered.length) * 100),
      meetingConversionRate: conversations.length ? Math.round((meetingCount / conversations.length) * 100) : 0,
      irUnique: irCounts.unique,
      irRaw: irCounts.raw,
    };
  }, [filtered, filteredMeetings, irCounts]);

  // Insights follow the same campaign and date filters as the numbers above, so
  // the funnel and trend can never disagree with the cards.
  const trendRange = useMemo(() => {
    if (dateRange !== "custom") return dateRange === "today" ? "7d" : dateRange;
    if (!customStart && !customEnd) return "30d";
    const start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(0);
    const end = customEnd ? new Date(`${customEnd}T23:59:59`) : new Date();
    const days = Math.max(1, Math.round((end - start) / 86400000));
    if (days <= 7) return "7d";
    if (days <= 30) return "30d";
    if (days <= 90) return "90d";
    return "all";
  }, [dateRange, customStart, customEnd]);

  const insightStats = useMemo(() => computeStats(filtered, filteredMeetings), [filtered, filteredMeetings]);
  const trend = useMemo(() => buildTrend(filtered, trendRange), [filtered, trendRange]);
  const busiest = useMemo(() => busiestDay(filtered), [filtered]);

  const displayedCalls = useMemo(() => {
    if (!activeFilter) return filtered;
    let result = activeFilter.predicate ? filtered.filter(activeFilter.predicate) : filtered;
    if (activeFilter.dedupe) {
      const seen = new Set();
      result = result.filter((c) => {
        const k = c.contact_id || c.id;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    return result;
  }, [filtered, activeFilter]);

  const outcomeBreakdown = useMemo(() => {
    const counts = {};
    for (const c of filtered) {
      const k = c.primary_outcome || "other";
      counts[k] = (counts[k] || 0) + 1;
    }
    return OUTCOME_CATEGORIES.map((cat) => ({
      ...cat,
      outcomes: cat.outcomes.map((code) => ({ code, count: counts[code] || 0 })),
      total: cat.outcomes.reduce((sum, code) => sum + (counts[code] || 0), 0),
    }));
  }, [filtered]);

  const whoSpoken = (c) => {
    if (!isConversation(c)) return "—";
    const t = c.conversation_type || "";
    if (t === "decision_maker") return "Decision-maker";
    if (t === "gatekeeper") return "Gatekeeper";
    if (t === "wrong_person") return "Wrong person";
    if (t === "other") return "Other person";
    return "Connected";
  };

  const exportCSV = async () => {
    // Client report layout, with the account research notes in Comments.
    setExporting(true);
    try {
      const selectedCampaignName = campaigns.find((c) => c.id === filterCampaign)?.name || "";
      const rowsSource = displayedCalls.map((c) => ({ ...c, campaign_name: areaName(c, campaigns) || selectedCampaignName }));
      const context = await loadLeadContext(rowsSource);
      const csv = toCsv(LEAD_HEADERS, buildLeadRows(rowsSource, context));
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `call-results-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Could not build the report", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const downloadClientReport = async () => {
    setReporting(true);
    try {
      let endDate = new Date();
      let startDate = new Date(0);
      if (dateRange === "custom") {
        if (customStart) startDate = new Date(`${customStart}T00:00:00`);
        if (customEnd) endDate = new Date(`${customEnd}T23:59:59`);
      } else if (dateRange === "today") {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
      } else if (dateRange === "7d") startDate = new Date(endDate.getTime() - 7 * 86400000);
      else if (dateRange === "30d") startDate = new Date(endDate.getTime() - 30 * 86400000);
      else if (dateRange === "90d") startDate = new Date(endDate.getTime() - 90 * 86400000);

      const res = await base44.functions.invoke("getClientReport", {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        campaign_id: filterCampaign || "",
        format: "csv",
      });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `client-report-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Client report downloaded" });
    } catch (e) {
      toast({ title: "Could not generate report", variant: "destructive" });
    } finally {
      setReporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  const campaignName = campaigns.find((c) => c.id === filterCampaign)?.name || "All target lists";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">Results</h1>
          <p className="text-slate-500 mt-2">
            {isCallerOnly
              ? "Your calls, follow-ups, and outcomes — pick any date range."
              : "Team call performance with correct call vs conversation separation."}
            {" "}
            <ContextHelp title="Calls vs conversations">A <strong>call attempted</strong> means a call was logged. A <strong>conversation</strong> means the caller spoke with a person. No-answer, voicemail, busy, invalid numbers and failed calls are never counted as conversations. Gatekeeper calls count as conversations but are reported separately from decision-maker conversations.</ContextHelp>
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCSV} disabled={!filtered.length || exporting} variant="outline" className="rounded-full h-11 px-6">
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} {exporting ? "Building report…" : "Export CSV"}
          </Button>
          {canClientReport && (
            <Button onClick={downloadClientReport} disabled={reporting} className="rounded-full bg-emerald-600 hover:bg-emerald-700 h-11 px-6">
              {reporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />} Client report
            </Button>
          )}
        </div>
      </div>

      {err && <p className="text-sm text-rose-600">{err}</p>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterCampaign}
          onChange={(e) => setFilterCampaign(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          <option value="">All target lists</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="custom">Custom dates</option>
        </select>
        {dateRange === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      {/* Active filter indicator */}
      {activeFilter && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter(null)}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            {activeFilter.label}
            <span className="text-emerald-500">✕</span>
          </button>
        </div>
      )}

      {/* Stat cards — call vs conversation separation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Phone} label="Calls attempted" value={stats.total} tone="text-slate-900" onClick={() => setActiveFilter(null)} />
        <StatCard icon={Phone} label="Calls connected" value={stats.connected} sub={`${stats.total ? Math.round((stats.connected / stats.total) * 100) : 0}% of attempted`} tone="text-sky-600" active={activeFilter?.label === "Calls connected"} onClick={() => setActiveFilter({ label: "Calls connected", predicate: isConnectedCall })} />
        <StatCard icon={MessageSquare} label="Conversations" value={stats.conversations} sub={`${stats.conversationRate}% conversation rate`} tone="text-emerald-600" active={activeFilter?.label === "Conversations"} onClick={() => setActiveFilter({ label: "Conversations", predicate: isConversation })} />
        <StatCard icon={UserCheck} label="Decision-maker" value={stats.dmConversations} sub={`${stats.dmRate}% of attempted`} tone="text-indigo-600" active={activeFilter?.label === "Decision-maker"} onClick={() => setActiveFilter({ label: "Decision-maker", predicate: (c) => (c.conversation_type || "") === "decision_maker" })} />
        <StatCard icon={Users} label="Gatekeeper" value={stats.gatekeeperConversations} tone="text-amber-600" active={activeFilter?.label === "Gatekeeper"} onClick={() => setActiveFilter({ label: "Gatekeeper", predicate: (c) => (c.conversation_type || "") === "gatekeeper" })} />
        <StatCard icon={Clock} label="Callbacks arranged" value={stats.callbacks} tone="text-slate-900" active={activeFilter?.label === "Callbacks arranged"} onClick={() => setActiveFilter({ label: "Callbacks arranged", predicate: (c) => c.next_action_type === "callback" })} />
        <StatCard icon={Target} label="Meetings booked" value={stats.meetings} sub={`${stats.meetingConversionRate}% conversion`} tone="text-violet-600" />
        <StatCard icon={Users} label="Unique contacts" value={stats.uniqueContacts} tone="text-slate-900" active={activeFilter?.label === "Unique contacts"} onClick={() => setActiveFilter({ label: "Unique contacts", dedupe: true })} />
        <StatCard
          icon={FileText}
          label="Info requests (unique)"
          value={stats.irUnique}
          sub={stats.irRaw !== stats.irUnique ? `${stats.irRaw} raw incl. recalls` : undefined}
          tone="text-amber-700"
          active={activeFilter?.label === "Info requests"}
          onClick={() => setActiveFilter({ label: "Info requests", predicate: isInfoRequestLog, dedupe: true })}
        />
      </div>

      {/* Outcome breakdown */}
      <div className="grid lg:grid-cols-3 gap-4">
        {outcomeBreakdown.map((cat) => {
          const isActive = activeFilter?.label === cat.label;
          const catCodes = cat.outcomes.map((o) => o.code);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveFilter(isActive ? null : { label: cat.label, predicate: (c) => catCodes.includes(c.primary_outcome || "other") })}
              className={`text-left rounded-2xl bg-white border p-5 w-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer ${isActive ? "border-emerald-400 ring-1 ring-emerald-400" : "border-slate-200 hover:border-slate-400 hover:shadow-sm"}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">{cat.label}</h3>
                <span className="text-sm text-slate-400">{cat.total}</span>
              </div>
              <div className="space-y-2">
                {cat.outcomes.map(({ code, count }) => (
                  <div key={code} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{getOutcomeLabel(code)}</span>
                    <span className="font-medium text-slate-900">{count}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Insights — conversion funnel and activity trend for the filters above */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ConversionFunnel stats={insightStats} />
        <ActivityTrend trend={trend} range={trendRange} busiest={busiest} />
      </div>

      {/* Recent calls table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Recent calls{activeFilter ? ` · ${activeFilter.label}` : ""}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{campaignName} · {displayedCalls.length} records</p>
        </div>
        {displayedCalls.length === 0 ? (
          <p className="text-slate-400 text-sm p-8 text-center">No calls match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Contact</th>
                  <th className="text-left px-5 py-3 font-medium">Company</th>
                  <th className="text-left px-5 py-3 font-medium">Who</th>
                  <th className="text-left px-5 py-3 font-medium">Outcome</th>
                  <th className="text-left px-5 py-3 font-medium">Next step</th>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedCalls.slice(0, 50).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedCall(c)}
                        className="text-left text-slate-900 font-medium hover:text-emerald-700 hover:underline underline-offset-2"
                      >
                        {c.contact_name || "—"}
                      </button>
                      {clientSafeNotes(c) ? (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 max-w-[220px]">{clientSafeNotes(c)}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{c.company || "—"}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{whoSpoken(c)}</td>
                    <td className="px-5 py-3">
                      <OutcomeBadge code={c.primary_outcome || "other"} />
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">
                      {c.next_action_type
                        ? `${c.next_action_type}${(c.next_action_at || "").toString().slice(0, 10) ? ` · ${(c.next_action_at || "").toString().slice(0, 10)}` : ""}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {c.started_at ? new Date(c.started_at).toLocaleDateString("en-GB") : (c.created_date ? new Date(c.created_date).toLocaleDateString("en-GB") : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lead sheets: same campaign and date filters as the report above, with
          individual or bulk PDF/Word download for manual sending. */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5">
        <LeadSheetFolder
          scope={canReviewLeadSheet(user?.app_role) ? "review" : "mine"}
          campaignId={filterCampaign}
          from={dateRange === "custom" ? customStart : ""}
          to={dateRange === "custom" ? customEnd : ""}
          title="Lead sheets"
          compact
          onOpen={(id) => navigate(`/lead-sheets?id=${id}`)}
        />
      </div>

      <CallNoteModal
        call={selectedCall}
        onClose={() => setSelectedCall(null)}
        onSaved={(updated) => {
          setSelectedCall((cur) => (cur ? { ...cur, ...updated } : cur));
          setCalls((prev) => (prev ? prev.map((c) => (c.id === selectedCall?.id ? { ...c, ...updated } : c)) : prev));
        }}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone, onClick, active }) {
  const clickable = !!onClick;
  const Comp = clickable ? "button" : "div";
  return (
    <Comp
      type={clickable ? "button" : undefined}
      onClick={clickable ? onClick : undefined}
      className={`text-left rounded-2xl bg-white border p-5 w-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${active ? "border-emerald-400 ring-1 ring-emerald-400" : "border-slate-200"} ${clickable ? "cursor-pointer hover:border-slate-400 hover:shadow-sm" : ""}`}
    >
      <Icon className="w-5 h-5 text-slate-400 mb-2" />
      <p className={`text-2xl font-display font-semibold ${tone}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}{sub ? ` · ${sub}` : ""}</p>
    </Comp>
  );
}

function OutcomeBadge({ code }) {
  const cat = OUTCOME_CATEGORIES.find((c) => c.outcomes.includes(code));
  const toneMap = { emerald: "bg-emerald-50 text-emerald-700 border-emerald-200", amber: "bg-amber-50 text-amber-700 border-amber-200", rose: "bg-rose-50 text-rose-700 border-rose-200" };
  const tone = toneMap[cat?.tone] || "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${tone}`}>
      {getOutcomeLabel(code)}
    </span>
  );
}