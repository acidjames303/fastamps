import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import DictateButton from "@/components/dialer/DictateButton";
import { Copy, Check, Mail, X, Loader2 } from "lucide-react";
import { buildMailtoHref } from "@/lib/emailDraft";
import { base44 } from "@/api/base44Client";
import EmailMailboxConnect from "@/components/email/EmailMailboxConnect";

// Human-gated email draft after Info requested. Never auto-sends.
// Save-to-mailbox only when allowSaveDraft is true (admin / BDM / solo SDR / campaign permission).
export default function EmailDraftModal({
  draft,
  contactEmail,
  accountManagerEmail,
  onClose,
  allowSaveDraft = false,
  campaignId = "",
  inboxHint = "",
  perspectives = [],
}) {
  const [subject, setSubject] = useState(draft?.subject || "");
  const [body, setBody] = useState(draft?.body || "");
  const [perspectiveId, setPerspectiveId] = useState(perspectives[0]?.id || "");
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showConnect, setShowConnect] = useState(false);

  const refreshStatus = async () => {
    if (!allowSaveDraft) return;
    try {
      const res = await base44.functions.invoke("manageEmailMailbox", { action: "status" });
      setStatus(res.data || res);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => { refreshStatus(); }, [allowSaveDraft]);

  const copyAll = async () => {
    const text = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const openMail = () => {
    const href = buildMailtoHref({
      to: contactEmail || "",
      cc: accountManagerEmail || "",
      subject,
      body,
    });
    window.open(href, "_blank");
  };

  const saveToMailbox = async (provider) => {
    if (!allowSaveDraft) return;
    setSaving(provider); setError(""); setMessage("");
    try {
      const res = await base44.functions.invoke("manageEmailMailbox", {
        action: "create_draft",
        provider,
        to: contactEmail || "",
        cc: accountManagerEmail || "",
        subject,
        body,
        campaign_id: campaignId || "",
      });
      const data = res.data || res;
      if (data.needs_connect) {
        setShowConnect(true);
        setError(`Connect ${provider === "gmail" ? "Gmail" : "Outlook"} first.`);
        return;
      }
      setMessage(data.message || `Draft saved in ${data.mailbox || provider}.`);
    } catch (e) {
      const msg = e.message || "Could not save draft.";
      if (/connect/i.test(msg)) setShowConnect(true);
      setError(msg);
    } finally {
      setSaving("");
      refreshStatus();
    }
  };

  const gmail = status?.providers?.gmail;
  const outlook = status?.providers?.outlook;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Draft follow-up email</h2>
            <p className="text-sm text-slate-500 mt-1">
              {allowSaveDraft
                ? "Polish the wording, then save into your Gmail or Outlook drafts. Cadence never sends it for you."
                : "Review the suggested copy. Saving to a mailbox is not enabled for your role on this campaign — the admin has this in their inbox."}
            </p>
            {inboxHint ? <p className="text-xs text-emerald-700 mt-2">{inboxHint}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-900" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {perspectives.length > 1 && (
          <div className="mb-4">
            <label className="block text-xs text-slate-500 mb-1">Who it comes from</label>
            <div className="flex flex-wrap gap-2">
              {perspectives.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPerspectiveId(p.id);
                    setSubject(p.subject);
                    setBody(p.body);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    perspectiveId === p.id
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Switching replaces the wording below with that version — edit freely afterwards.
            </p>
          </div>
        )}

        <label className="block text-xs text-slate-500 mb-1">Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mb-3"
        />

        <label className="block text-xs text-slate-500 mb-1">Body</label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="rounded-xl min-h-48 mb-2"
        />
        <div className="mb-4">
          <DictateButton value={body} onChange={setBody} label="Dictate email" />
        </div>

        {allowSaveDraft && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 mb-4 space-y-2">
            <p className="text-xs font-medium text-slate-600">Save to your mailbox</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => saveToMailbox("gmail")}
                disabled={!!saving}
                className="rounded-full bg-slate-900 hover:bg-slate-800"
              >
                {saving === "gmail" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                {gmail?.connected ? `Save to Gmail (${gmail.email || "connected"})` : "Save to Gmail"}
              </Button>
              <Button
                type="button"
                onClick={() => saveToMailbox("outlook")}
                disabled={!!saving}
                variant="outline"
                className="rounded-full"
              >
                {saving === "outlook" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                {outlook?.connected ? `Save to Outlook (${outlook.email || "connected"})` : "Save to Outlook"}
              </Button>
              <Button type="button" variant="ghost" className="rounded-full" onClick={() => setShowConnect((v) => !v)}>
                {showConnect ? "Hide connect" : "Connect accounts"}
              </Button>
            </div>
            {showConnect && (
              <div className="pt-2">
                <EmailMailboxConnect compact />
              </div>
            )}
          </div>
        )}

        {message && <p className="text-sm text-emerald-700 mb-3">{message}</p>}
        {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={openMail} className="rounded-full">
            <Mail className="w-4 h-4 mr-2" /> Open mailto
          </Button>
          <Button type="button" variant="outline" onClick={copyAll} className="rounded-full">
            {copied ? <Check className="w-4 h-4 mr-2 text-emerald-600" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? "Copied" : "Copy draft"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-full ml-auto">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}