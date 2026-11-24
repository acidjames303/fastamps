import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import StatCard from "@/components/StatCard";
import TodayNotes from "@/components/dashboard/TodayNotes";
import RecentCallRow from "@/components/dashboard/RecentCallRow";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PhoneCall } from "lucide-react";
import { OUTCOMES } from "@/lib/outcomeRules";

// A call "connected" when its primary_outcome is in the 'connected' category —
// the rep spoke to a human. Falls back to legacy outcome for old records.
function isConnected(log) {
  if (log.conversation_held !== undefined && log.conversation_held !== null) {
    return log.conversation_held === true;
  }
  const code = log.primary_outcome;
  if (code) return OUTCOMES[code]?.category === "connected";
  const legacy = log.outcome;
  return ["connected", "interested", "not_interested", "callback", "lead", "send_info", "wrong_person", "pa_screened"].includes(legacy);
}

export default function Dashboard() {
  const [contacts, setContacts] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [logs, setLogs] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [prospectLists, setProspectLists] = useState([]);
  const [companyView, setCompanyView] = useState("industry");

  useEffect(() => {
    base44.entities.Contact.filter({ id: { $ne: '6afae4e89382d5a14f4bcae0' } }, "-updated_date", 500).then(setContacts);
    base44.entities.Company.filter({ id: { $ne: '6afae4e7d0f2f6f3809b0e91' } }, "-created_date", 500).then(setCompanies);
    base44.entities.CallLog.list("-created_date", 200).then(setLogs);
    base44.entities.Prospect.list("-created_date", 500).then(setProspects).catch(() => {});
    base44.entities.ProspectList.list("-created_date", 200).then(setProspectLists).catch(() => {});
  }, []);

  if (!contacts) return <p className="text-slate-400">Loading your pipeline…</p>;

  const bad = contacts.filter((c) => c.number_status === "bad").length;
  const connected = logs.filter(isConnected).length;
  const rate = logs.length ? Math.round((connected / logs.length) * 100) : 0;

  const tally = (items, field) => {
    const counts = {};
    items.forEach((c) => { const v = c[field]; if (v) counts[v] = (counts[v] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  };
  // Industry mix across ALL prospect lists (not just pushed Company records).
  const topIndustries = tally(prospects, "industry");
  const prospectsWithIndustry = prospects.filter((p) => p.industry && String(p.industry).trim()).length;
  // List-level stat: tally prospects by their ProspectList, resolving names.
  const listMap = new Map(prospectLists.map((l) => [l.id, l.name?.trim() || "Untitled list"]));
  const listCounts = {};
  prospects.forEach((p) => {
    if (!p.list_id) return;
    const name = listMap.get(p.list_id) || "Unknown list";
    listCounts[name] = (listCounts[name] || 0) + 1;
  });
  const topLists = Object.entries(listCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const prospectsInLists = Object.values(listCounts).reduce((a, b) => a + b, 0);
  // Person-level stat: buyer profiles from Contact records.
  const topProfiles = tally(contacts, "profile_type");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">Overview</h1>
          <p className="text-slate-500 mt-2">Your dialing health, at a glance.</p>
        </div>
        <Link to="/dialer">
          <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 h-11 px-6">
            <PhoneCall className="w-4 h-4 mr-2" /> Start dialing
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contacts" value={contacts.length} hint="people in your working data" />
        <StatCard label="Companies" value={companies.length} hint="unique employers" />
        <StatCard label="Connect rate" value={`${rate}%`} hint={`${connected} of ${logs.length} calls spoke`} accent="text-emerald-600" />
        <StatCard label="Bad numbers" value={bad} hint="flagged and skipped" accent="text-rose-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-white border border-slate-200 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {companyView === "industry" ? "Company types" : "Prospect lists"}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {companyView === "industry"
                  ? "Who you're calling, by company industry."
                  : "Prospects across all your lists."}
              </p>
            </div>
            <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-xs font-medium">
              <button
                onClick={() => setCompanyView("industry")}
                className={`px-3 py-1 rounded-full transition-colors ${companyView === "industry" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Industry
              </button>
              <button
                onClick={() => setCompanyView("lists")}
                className={`px-3 py-1 rounded-full transition-colors ${companyView === "lists" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Lists
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {companyView === "industry" ? (
              topIndustries.length === 0 ? (
                <p className="text-sm text-slate-400">No company industry tagged yet.</p>
              ) : topIndustries.map(([label, count]) => {
                const pct = prospectsWithIndustry ? Math.round((count / prospectsWithIndustry) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{label}</span>
                      <span className="text-slate-400">{count} · {pct}%</span>
                    </div>
                    <div className="h-1.5 mt-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-slate-900 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : topLists.length === 0 ? (
              <p className="text-sm text-slate-400">No prospects in lists yet.</p>
            ) : topLists.map(([label, count]) => {
              const pct = prospectsInLists ? Math.round((count / prospectsInLists) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 truncate mr-2">{label}</span>
                    <span className="text-slate-400 shrink-0">{count} · {pct}%</span>
                  </div>
                  <div className="h-1.5 mt-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-slate-900 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900">Buyer profiles</h2>
          <p className="text-xs text-slate-400 mt-1">Who picks up, by decision-making role.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {topProfiles.length === 0 ? (
              <p className="col-span-2 text-sm text-slate-400">No profiles assigned yet.</p>
            ) : topProfiles.map(([label, count]) => (
              <div key={label} className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="font-medium text-slate-900 text-sm">{label}</p>
                <p className="text-2xl font-display font-semibold text-slate-900 mt-1">{count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-display text-lg font-semibold text-slate-900">Recent calls</h2>
        </div>
        {logs.length === 0 ? (
          <p className="px-6 py-10 text-slate-400 text-sm">No calls logged yet.</p>
        ) : (
          logs.slice(0, 8).map((l) => (
            <RecentCallRow
              key={l.id}
              log={l}
              onDeleted={(id, contactId) => {
                setLogs((prev) => prev.filter((x) => x.id !== id));
                if (contactId) setContacts((prev) => (prev ? prev.filter((c) => c.id !== contactId) : prev));
              }}
            />
          ))
        )}
      </div>

      <TodayNotes logs={logs} contacts={contacts} />
    </div>
  );
}