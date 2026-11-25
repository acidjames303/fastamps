import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Users } from "lucide-react";

export default function StepAssign({ campaignId, onAssigned }) {
  const [callers, setCallers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [method, setMethod] = useState("even_distribution");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const profiles = await base44.entities.UserProfile.filter({}, "-created_date", 50);
        const active = (profiles || []).filter((p) => p.status === "active" && p.app_role === "bdm");
        setCallers(active);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const toggle = (uid) => setSelected((s) => s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]);

  const assign = async () => {
    if (selected.length === 0) return;
    setAssigning(true); setResult(null);
    try {
      const res = await base44.functions.invoke("assignCampaignCompanies", {
        campaign_id: campaignId,
        method,
        user_ids: selected,
      });
      setResult(res.data || res);
      onAssigned?.();
    } catch (e) {
      setResult({ error: e.message });
    } finally { setAssigning(false); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">Select callers</p>
        {callers.length === 0 ? (
          <p className="text-sm text-slate-400">No active callers found. Invite team members first.</p>
        ) : (
          <div className="space-y-1.5">
            {callers.map((c) => (
              <button key={c.user_id} onClick={() => toggle(c.user_id)} className={`w-full flex items-center justify-between p-3 rounded-lg border transition text-left ${selected.includes(c.user_id) ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-400"}`}>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-900">{c.full_name || "Unknown"}</span>
                </div>
                {selected.includes(c.user_id) && <Check className="w-4 h-4 text-slate-900" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">Assignment method</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "manual", label: "Manual" },
            { id: "even_distribution", label: "Even" },
            { id: "round_robin", label: "Round robin" },
          ].map((m) => (
            <button key={m.id} onClick={() => setMethod(m.id)} className={`px-3 py-2 rounded-lg border text-sm transition ${method === m.id ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={assign} disabled={selected.length === 0 || assigning} className="w-full">
        {assigning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Assign companies to {selected.length} caller{selected.length === 1 ? "" : "s"}
      </Button>

      {result && (
        <div className={`text-sm p-3 rounded-lg ${result.error ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
          {result.error ? result.error : `Created ${result.created} assignment${result.created === 1 ? "" : "s"}.`}
        </div>
      )}
    </div>
  );
}