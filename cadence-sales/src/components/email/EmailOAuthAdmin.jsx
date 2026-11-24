import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";

const redirectHint = typeof window !== "undefined"
  ? `${window.location.origin}/email-connect/callback`
  : "https://your-app/email-connect/callback";

export default function EmailOAuthAdmin() {
  const [status, setStatus] = useState(null);
  const [gmail, setGmail] = useState({ client_id: "", client_secret: "" });
  const [outlook, setOutlook] = useState({ client_id: "", client_secret: "" });
  const [saving, setSaving] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke("manageEmailMailbox", { action: "status" });
        setStatus(res.data || res);
      } catch {}
    })();
  }, []);

  const save = async (provider, form) => {
    setSaving(provider); setMsg(""); setError("");
    try {
      await base44.functions.invoke("manageEmailMailbox", {
        action: "save_oauth_client",
        provider,
        client_id: form.client_id,
        client_secret: form.client_secret,
      });
      setMsg(`${provider === "gmail" ? "Gmail" : "Outlook"} OAuth client saved.`);
      const res = await base44.functions.invoke("manageEmailMailbox", { action: "status" });
      setStatus(res.data || res);
      if (provider === "gmail") setGmail((p) => ({ ...p, client_secret: "" }));
      if (provider === "outlook") setOutlook((p) => ({ ...p, client_secret: "" }));
    } catch (e) {
      setError(e.message || "Could not save.");
    } finally {
      setSaving("");
    }
  };

  if (status && status.can_manage_oauth === false) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
      <div>
        <h2 className="font-semibold text-slate-900">Caller email (Gmail / Outlook)</h2>
        <p className="text-sm text-slate-500 mt-1">
          Add OAuth apps so each caller can sign into their own mailbox and Cadence can create drafts there (never send).
          Register this redirect URI on both providers:
        </p>
        <code className="mt-2 block text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 break-all">{redirectHint}</code>
      </div>

      <ProviderForm
        title="Gmail"
        ready={status?.providers?.gmail?.org_configured}
        form={gmail}
        setForm={setGmail}
        saving={saving === "gmail"}
        onSave={() => save("gmail", gmail)}
        help="Google Cloud Console → APIs & Services → Credentials → OAuth client (Web). Enable Gmail API. Scope: gmail.compose."
      />

      <ProviderForm
        title="Outlook"
        ready={status?.providers?.outlook?.org_configured}
        form={outlook}
        setForm={setOutlook}
        saving={saving === "outlook"}
        onSave={() => save("outlook", outlook)}
        help="Azure Portal → App registrations → Web redirect. API permission: Mail.ReadWrite (delegated) + offline_access."
      />

      {msg && <p className="text-sm text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {msg}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

function ProviderForm({ title, ready, form, setForm, saving, onSave, help }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-900">{title}</h3>
        {ready && <span className="text-xs text-emerald-700">Configured</span>}
      </div>
      <p className="text-xs text-slate-500">{help}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Client ID</Label>
          <Input value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} placeholder="OAuth client ID" />
        </div>
        <div className="space-y-1">
          <Label>Client secret</Label>
          <Input type="password" value={form.client_secret} onChange={(e) => setForm({ ...form, client_secret: e.target.value })} placeholder={ready ? "•••• leave blank to keep" : "OAuth client secret"} />
        </div>
      </div>
      <Button type="button" onClick={onSave} disabled={saving || !form.client_id} className="rounded-full">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Save {title} OAuth
      </Button>
    </div>
  );
}
