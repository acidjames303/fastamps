import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Send, CheckCircle2, RotateCcw, FileDown, FileText, X, AlertCircle, Lock } from "lucide-react";
import LeadSheetSection from "@/components/leadsheet/LeadSheetSection";
import LeadSheetAuditTrail from "@/components/leadsheet/LeadSheetAuditTrail";
import LeadSheetStatusBadge from "@/components/leadsheet/LeadSheetStatusBadge";
import DictateButton from "@/components/dialer/DictateButton";
import {
  LEAD_SHEET_SECTIONS,
  LEAD_SHEET_FIELD_KEYS,
  canEditLeadSheet,
  canReviewLeadSheet,
  leadSheetCompletion,
  missingLeadSheetFields,
} from "@/lib/leadSheet";
import {
  downloadLeadSheets,
  markLeadSheetSent,
  reviewLeadSheet,
  saveLeadSheet,
  submitLeadSheet,
} from "@/lib/leadSheetApi";
import { useAuth } from "@/lib/AuthContext";

const pickForm = (sheet) => {
  const form = {};
  for (const key of [...LEAD_SHEET_FIELD_KEYS, "internal_notes"]) form[key] = sheet?.[key] || "";
  return form;
};

// The caller's editable lead sheet: seven sections, autosave, dictation,
// missing-only filter, submit, review, and branded PDF/Word downloads.
export default function LeadSheetEditor({ sheetId, onChanged, onClose }) {
  const { user } = useAuth();
  const [sheet, setSheet] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  const [missingOnly, setMissingOnly] = useState(false);
  const [returnReason, setReturnReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setMessage("");
    base44.entities.LeadSheet.get(sheetId)
      .then((record) => {
        if (cancelled) return;
        setSheet(record);
        setForm(pickForm(record));
      })
      .catch(() => { if (!cancelled) setError("Could not open this lead sheet."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sheetId]);

  const editable = canEditLeadSheet(sheet, { userId: user?.id, role: user?.app_role });
  const reviewer = canReviewLeadSheet(user?.app_role);
  const missing = sheet ? missingLeadSheetFields({ ...sheet, ...form }) : [];
  const completion = leadSheetCompletion({ ...sheet, ...form });

  // Autosave: the caller never loses typing, and a reviewer sees the saved state.
  useEffect(() => {
    if (!sheet || !editable) return;
    if (JSON.stringify(form) === JSON.stringify(pickForm(sheet))) return;
    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        const result = await saveLeadSheet(sheet.id, form);
        if (result?.sheet) {
          setSheet(result.sheet);
          setSavedAt(new Date());
          onChanged?.();
        }
      } catch (e) {
        setError(e?.response?.data?.error || e?.message || "Could not save your changes.");
      } finally {
        setSaving(false);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [form, sheet, editable]);

  const run = async (label, fn) => {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      const result = await fn();
      if (result?.sheet) {
        setSheet(result.sheet);
        setForm(pickForm(result.sheet));
      }
      onChanged?.();
      return result;
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "That did not work.");
      return null;
    } finally {
      setBusy("");
    }
  };

  const download = async (kind) => {
    setBusy(kind);
    setError("");
    setMessage("");
    try {
      await downloadLeadSheets([sheet], [kind]);
      const refreshed = await base44.entities.LeadSheet.get(sheet.id);
      setSheet(refreshed);
      setMessage(`${kind === "docx" ? "Word" : "PDF"} downloaded. Mark it sent once the client has it.`);
      onChanged?.();
    } catch (e) {
      setError(e?.message || "Could not build the document.");
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (!sheet) {
    return <p className="text-sm text-rose-600">{error || "Lead sheet not found."}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold text-slate-900">
              {sheet.organisation_name || "Lead sheet"}
            </h2>
            <LeadSheetStatusBadge status={sheet.status} />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {[sheet.contact_name, sheet.caller_name && `Prepared by ${sheet.caller_name}`].filter(Boolean).join(" · ")}
            {saving ? " · Saving…" : savedAt ? ` · Saved ${savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            <strong className="text-slate-800">{completion.filled}</strong> of {completion.total} fields complete
            {missing.length ? ` · ${missing.length} still blank` : " · nothing missing"}
          </p>
          <button
            type="button"
            onClick={() => setMissingOnly((value) => !value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              missingOnly ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {missingOnly ? "Showing missing only" : "Show missing only"}
          </button>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.round((completion.filled / completion.total) * 100)}%` }}
          />
        </div>
      </div>

      {LEAD_SHEET_SECTIONS.map((section) => (
        <LeadSheetSection
          key={section.key}
          section={section}
          form={form}
          onChange={(key, value) => setForm((prev) => ({ ...prev, [key]: value }))}
          disabled={!editable}
          missingOnly={missingOnly}
          missing={missing}
        />
      ))}

      {missingOnly && missing.length === 0 && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
          Every field has an answer — nothing left to fill in.
        </p>
      )}

      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Internal notes — never in the PDF, Word file or client report
          </p>
          {editable && (
            <DictateButton
              value={form.internal_notes || ""}
              onChange={(value) => setForm((prev) => ({ ...prev, internal_notes: value }))}
              label="Dictate"
            />
          )}
        </div>
        <Textarea
          value={form.internal_notes || ""}
          onChange={(event) => setForm((prev) => ({ ...prev, internal_notes: event.target.value }))}
          disabled={!editable}
          rows={3}
          placeholder="Coaching notes, provider caveats, anything the client must not see…"
          className="rounded-xl border-amber-200 bg-white text-sm"
        />
      </div>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">{message}</p>
      )}

      {sheet.status === "submitted" && reviewer && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
          <p className="text-xs font-medium text-slate-600">Returning it to the caller (required if you return it)</p>
          <Input
            value={returnReason}
            onChange={(event) => setReturnReason(event.target.value)}
            placeholder="What needs adding or correcting?"
            className="rounded-xl border-slate-200"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {editable && (
          <Button
            onClick={() => run("submit", () => submitLeadSheet(sheet.id, form)).then((res) => res && setMessage("Submitted for review."))}
            disabled={!!busy || saving}
            className="rounded-full bg-emerald-600 hover:bg-emerald-700"
          >
            {busy === "submit" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Submit for review
          </Button>
        )}

        {sheet.status === "submitted" && reviewer && (
          <>
            <Button
              onClick={() => run("approve", () => reviewLeadSheet(sheet.id, "approve")).then((res) => res && setMessage("Approved — ready to download and send."))}
              disabled={!!busy}
              className="rounded-full"
            >
              {busy === "approve" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => run("return", () => reviewLeadSheet(sheet.id, "return", returnReason))}
              disabled={!!busy || !returnReason.trim()}
              className="rounded-full border-amber-300 text-amber-700"
            >
              {busy === "return" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Return to caller
            </Button>
          </>
        )}

        <Button variant="outline" onClick={() => download("pdf")} disabled={!!busy} className="rounded-full">
          {busy === "pdf" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
          Download PDF
        </Button>
        <Button variant="outline" onClick={() => download("docx")} disabled={!!busy} className="rounded-full">
          {busy === "docx" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
          Download Word
        </Button>

        {sheet.status === "approved" && reviewer && (
          <Button
            onClick={() => run("sent", () => markLeadSheetSent(sheet.id)).then((res) => res && setMessage("Marked as sent to the client."))}
            disabled={!!busy}
            variant="outline"
            className="rounded-full border-violet-300 text-violet-700"
          >
            {busy === "sent" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Mark sent
          </Button>
        )}

        {sheet.status === "sent" && (
          <span className="text-xs text-slate-500">Sent {sheet.sent_at ? new Date(sheet.sent_at).toLocaleDateString("en-GB") : ""} — nothing is emailed automatically.</span>
        )}
      </div>

      <LeadSheetAuditTrail sheet={sheet} />
    </div>
  );
}