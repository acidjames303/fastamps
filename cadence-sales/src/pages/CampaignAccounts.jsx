import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, RefreshCw, Building2, Users, StickyNote, Phone } from "lucide-react";
import EmailGatherBar from "@/components/campaigns/accounts/EmailGatherBar";
import CallerNotesPanel from "@/components/campaigns/CallerNotesPanel";
import Prospecting from "@/pages/Prospecting";

// The campaign's accounts, in the one prospect table that owns them: same list,
// same records, same filters, export, enrichment, TPS/CTPS screening and push.
// Notes callers left are read below it; no second copy of the account list exists.
export default function CampaignAccounts() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("getCampaignAccounts", { campaign_id: id });
      setData(res.data || res);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not load the accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading && !data) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }
  if (error && !data) return <p className="text-sm text-rose-600">{error}</p>;

  const accounts = data?.accounts || [];
  const totals = data?.totals || { accounts: 0, people: 0, emails: 0, notes: 0, called: 0 };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/campaign-delivery/${id}`)} className="text-slate-400 hover:text-slate-900 transition" aria-label="Back to campaign">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900">Campaign accounts</h1>
            <p className="text-sm text-slate-500">{data?.campaign?.name || "Campaign"} · one table for this campaign's list</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <Link to="/team"><Users className="w-4 h-4 mr-1.5" /> Callers</Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={load} title="Refresh" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Building2} label="Accounts" value={totals.accounts} />
        <Stat icon={Phone} label="Accounts called" value={totals.called} />
        <Stat icon={Users} label="People" value={totals.people} />
        <Stat icon={StickyNote} label="Notes to read" value={totals.notes} />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <Prospecting embedded campaignId={id} />

      <EmailGatherBar accounts={accounts} campaignName={data?.campaign?.name} />
      <CallerNotesPanel accounts={accounts} />
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <Icon className="w-4 h-4 mb-2 text-slate-400" />
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}