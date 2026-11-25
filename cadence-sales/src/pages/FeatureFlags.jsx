import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Flag, Plus, RefreshCw, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_LABELS = {
  draft: "Draft", internal: "Internal", limited_rollout: "Limited", general_available: "GA", retired: "Retired",
};
const ROLLOUT_LABELS = {
  global: "Global", organisation: "Organisation", role: "Role", percentage: "Percentage", allowlist: "Allowlist",
};

export default function FeatureFlags() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("manageFeatureFlag", { action: "list" });
      setFlags(res.data.flags || []);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <Flag className="w-7 h-7 text-slate-700" /> Feature Flags
          </h1>
          <p className="text-slate-500 mt-1">Controlled feature rollout for pilot organisations.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="w-4 h-4 mr-2" />New Flag</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : flags.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Flag className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No feature flags yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {flags.map(f => (
            <div key={f.id} className="rounded-xl border border-slate-200 bg-white px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900 text-sm font-mono">{f.flag_key}</p>
                  <Badge variant="outline" className="text-xs">{STATUS_LABELS[f.status] || f.status}</Badge>
                  <Badge variant="secondary" className="text-xs">{ROLLOUT_LABELS[f.rollout_type] || f.rollout_type}</Badge>
                </div>
                {f.description && <p className="text-xs text-slate-500 mt-1">{f.description}</p>}
                {f.reason && <p className="text-xs text-slate-400 mt-0.5">Reason: {f.reason}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(f); setShowForm(true); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={async () => {
                  if (confirm(`Delete flag "${f.flag_key}"?`)) {
                    await base44.functions.invoke("manageFeatureFlag", { action: "delete", flag_id: f.id });
                    load();
                  }
                }}>
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <FlagForm flag={editing} onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  );
}

function FlagForm({ flag, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    flag_key: flag?.flag_key || "",
    description: flag?.description || "",
    status: flag?.status || "draft",
    rollout_type: flag?.rollout_type || "global",
    rollout_percentage: flag?.rollout_percentage || 0,
    reason: flag?.reason || "",
    success_measure: flag?.success_measure || "",
    rollback_condition: flag?.rollback_condition || "",
  });

  const save = async () => {
    setSaving(true);
    try {
      if (flag) {
        await base44.functions.invoke("manageFeatureFlag", { action: "update", flag_id: flag.id, ...form });
      } else {
        await base44.functions.invoke("manageFeatureFlag", { action: "create", ...form });
      }
      onSaved();
      onClose();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{flag ? "Edit flag" : "New feature flag"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Flag key</Label>
            <Input value={form.flag_key} onChange={e => setForm({ ...form, flag_key: e.target.value })} disabled={!!flag} placeholder="e.g. new_dialer_ui" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rollout type</Label>
              <Select value={form.rollout_type} onValueChange={v => setForm({ ...form, rollout_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLLOUT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.rollout_type === "percentage" && (
            <div>
              <Label>Rollout percentage ({form.rollout_percentage}%)</Label>
              <Input type="number" min="0" max="100" value={form.rollout_percentage} onChange={e => setForm({ ...form, rollout_percentage: parseInt(e.target.value) || 0 })} />
            </div>
          )}
          <div>
            <Label>Reason</Label>
            <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={2} />
          </div>
          <div>
            <Label>Rollback condition</Label>
            <Textarea value={form.rollback_condition} onChange={e => setForm({ ...form, rollback_condition: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.flag_key}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}