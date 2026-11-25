import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Unplug, CheckCircle2 } from "lucide-react";

const redirectUri = () => `${window.location.origin}/email-connect/callback`;

export default function EmailMailboxConnect({ compact = false }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await base44.functions.invoke("manageEmailMailbox", { action: "status" });
      setStatus(res.data || res);
    } catch (e) {
      setError(e.message || "Could not load mailbox status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const connect = async (provider) => {
    setBusy(provider); setError("");
    try {
      const res = await base44.functions.invoke("manageEmailMailbox", {
        action: "start_connect",
        provider,
        redirect_uri: redirectUri(),
      });
      const data = res.data || res;
      if (data.authorize_url) {
        window.location.href = data.authorize_url;
        return;
      }
      setError(data.error || "Could not start connect.");
    } catch (e) {
      setError(e.message || "Could not start connect.");
    } finally {
      setBusy("");
    }
  };

  const disconnect = async (provider) => {
    setBusy(provider); setError("");
    try {
      await base44.functions.invoke("manageEmailMailbox", { action: "disconnect", provider });
      await load();
    } catch (e) {
      setError(e.message || "Could not disconnect.");
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    );
  }

  const providers = [
    { id: "gmail", label: "Gmail", ...status?.providers?.gmail },
    { id: "outlook", label: "Outlook", ...status?.providers?.outlook },
  ];

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {!compact && (
        <div>
          <h3 className="font-semibold text-slate-900">Email mailbox</h3>
          <p className="text-sm text-slate-500 mt-1">
            Connect your Gmail or Outlook account to save drafts and preview your inbox. Your own permission is required, and Cadence cannot send from the Outreach preview.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((p) => (
          <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900">{p.label}</p>
                {p.connected ? (
                  <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1 truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {p.email || "Connected"}
                  </p>
                ) : !p.org_configured ? (
                  <p className="text-xs text-amber-700 mt-1">Ask an admin to enable {p.label} under Integrations.</p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">Not connected</p>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {p.connected ? (
                <>
                  <Button type="button" variant="outline" size="sm"
                    className="rounded-full" disabled={!!busy || !p.org_configured} onClick={() => connect(p.id)}>
                    Reauthorise
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={!!busy}
                    onClick={() => disconnect(p.id)}
                  >
                    {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Unplug className="w-3.5 h-3.5 mr-1" />}
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full bg-slate-900 hover:bg-slate-800"
                  disabled={!!busy || !p.org_configured}
                  onClick={() => connect(p.id)}
                >
                  {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Connect {p.label}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
