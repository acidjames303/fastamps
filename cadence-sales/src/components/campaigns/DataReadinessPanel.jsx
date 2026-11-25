import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, XCircle, ChevronRight, Loader2 } from "lucide-react";
import CampaignAccounts from '@/components/campaigns/CampaignAccounts';

// Readiness numbers are counted server-side from the campaign's own records.
// Clicking a number reveals the exact companies behind it, so a total can always
// be traced to records rather than trusted.
export default function DataReadinessPanel({ campaignId, revision = 0 }) {
  const [buckets, setBuckets] = useState([]);
  const [labels, setLabels] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const res = await base44.functions.invoke("campaignDataReview", { action: "readiness", campaign_id: campaignId });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      setBuckets(data.buckets || []);
      setLabels(data.id_labels || {});
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { if (campaignId) load(); }, [campaignId, revision]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }
  if (error) return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-rose-600">{error}</div>;
  if (!buckets.length) return null;

  const find = (key) => buckets.find((b) => b.key === key) || { count: 0, ids: [] };
  const ready = find("ready_to_call");
  const notReady = find("not_ready_to_call");
  const total = find("target_companies").count;
  const confirmed = find("named_contacts_confirmed").count;
  const active = open ? find(open) : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-900">Data readiness</h2>
        <p className="text-xs text-slate-500 mt-1">
          {total} target companies · {ready.count} ready to call · {notReady.count} not ready to call
          {confirmed === 0 && total > 0 ? " · no contact is confirmed yet, so nothing is callable" : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-100">
        {buckets.map((b) => (
          <button
            key={b.key}
            onClick={() => setOpen(open === b.key ? null : b.key)}
            className={`text-left p-4 transition ${open === b.key ? "bg-slate-50" : "bg-white hover:bg-slate-50"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xl font-semibold text-slate-900">{b.count}</span>
              {b.key === "ready_to_call" && b.count > 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                : b.key === "not_ready_to_call" && b.count > 0 ? <XCircle className="w-4 h-4 text-slate-300" />
                  : <ChevronRight className="w-4 h-4 text-slate-300" />}
            </div>
            <div className="text-xs text-slate-500 mt-1 leading-snug">{b.label}</div>
          </button>
        ))}
      </div>

      <CampaignAccounts campaignId={campaignId} bucket={open || 'target_companies'} revision={revision} onChanged={load} />
    </div>
  );
}