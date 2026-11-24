import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Plus, RefreshCw, CheckCircle2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SEVERITY_STYLES = {
  critical: "text-rose-700 bg-rose-50 border-rose-200",
  high: "text-amber-700 bg-amber-50 border-amber-200",
  normal: "text-slate-600 bg-slate-50 border-slate-200",
  low: "text-slate-400 bg-slate-50 border-slate-200",
};
const STATUS_LABELS = {
  investigating: "Investigating", identified: "Identified", monitoring: "Monitoring", resolved: "Resolved",
};

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("manageIncident", { action: "list" });
      setIncidents(res.data.incidents || []);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 text-slate-700" /> Incidents
          </h1>
          <p className="text-slate-500 mt-1">Track and resolve platform incidents.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" />New Incident</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : incidents.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-3" />
          <p className="text-slate-500">No incidents recorded.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.map(i => (
            <div key={i.id} className="rounded-xl border border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`text-xs ${SEVERITY_STYLES[i.severity] || SEVERITY_STYLES.normal}`}>{i.severity}</Badge>
                <p className="font-medium text-slate-900 text-sm flex-1">{i.title}</p>
                <Badge variant="outline" className="text-xs">{STATUS_LABELS[i.status] || i.status}</Badge>
                <Button
                  variant="ghost" size="sm"
                  onClick={async () => {
                    const published = !i.status_notice_published;
                    await base44.functions.invoke("manageIncident", { action: "publish_notice", incident_id: i.id, published });
                    load();
                  }}
                >
                  <Radio className={`w-3.5 h-3.5 ${i.status_notice_published ? "text-emerald-500" : "text-slate-300"}`} />
                  <span className="ml-1 text-xs">{i.status_notice_published ? "Published" : "Notice"}</span>
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2">{i.safe_summary}</p>
              {i.customer_impact && <p className="text-xs text-slate-400 mt-1">Impact: {i.customer_impact}</p>}
              {i.workaround && <p className="text-xs text-emerald-600 mt-1">Workaround: {i.workaround}</p>}
              {i.status === "resolved" && i.resolution_summary && (
                <p className="text-xs text-slate-400 mt-1">Resolution: {i.resolution_summary}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && <IncidentForm onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  );
}

function IncidentForm({ onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", safe_summary: "", severity: "normal", customer_impact: "",
  });

  const save = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke("manageIncident", { action: "create", ...form });
      onSaved();
      onClose();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>New incident</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Safe summary (no credentials or customer content)</Label>
            <Textarea value={form.safe_summary} onChange={e => setForm({ ...form, safe_summary: e.target.value })} rows={3} />
          </div>
          <div>
            <Label>Severity</Label>
            <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SEVERITY_STYLES).map(([v]) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Customer impact</Label>
            <Textarea value={form.customer_impact} onChange={e => setForm({ ...form, customer_impact: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.title || !form.safe_summary}>{saving ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}