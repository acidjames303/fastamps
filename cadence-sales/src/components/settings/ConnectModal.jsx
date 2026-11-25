import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, X, Unplug, ShieldCheck, ShieldAlert, ExternalLink, ChevronDown } from "lucide-react";

export default function ConnectModal({ provider, connected, onClose, onSaved }) {
  const [values, setValues] = useState({});
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isConnected = provider.connectedWhen(connected);
  const set = (k, v) => setValues((p) => ({ ...p, [k]: v }));
  const requiredFields = provider.fields.filter((f) => f.required !== false && !f.advanced);
  const requiredFilled = requiredFields.every((f) => (values[f.key] || "").trim() || connected[f.key]);
  const visibleFields = provider.fields.filter((f) => !f.advanced || showAdvanced);

  const connect = async () => {
    setVerifying(true);
    setError("");
    setSaved(false);
    try {
      const vr = await base44.functions.invoke("testApiConnection", { provider: provider.id, keys: values });
      const vd = vr.data || vr;
      if (!vd.ok) {
        setError(vd.detail || "Verification failed. Check the key and try again.");
        return;
      }
      const sr = await base44.functions.invoke("saveOrgApiKeys", { keys: values });
      const sd = sr.data || sr;
      await onSaved(sd.connected);
      setSaved(true);
      setValues({});
      setTimeout(onClose, 1000);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Could not connect.");
    } finally {
      setVerifying(false);
    }
  };

  const disconnect = async () => {
    setVerifying(true);
    setError("");
    try {
      const cleared = Object.fromEntries(provider.fields.map((f) => [f.key, ""]));
      const sr = await base44.functions.invoke("saveOrgApiKeys", { keys: cleared });
      const sd = sr.data || sr;
      await onSaved(sd.connected);
      onClose();
    } catch (e) {
      setError(e?.message || "Could not disconnect.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" onClick={onClose}>
      <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <provider.Icon className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{isConnected ? "Manage" : "Connect"} {provider.name}</h3>
              <p className="text-xs text-slate-400">{provider.blurb}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        {!isConnected && (
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Connect in three steps</p>
            <ol className="list-decimal ml-4 mt-2 space-y-1 text-xs">
              <li>Open your {provider.name} account and copy the requested credentials.</li>
              <li>Paste them below. Cadence verifies them before saving.</li>
              <li>Return to Get Started and make a test call or enrichment.</li>
            </ol>
            {provider.accountUrl && <a href={provider.accountUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-slate-800 hover:underline">Open {provider.name} settings <ExternalLink className="w-3 h-3" /></a>}
          </div>
        )}

        <div className="space-y-4">
          {visibleFields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-sm text-slate-700">{f.label}{f.required === false ? ' (optional)' : ''}</Label>
              <Input
                type="password"
                placeholder={connected[f.key] ? "••••••••  enter a new value to replace" : "Paste your key"}
                value={values[f.key] || ""}
                onChange={(e) => set(f.key, e.target.value)}
                disabled={verifying}
                className="h-11"
              />
              {f.help && <p className="text-xs text-slate-400">{f.help}</p>}
            </div>
          ))}
        </div>

        {provider.fields.some((f) => f.advanced) && (
          <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            {showAdvanced ? 'Hide browser-calling setup' : 'Optional: configure browser calling'}
          </button>
        )}

        {error && (
          <p className="text-sm text-rose-600 flex items-center gap-1.5"><ShieldAlert className="w-4 h-4 shrink-0" /> {error}</p>
        )}
        {saved && (
          <p className="text-sm text-emerald-600 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Verified and connected.</p>
        )}

        <div className="flex items-center justify-between pt-1">
          {isConnected ? (
            <Button onClick={disconnect} disabled={verifying} variant="ghost" className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full">
              {verifying ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Unplug className="w-4 h-4 mr-1.5" />} Disconnect
            </Button>
          ) : <span />}
          <Button onClick={connect} disabled={verifying || !requiredFilled} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
            {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {verifying ? "Verifying…" : "Connect & verify"}
          </Button>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          We verify the key against {provider.name} before saving it — so you know it works the moment it's connected.
        </p>
      </div>
    </div>
  );
}