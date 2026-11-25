import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  Loader2, Plug, ShieldCheck, CreditCard, Share2, Mail, ArrowRight,
} from "lucide-react";
import ProviderCard from "@/components/settings/ProviderCard";
import ConnectModal from "@/components/settings/ConnectModal";
import ProviderPriorityPanel from "@/components/settings/ProviderPriorityPanel";
import EmailMailboxConnect from "@/components/email/EmailMailboxConnect";
import { PROVIDERS } from "@/lib/apiProviders";

const SECTIONS = [
  { id: "connections", label: "Connections", icon: Plug, blurb: "Calling and enrichment API keys" },
  { id: "email", label: "Email drafts", icon: Mail, blurb: "Gmail / Outlook for saving drafts" },
  { id: "more", label: "Plan & compliance", icon: ShieldCheck, blurb: "Billing, compliance, data sync" },
];

export default function Settings() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const section = SECTIONS.some((s) => s.id === params.get("section")) ? params.get("section") : "connections";
  const [connected, setConnected] = useState({});
  const [loading, setLoading] = useState(true);
  const [openProvider, setOpenProvider] = useState(null);

  const canEdit = user?.app_role === "platform_owner" || user?.app_role === "organisation_admin";

  const setSection = (id) => {
    const next = new URLSearchParams(params);
    if (id === "connections") next.delete("section");
    else next.set("section", id);
    setParams(next, { replace: true });
  };

  const load = async () => {
    if (!user?.id) return;
    try {
      const res = await base44.functions.invoke("getOrgConnectionStatus", {});
      const data = res.data || res;
      if (data.connected) setConnected(data.connected);
    } catch { /* ignore */ }
  };

  const onSaved = async (connectedStatus) => {
    if (connectedStatus) setConnected(connectedStatus);
    else await load();
  };

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [user?.id]);

  const groups = [...new Set(PROVIDERS.map((p) => p.group))];
  const active = openProvider ? PROVIDERS.find((p) => p.id === openProvider) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-900">Workspace</h1>
        <p className="text-slate-500 mt-1">
          Connect what you need to call and enrich — everything else lives one click away.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const on = section === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`rounded-full px-4 py-2 text-sm inline-flex items-center gap-2 transition-colors ${
                on ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {s.label}
            </button>
          );
        })}
      </div>

      {section === "connections" && (
        <div className="space-y-8">
          {!canEdit ? (
            <div className="rounded-3xl bg-white border border-slate-200 p-6 text-sm text-slate-500">
              Only organisation admins can manage API keys. Ask your workspace admin to connect them.
            </div>
          ) : (
            groups.map((g) => (
              <div key={g} className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{g}</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PROVIDERS.filter((p) => p.group === g).map((p) => (
                    <ProviderCard key={p.id} provider={p} connected={p.connectedWhen(connected)} onConnect={() => setOpenProvider(p.id)} />
                  ))}
                </div>
              </div>
            ))
          )}
          {canEdit && <ProviderPriorityPanel connectionStatus={{ connected }} />}
        </div>
      )}

      {section === "email" && (
        <div className="rounded-3xl bg-white border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-1">Mailbox for drafts</h2>
          <p className="text-sm text-slate-500 mb-4">
            Connect Gmail or Outlook so you can save follow-up drafts. Cadence never sends emails for you.
          </p>
          <EmailMailboxConnect />
        </div>
      )}

      {section === "more" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <WorkspaceLink to="/usage-billing" icon={CreditCard} title="Usage" desc="Smart actions and seat allowances" />
          <WorkspaceLink to="/compliance" icon={ShieldCheck} title="Compliance" desc="Privacy, DNC, retention" />
          <WorkspaceLink to="/integration-settings" icon={Share2} title="Integrations" desc="CRM and third-party hooks" />
          <WorkspaceLink to="/integrations" icon={Plug} title="Data sync" desc="Inbound / outbound sync jobs" />
        </div>
      )}

      {active && (
        <ConnectModal provider={active} connected={connected} onClose={() => setOpenProvider(null)} onSaved={onSaved} />
      )}
    </div>
  );
}

function WorkspaceLink({ to, icon: Icon, title, desc }) {
  return (
    <Link
      to={to}
      className="rounded-2xl bg-white border border-slate-200 p-5 flex items-start gap-3 hover:border-slate-400 transition-colors"
    >
      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-slate-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 flex items-center gap-1">
          {title} <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}