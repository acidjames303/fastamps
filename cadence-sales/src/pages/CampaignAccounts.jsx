import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, RefreshCw, Building2, Users, StickyNote, Phone } from "lucide-react";
import AccountRow from "@/components/campaigns/accounts/AccountRow";
import EmailGatherBar from "@/components/campaigns/accounts/EmailGatherBar";

// Accounts & notes: read every account in a campaign and the notes callers left,
// without dialling anything.
export default function CampaignAccounts() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

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

  const accounts = useMemo(() => {
    let rows = data?.accounts || [];
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((a) => {
        const hay = [
          a.name,
          a.domain,
          ...(a.contacts || []).map((c) => `${c.name} ${c.email || ""}`),
          ...(a.notes || []).map((n) => n.text),
        ].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    if (filter === "fresh") return rows.filter((a) => !a.calls && (a.notes || []).length === 0);
    if (filter === "called") return rows.filter((a) => a.calls > 0);
    if (filter === "notes") return rows.filter((a) => (a.notes || []).length > 0);
    if (filter === "emails") return rows.filter((a) => (a.contacts || []).some((c) => c.email));
    return rows;
  }, [data, search, filter]);

  if (loading && !data) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }
  if (error && !data) return <p className="text-sm text-rose-600">{error}</p>;

  const totals = data?.totals || { accounts: 0, people: 0, emails: 0, notes: 0, called: 0 };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/campaign-delivery/${id}`)} className="text-slate-400 hover:text-slate-900 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900">Accounts &amp; notes</h1>
            <p className="text-sm text-slate-500">{data?.campaign?.name || "Campaign"} · read the accounts and what callers recorded</p>
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

      <EmailGatherBar accounts={accounts} campaignName={data?.campaign?.name} />

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search account, person or note…"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 w-full sm:w-80"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          <option value="all">All accounts</option>
          <option value="fresh">Not called yet (fresh)</option>
          <option value="called">Called</option>
          <option value="notes">With notes</option>
          <option value="emails">With emails</option>
        </select>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {accounts.length === 0 ? (
          <p className="px-5 py-10 text-sm text-slate-400 text-center">
            No accounts match this view yet. Accounts appear here once a campaign has companies on its list.
          </p>
        ) : (
          accounts.map((account) => <AccountRow key={account.id} account={account} campaignId={id} />)
        )}
      </div>
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