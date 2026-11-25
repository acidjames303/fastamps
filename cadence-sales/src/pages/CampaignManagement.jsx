import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Pause, Phone, Target as TargetIcon, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

const STATUS_TONE = {
  draft: "bg-slate-100 text-slate-600",
  ready: "bg-sky-50 text-sky-700",
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  completed: "bg-slate-100 text-slate-500",
  archived: "bg-slate-100 text-slate-400",
};

export default function CampaignManagement() {
  const [campaigns, setCampaigns] = useState(null);
  const [calls, setCalls] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [camps, callRes] = await Promise.all([
        base44.entities.Campaign.list("-created_date", 100),
        base44.entities.CallLog.list("-created_date", 500),
      ]);
      setCampaigns(camps || []);
      setCalls(callRes || []);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  const toggleStatus = async (c) => {
    setBusy(c.id);
    setError("");
    try {
      const next = c.status === "active" ? "paused" : "active";
      await base44.entities.Campaign.update(c.id, { status: next });
      setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    } catch (e) { setError(e.message); } finally { setBusy(null); }
  };

  const callsFor = (cid) => calls.filter((cl) => cl.campaign_id === cid);
  const todaysCalls = (cid) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return callsFor(cid).filter((cl) => {
      const d = cl.started_at || cl.created_date;
      return d && new Date(d) >= today;
    }).length;
  };

  if (!campaigns) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">Campaign Management</h1>
        <p className="text-slate-500 mt-2">Activate, pause and track progress against your outreach campaign goals.</p>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {campaigns.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No campaigns yet. Create one from the Campaigns page.</p>
          <Link to="/campaigns"><Button className="rounded-full mt-4 bg-emerald-600 hover:bg-emerald-700">Go to campaigns</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const totalCalls = callsFor(c.id).length;
            const today = todaysCalls(c.id);
            const totalTarget = c.total_call_target || 0;
            const dailyTarget = c.daily_call_target || 0;
            const totalPct = totalTarget ? Math.min(100, Math.round((totalCalls / totalTarget) * 100)) : 0;
            const dailyPct = dailyTarget ? Math.min(100, Math.round((today / dailyTarget) * 100)) : 0;
            const isActive = c.status === "active";
            return (
              <div key={c.id} className="rounded-2xl bg-white border border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{c.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_TONE[c.status] || STATUS_TONE.draft}`}>{c.status}</span>
                    </div>
                    {c.client_name && <p className="text-xs text-slate-400 mt-0.5">Client: {c.client_name}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleStatus(c)}
                      disabled={busy === c.id || ["draft", "completed", "archived"].includes(c.status)}
                      className="rounded-full h-9"
                    >
                      {busy === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : isActive ? <Pause className="w-4 h-4 mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
                      {isActive ? "Pause" : "Activate"}
                    </Button>
                    <Link to={`/dialer?list=${c.id}`}>
                      <Button size="sm" className="rounded-full h-9 bg-emerald-600 hover:bg-emerald-700">
                        <Phone className="w-4 h-4 mr-1.5" /> Dial
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <ProgressBlock
                    label="Today's calls"
                    icon={Phone}
                    value={today}
                    target={dailyTarget}
                    pct={dailyPct}
                    tone={isActive ? "bg-emerald-500" : "bg-slate-300"}
                  />
                  <ProgressBlock
                    label="Campaign progress"
                    icon={TargetIcon}
                    value={totalCalls}
                    target={totalTarget}
                    pct={totalPct}
                    tone="bg-sky-500"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProgressBlock({ label, icon: Icon, value, target, pct, tone }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="flex items-center gap-1.5 text-slate-600"><Icon className="w-3.5 h-3.5" /> {label}</span>
        <span className="font-medium text-slate-700">{value}{target ? ` / ${target}` : ""}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {target > 0 && value >= target && (
        <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1.5"><CheckCircle2 className="w-3 h-3" /> Target reached</p>
      )}
    </div>
  );
}