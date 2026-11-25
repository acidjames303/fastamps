import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, GripVertical, ArrowUp, ArrowDown, Check, RotateCcw, Users, Target } from "lucide-react";
import { PROVIDER_LABELS, DEFAULT_PROVIDER_ORDER } from "@/lib/providerConfig";

// Provider priority settings panel — lets org admins configure the order in
// which connected enrichment providers are tried, plus target roles and
// preferred seniority for decision-maker ranking.
export default function ProviderPriorityPanel({ connectionStatus }) {
  const [providers, setProviders] = useState([]);
  const [connected, setConnected] = useState({});
  const [targetRoles, setTargetRoles] = useState("");
  const [preferredSeniority, setPreferredSeniority] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      // Load org settings via the connection status endpoint (which returns provider config).
      const res = await base44.functions.invoke("getOrgConnectionStatus", {});
      const data = res.data || res;
      if (data.connected) setConnected(data.connected);
      const config = data.enrichment_config;
      if (config && Array.isArray(config.providers)) {
        setProviders(config.providers);
      } else {
        // Default order
        setProviders(DEFAULT_PROVIDER_ORDER.map((p, i) => ({ provider: p, enabled: true, priority: i + 1 })));
      }
      if (config?.target_roles) setTargetRoles(config.target_roles.join(", "));
      if (config?.preferred_seniority) setPreferredSeniority(config.preferred_seniority.join(", "));
    } catch {
      setProviders(DEFAULT_PROVIDER_ORDER.map((p, i) => ({ provider: p, enabled: true, priority: i + 1 })));
    } finally { setLoading(false); }
  };

  const isProviderConnected = (providerId) => {
    const keyMap = { apollo: "APOLLO_API_KEY", lusha: "LUSHA_API_KEY", fullenrich: "FULLENRICH_API_KEY" };
    return !!(connected[keyMap[providerId]] || connectionStatus?.connected?.[keyMap[providerId]]);
  };

  const move = (idx, dir) => {
    const newProv = [...providers];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= newProv.length) return;
    [newProv[idx], newProv[swapIdx]] = [newProv[swapIdx], newProv[idx]];
    // Recompute priorities
    newProv.forEach((p, i) => { p.priority = i + 1; });
    setProviders(newProv);
  };

  const toggle = (providerId) => {
    setProviders(providers.map((p) => p.provider === providerId ? { ...p, enabled: !p.enabled } : p));
  };

  const resetToRecommended = () => {
    setProviders(DEFAULT_PROVIDER_ORDER.map((p, i) => ({ provider: p, enabled: true, priority: i + 1 })));
  };

  const save = async () => {
    setSaving(true); setErr(""); setMsg("");
    try {
      const roles = targetRoles.split(",").map((r) => r.trim()).filter(Boolean);
      const seniority = preferredSeniority.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await base44.functions.invoke("saveProviderPriority", {
        providers,
        target_roles: roles,
        preferred_seniority: seniority,
      });
      if (res.data) { setProviders(res.data.providers || providers); }
      setMsg("Provider priority saved.");
    } catch (e) { setErr(e.message || "Could not save provider priority."); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  const connectedProviders = providers.filter((p) => isProviderConnected(p.provider));
  const disconnectedProviders = providers.filter((p) => !isProviderConnected(p.provider));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Users className="w-4 h-4" /> Enrichment Provider Priority</h3>
          <p className="text-sm text-slate-500 mt-0.5">Set the order providers are tried when enriching prospects.</p>
        </div>
        <Button onClick={resetToRecommended} variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600">
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Use recommended order
        </Button>
      </div>

      {connectedProviders.length === 0 ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-700">
            No enrichment providers connected yet. Connect Apollo, Lusha or FullEnrich above to start enriching prospects.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {connectedProviders.map((p, idx) => (
            <div key={p.provider} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center">{idx + 1}</span>
              <div className="flex-1">
                <p className="font-medium text-slate-900 text-sm">{PROVIDER_LABELS[p.provider] || p.provider}</p>
                <p className="text-xs text-slate-400">{getProviderCapabilities(p.provider)}</p>
              </div>
              <button
                onClick={() => toggle(p.provider)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${p.enabled !== false ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-400"}`}
              >
                {p.enabled !== false ? "Enabled" : "Disabled"}
              </button>
              <div className="flex items-center gap-0.5">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === connectedProviders.length - 1} className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {disconnectedProviders.length > 0 && (
            <p className="text-xs text-slate-400 pt-1">
              Not connected: {disconnectedProviders.map((p) => PROVIDER_LABELS[p.provider]).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Target roles configuration */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div>
          <label className="text-xs uppercase tracking-widest text-slate-400 mb-1.5 block flex items-center gap-1">
            <Target className="w-3 h-3" /> Target decision-maker roles
          </label>
          <Input
            value={targetRoles}
            onChange={(e) => setTargetRoles(e.target.value)}
            placeholder="Commercial Director, Development Director, Sales Director, Managing Director"
            className="text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">Comma-separated. Cadence will prioritise these roles when ranking decision-makers.</p>
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-slate-400 mb-1.5 block">Preferred seniority keywords</label>
          <Input
            value={preferredSeniority}
            onChange={(e) => setPreferredSeniority(e.target.value)}
            placeholder="Managing Director, CEO, Director, Head of"
            className="text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">Comma-separated. Used to rank decision-makers when no exact target role match is found.</p>
        </div>
      </div>

      {msg && <p className="text-sm text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> {msg}</p>}
      {err && <p className="text-sm text-rose-600">{err}</p>}

      <Button onClick={save} disabled={saving} className="rounded-full">
        {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
        Save provider priority
      </Button>
    </div>
  );
}

function getProviderCapabilities(provider) {
  const caps = {
    apollo: "Decision-makers, personal emails, mobiles, company intelligence",
    lusha: "Personal emails, mobile numbers, direct dials",
    fullenrich: "Limited credits — mobile numbers only for contacts still missing a phone",
  };
  return caps[provider] || "";
}