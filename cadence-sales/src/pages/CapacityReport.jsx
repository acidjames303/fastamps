import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Gauge, RefreshCw, Database, Users, PhoneCall, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

const PROFILES = [
  {
    key: "micro",
    label: "Micro Team",
    description: "1 organisation · 2 users · 1 campaign",
    targets: { companies: 1000, contacts: 2000, callLogs: 5000, tasks: 500 },
    icon: Users,
  },
  {
    key: "small",
    label: "Small Team",
    description: "1 organisation · 10 users · 5 campaigns",
    targets: { companies: 10000, contacts: 20000, callLogs: 100000, tasks: 10000 },
    icon: Database,
  },
  {
    key: "multi",
    label: "Multi-Team Pilot",
    description: "10 organisations · 100 users · 50 campaigns",
    targets: { companies: 50000, contacts: 100000, callLogs: 500000, tasks: 50000 },
    icon: PhoneCall,
  },
];

const PERFORMANCE_BUDGETS = [
  { page: "Today", target: "3s", notes: "Today page usable within 3 seconds" },
  { page: "Dialer transition", target: "2s", notes: "Company transition within 2 seconds" },
  { page: "Outcome save", target: "2s", notes: "Call outcome save within 2 seconds (excl. provider)" },
  { page: "Callback visible", target: "3s", notes: "Callback visible after save within 3 seconds" },
  { page: "Contacts first page", target: "3s", notes: "Contacts first page within 3 seconds" },
  { page: "Campaign dashboard", target: "5s", notes: "Campaign dashboard within 5 seconds" },
  { page: "Results", target: "5s", notes: "Results page within 5 seconds" },
  { page: "Report generation", target: "15s", notes: "Report generation within 15 seconds" },
  { page: "Navigation feedback", target: "300ms", notes: "Ordinary navigation feedback within 300ms" },
];

export default function CapacityReport() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [testRun, setTestRun] = useState(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("getPilotReadiness", {});
      setMetrics(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runVolumeTest = async () => {
    setRunning(true);
    setTestRun(null);
    try {
      const res = await base44.functions.invoke("seedTestData", { profile: "micro", test_run_id: `vol-${Date.now()}` });
      setTestRun({ status: "pass", result: res.data });
    } catch (e) {
      setTestRun({ status: "fail", error: e.response?.data?.error || e.message });
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-400">Loading capacity data…</div>;

  const contactCount = metrics?.checks?.data_volume_test?.notes?.match(/(\d+)/)?.[1] || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <Gauge className="w-7 h-7 text-slate-700" /> Capacity Report
          </h1>
          <p className="text-slate-500 mt-1">Data-volume profiles, performance budgets, and concurrent-user testing.</p>
        </div>
        <Button onClick={load} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PROFILES.map(p => {
          const Icon = p.icon;
          return (
            <div key={p.key} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-5 h-5 text-slate-400" />
                <h3 className="font-display font-semibold text-slate-900">{p.label}</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">{p.description}</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Companies</span><span className="text-slate-700 font-medium">{p.targets.companies.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Contacts</span><span className="text-slate-700 font-medium">{p.targets.contacts.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Call Logs</span><span className="text-slate-700 font-medium">{p.targets.callLogs.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Tasks</span><span className="text-slate-700 font-medium">{p.targets.tasks.toLocaleString()}</span></div>
              </div>
              {p.key === "multi" && (
                <p className="text-xs text-amber-600 mt-3">⚠ Not created in production — use isolated test method.</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-display font-semibold text-slate-900 mb-1">Current Data Volume</h3>
        <p className="text-sm text-slate-500 mb-4">Live record counts in your organisation.</p>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-3xl font-display font-semibold text-slate-900">{contactCount}</p>
            <p className="text-xs text-slate-400">contacts</p>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={runVolumeTest} disabled={running} size="sm">
            {running ? "Seeding test data…" : "Seed micro test data"}
          </Button>
          {testRun && (
            <div className={`mt-3 text-sm ${testRun.status === "pass" ? "text-emerald-600" : "text-rose-600"}`}>
              {testRun.status === "pass"
                ? `Created ${testRun.result.created?.contacts || 0} contacts, ${testRun.result.created?.companies || 0} companies. Test run ID: ${testRun.result.test_run_id}`
                : `Failed: ${testRun.error}`}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-display font-semibold text-slate-900">Performance Budgets</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {PERFORMANCE_BUDGETS.map(b => (
            <div key={b.page} className="px-5 py-3 flex items-center gap-4">
              <ClipboardList className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-700 flex-1">{b.page}</span>
              <span className="text-sm font-mono font-medium text-slate-900">{b.target}</span>
              <span className="text-xs text-slate-400 hidden sm:block">{b.notes}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-display font-semibold text-slate-900 mb-1">Concurrent-User Testing</h3>
        <p className="text-sm text-slate-500 mb-4">Test staged concurrency levels. No real paid calls during load testing.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[5, 10, 25, 50].map(n => (
            <div key={n} className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-2xl font-display font-semibold text-slate-900">{n}</p>
              <p className="text-xs text-slate-400">simultaneous users</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">Record: response time, success rate, error rate, duplicate-record rate, locking conflicts, credit usage.</p>
      </div>
    </div>
  );
}