import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, XCircle, ChevronRight, Loader2 } from "lucide-react";

// Readiness numbers are counted server-side from the campaign's own records.
// Every number opens the campaign's account table — the same records, filtered,
// exported and enriched there — so the totals are traced in one list, not a copy.
export default function DataReadinessPanel({ campaignId, revision = 0 }) {
  const navigate = useNavigate();
  const [buckets, setBuckets] = useState([]);
  const [labels, setLabels] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
  const accountsHref = `/campaigns/${campaignId}/accounts`;

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
            onClick={() => navigate(accountsHref)}
            title={`Open these ${b.count} companies in the account table`}
            className="text-left p-4 bg-white transition hover:bg-slate-50"
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

      <div className="px-5 py-3 border-t border-slate-100">
        <Link to={accountsHref} className="text-xs font-medium text-emerald-700 hover:text-emerald-800">
          Open the account table — filters, export, enrichment and push →
        </Link>
      </div>
    </div>
  );
}