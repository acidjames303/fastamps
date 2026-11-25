import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, Search, CircleAlert } from "lucide-react";

const EMPTY = { full_name: "", job_title: "", phone: "", email: "", linkedin: "", context_note: "" };

// Capture a contact the caller was given on a call. Details handed over are
// saved as entered; anything missing can be looked up through the configured
// providers straight away. Pass `contact` to correct an existing contact.
export default function AddContactDialog({ open, onClose, company, campaignId, contact = null, onAdded, onSaved }) {
  const editing = !!contact;
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // Fill the form with the contact being corrected each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setBusy("");
    setError("");
    setForm(contact ? {
      full_name: contact.full_name || "",
      job_title: contact.job_title || "",
      phone: contact.phone || "",
      email: contact.email || "",
      linkedin: contact.linkedin || "",
      context_note: contact.notes || "",
    } : EMPTY);
  }, [open, contact?.id]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const reset = () => { setForm(EMPTY); setError(""); setBusy(""); };

  const close = () => { if (busy) return; reset(); onClose?.(); };

  const save = async (findDetails) => {
    if (!form.full_name.trim() || busy) return;
    setBusy(findDetails ? "find" : "save");
    setError("");
    if (editing) {
      try {
        const phone = form.phone.trim();
        const patch = {
          full_name: form.full_name.trim(),
          job_title: form.job_title.trim(),
          phone,
          email: form.email.trim(),
          linkedin: form.linkedin.trim(),
          notes: form.context_note,
        };
        // A corrected number is untested again rather than still flagged.
        if (phone && phone !== (contact.phone || "") && ["bad", "dnc"].includes(contact.number_status)) {
          patch.number_status = "untested";
        }
        const updated = await base44.entities.Contact.update(contact.id, patch);
        onSaved?.(updated || { ...contact, ...patch });
        onClose?.();
      } catch (e) {
        setError(e?.response?.data?.error || e.message || "Could not save this contact.");
      } finally {
        setBusy("");
      }
      return;
    }
    try {
      const res = await base44.functions.invoke("addDialerContact", {
        company_id: company?.id,
        campaign_id: campaignId || "",
        full_name: form.full_name,
        job_title: form.job_title,
        phone: form.phone,
        email: form.email,
        linkedin: form.linkedin,
        context_note: form.context_note,
        find_details: findDetails,
      });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      reset();
      onAdded?.(data);
      onClose?.();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not add this contact.");
    } finally {
      setBusy("");
    }
  };

  const missingDetails = !form.phone.trim() || !form.email.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-slate-900">{editing ? "Edit contact" : "Add a contact"}</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {editing
              ? `Correct the details for ${contact?.full_name || "this contact"}.`
              : company?.name
                ? `Someone at ${company.name} worth speaking to. Add what you were given — we can look up the rest.`
                : "Someone worth speaking to. Add what you were given — we can look up the rest."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400">Full name</label>
            <input
              autoFocus
              value={form.full_name}
              onChange={set("full_name")}
              placeholder="Jane Smith"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400">Job title</label>
            <input
              value={form.job_title}
              onChange={set("job_title")}
              placeholder="Operations Director"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="01923 729132"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="jane@company.co.uk"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400">LinkedIn</label>
            <input
              value={form.linkedin}
              onChange={set("linkedin")}
              placeholder="https://www.linkedin.com/in/…"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400">What you were told</label>
            <textarea
              value={form.context_note}
              onChange={set("context_note")}
              rows={2}
              placeholder="Referred by the receptionist as the person who owns the contract."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <CircleAlert className="w-4 h-4 mt-0.5 flex-none" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button
            onClick={() => save(false)}
            disabled={!form.full_name.trim() || !!busy}
            className="rounded-full bg-emerald-600 hover:bg-emerald-500 flex-1"
          >
            {busy === "save" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
            {editing ? "Save changes" : "Save contact"}
          </Button>
          {!editing && missingDetails && (
            <Button
              onClick={() => save(true)}
              disabled={!form.full_name.trim() || !!busy}
              variant="outline"
              className="rounded-full border-emerald-300 text-emerald-700 flex-1"
            >
              {busy === "find" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Save &amp; find details
            </Button>
          )}
          <Button onClick={close} disabled={!!busy} variant="ghost" className="rounded-full text-slate-500">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}