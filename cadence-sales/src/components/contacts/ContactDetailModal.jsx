import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, MapPin, Users } from "lucide-react";

const statusStyles = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-200",
  bad: "bg-rose-50 text-rose-700 border-rose-200",
  wrong_person: "bg-amber-50 text-amber-700 border-amber-200",
  dnc: "bg-slate-200 text-slate-700 border-slate-300",
  untested: "bg-slate-50 text-slate-500 border-slate-200",
};

export default function ContactDetailModal({ contact, open, onOpenChange, onSaved }) {
  const [form, setForm] = useState({
    full_name: contact?.full_name || "",
    job_title: contact?.job_title || "",
    phone: contact?.phone || "",
    email: contact?.email || "",
    notes: contact?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!contact) return null;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await base44.entities.Contact.update(contact.id, {
        full_name: form.full_name,
        job_title: form.job_title,
        phone: form.phone,
        email: form.email,
        notes: form.notes,
      });
      onSaved && onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(e.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const briefSummary = (text) => {
    if (!text) return "";
    try { const o = JSON.parse(text); return o.summary || ""; } catch { return text; }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{contact.full_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Read-only company context */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-1.5 text-sm">
            <p className="font-medium text-slate-900 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" /> {contact.company || "—"}
            </p>
            <p className="text-slate-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" /> {contact.industry || "—"} · {contact.employee_range || "—"}
            </p>
            <p className="text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> {contact.location || "—"}
            </p>
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Full name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="rounded-lg border-slate-200" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Job title</Label>
              <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                className="rounded-lg border-slate-200" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="rounded-lg border-slate-200" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="rounded-lg border-slate-200" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="rounded-lg border-slate-200 min-h-[80px]" />
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={statusStyles[contact.number_status] || statusStyles.untested}>
              {(contact.number_status || "untested").replace("_", " ")}
            </Badge>
            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
              {contact.call_status || "new"}
            </Badge>
            {contact.cluster && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {contact.cluster}
              </Badge>
            )}
          </div>

          {/* AI brief summary */}
          {briefSummary(contact.ai_brief) && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-xs text-slate-600">
              <p className="font-medium text-emerald-700 mb-1">AI brief</p>
              {briefSummary(contact.ai_brief)}
            </div>
          )}

          {error && <p className="text-rose-600 text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full border-slate-300">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}