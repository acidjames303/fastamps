import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Plug } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import ProviderCard from "@/components/settings/ProviderCard";
import ConnectModal from "@/components/settings/ConnectModal";
import { PROVIDERS } from "@/lib/apiProviders";

// Integration Hub focuses on data-sync providers (enrichment + Google Sheets).
// Telephony providers remain on the main Settings page.
const DATA_GROUPS = ["Enrichment", "Data Sync"];

export default function IntegrationHub() {
  const { user } = useAuth();
  const [connected, setConnected] = useState({});
  const [loading, setLoading] = useState(true);
  const [openProvider, setOpenProvider] = useState(null);

  const canEdit = ["platform_owner", "organisation_admin"].includes(user?.app_role);
  const providers = PROVIDERS.filter((p) => DATA_GROUPS.includes(p.group));
  const groups = [...new Set(providers.map((p) => p.group))];

  const load = async () => {
    if (!user?.id) return;
    try {
      const res = await base44.functions.invoke("getOrgConnectionStatus", {});
      const data = res.data || res;
      if (data.connected) setConnected(data.connected);
    } catch {} finally { setLoading(false); }
  };

  const onSaved = async (connectedStatus) => {
    if (connectedStatus) setConnected(connectedStatus);
    else await load();
  };

  useEffect(() => { load(); }, [user?.id]);

  const active = openProvider ? PROVIDERS.find((p) => p.id === openProvider) : null;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">Integration Hub</h1>
        <p className="text-slate-500 mt-2">Securely connect your enrichment and data-sync providers. Keys are verified before they go live.</p>
      </div>

      {!canEdit ? (
        <div className="rounded-3xl bg-white border border-slate-200 p-6 text-sm text-slate-500">
          Only organisation admins can manage API keys. Ask your workspace admin to connect them.
        </div>
      ) : (
        groups.map((g) => (
          <div key={g} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{g}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.filter((p) => p.group === g).map((p) => (
                <ProviderCard key={p.id} provider={p} connected={p.connectedWhen(connected)} onConnect={() => setOpenProvider(p.id)} />
              ))}
            </div>
          </div>
        ))
      )}

      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 flex items-start gap-3">
        <Plug className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-500">
          Calling and telephony providers (Twilio, Yay.com) are managed on the{" "}
          <a href="/settings" className="text-emerald-700 underline underline-offset-2">Settings</a> page.
        </p>
      </div>

      {active && (
        <ConnectModal provider={active} connected={connected} onClose={() => setOpenProvider(null)} onSaved={onSaved} />
      )}
    </div>
  );
}