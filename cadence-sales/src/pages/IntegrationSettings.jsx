import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Pause, Play, FlaskConical, AlertCircle, CheckCircle2, Webhook } from "lucide-react";
import EmailOAuthAdmin from "@/components/email/EmailOAuthAdmin";

export default function IntegrationSettings() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    destination_type: "webhook", name: "", webhook_url: "",
    webhook_auth_method: "none", auth_token: "", auth_header_name: "", auth_header_value: "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("manageIntegration", { action: "list" });
      setDestinations((res.data || res).destinations || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.destination_type) { setError("Name and type are required."); return; }
    setSaving(true); setError("");
    try {
      const authCreds = {};
      if (form.destination_type === "webhook" && form.webhook_auth_method === "bearer" && form.auth_token) {
        authCreds.token = form.auth_token;
      } else if (form.destination_type === "webhook" && form.webhook_auth_method === "header" && form.auth_header_name && form.auth_header_value) {
        authCreds.headerName = form.auth_header_name;
        authCreds.headerValue = form.auth_header_value;
      } else if (form.destination_type === "hubspot" && form.auth_token) {
        authCreds.hubspot_token = form.auth_token;
      }

      await base44.functions.invoke("manageIntegration", {
        action: "save",
        destination_type: form.destination_type,
        name: form.name,
        webhook_url: form.webhook_url,
        webhook_auth_method: form.webhook_auth_method,
        auth_credentials: authCreds,
      });
      setForm({ destination_type: "webhook", name: "", webhook_url: "", webhook_auth_method: "none", auth_token: "", auth_header_name: "", auth_header_value: "" });
      setShowForm(false);
      await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const test = async (destId) => {
    setTesting(destId);
    try { await base44.functions.invoke("manageIntegration", { action: "test", destination_id: destId }); await load(); }
    catch {} finally { setTesting(null); }
  };

  const toggle = async (dest) => {
    const action = dest.status === "active" ? "pause" : "activate";
    await base44.functions.invoke("manageIntegration", { action, destination_id: dest.id });
    await load();
  };

  const disconnect = async (destId) => {
    await base44.functions.invoke("manageIntegration", { action: "disconnect", destination_id: destId });
    await load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Integrations</h1>
          <p className="text-sm text-slate-500">Configure handoff destinations for your organisation.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> {showForm ? "Cancel" : "Add destination"}
        </Button>
      </div>

      <EmailOAuthAdmin />

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Destination type</Label>
              <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.destination_type} onChange={(e) => setForm({ ...form, destination_type: e.target.value, webhook_auth_method: e.target.value === "hubspot" ? "bearer" : "none" })}>
                <option value="webhook">Generic webhook</option>
                <option value="csv">CSV export</option>
                <option value="hubspot">HubSpot</option>
                <option value="manual">Manual handoff</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Destination name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Client CRM webhook" />
            </div>
          </div>

          {form.destination_type === "webhook" && (
            <>
              <div className="space-y-1.5">
                <Label>Webhook URL (HTTPS required)</Label>
                <Input value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} placeholder="https://api.example.com/webhook" />
              </div>
              <div className="space-y-1.5">
                <Label>Authentication method</Label>
                <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.webhook_auth_method} onChange={(e) => setForm({ ...form, webhook_auth_method: e.target.value })}>
                  <option value="none">None</option>
                  <option value="bearer">Bearer token</option>
                  <option value="header">Custom header</option>
                  <option value="basic">Basic auth</option>
                </select>
              </div>
              {form.webhook_auth_method === "bearer" && (
                <div className="space-y-1.5">
                  <Label>Bearer token</Label>
                  <Input type="password" value={form.auth_token} onChange={(e) => setForm({ ...form, auth_token: e.target.value })} placeholder="Token — stored encrypted, never shown again" />
                </div>
              )}
              {form.webhook_auth_method === "header" && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Header name</Label>
                    <Input value={form.auth_header_name} onChange={(e) => setForm({ ...form, auth_header_name: e.target.value })} placeholder="X-API-Key" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Header value</Label>
                    <Input type="password" value={form.auth_header_value} onChange={(e) => setForm({ ...form, auth_header_value: e.target.value })} placeholder="Value — stored encrypted" />
                  </div>
                </div>
              )}
            </>
          )}

          {form.destination_type === "hubspot" && (
            <div className="space-y-1.5">
              <Label>HubSpot private app token</Label>
              <Input type="password" value={form.auth_token} onChange={(e) => setForm({ ...form, auth_token: e.target.value })} placeholder="pat-... — stored encrypted, never shown again" />
              <p className="text-xs text-slate-400">Create a private app at HubSpot Settings → Integrations → Private Apps with CRM scopes (Companies, Contacts, Deals).</p>
            </div>
          )}

          {error && <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 rounded-lg p-3"><AlertCircle className="w-4 h-4" /> {error}</div>}

          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save destination
          </Button>
        </div>
      )}

      {destinations.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <Webhook className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No integrations configured yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {destinations.map((d) => (
            <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{d.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      d.status === "active" ? "bg-emerald-50 text-emerald-600" :
                      d.status === "paused" ? "bg-amber-50 text-amber-600" :
                      "bg-slate-100 text-slate-400"
                    }`}>{d.status}</span>
                    <span className="text-xs text-slate-400">{d.destination_type}</span>
                  </div>
                  {d.webhook_url && <p className="text-xs text-slate-400 mt-1">{d.webhook_url}</p>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    {d.last_test_status === "success" && <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="w-3 h-3" /> Test passed</span>}
                    {d.last_test_status === "failed" && <span className="flex items-center gap-1 text-rose-500"><AlertCircle className="w-3 h-3" /> Test failed: {d.last_test_error}</span>}
                    {d.last_test_status === "untested" && <span>Not tested</span>}
                    {d.last_success_at && <span>Last success: {new Date(d.last_success_at).toLocaleDateString("en-GB")}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => test(d.id)} disabled={testing === d.id} title="Test connection">
                    {testing === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle(d)} title={d.status === "active" ? "Pause" : "Activate"}>
                    {d.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => disconnect(d.id)} className="text-rose-500" title="Disconnect">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}