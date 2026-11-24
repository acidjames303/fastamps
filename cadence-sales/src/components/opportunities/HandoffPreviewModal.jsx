import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Send, X, AlertCircle, CheckCircle2, ExternalLink, RotateCcw } from "lucide-react";

export default function HandoffPreviewModal({ opportunity, destinations, onClose, onSent }) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDest, setSelectedDest] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // Generate a preview by calling executeHandoff with a dry-run flag
        // For now, we fetch the related data client-side to build a preview
        const [company, contact, campaign] = await Promise.all([
          opportunity.company_id ? base44.entities.Company.get(opportunity.company_id).catch(() => null) : null,
          opportunity.primary_contact_id ? base44.entities.Contact.get(opportunity.primary_contact_id).catch(() => null) : null,
          opportunity.campaign_id ? base44.entities.Campaign.get(opportunity.campaign_id).catch(() => null) : null,
        ]);
        setPayload({
          payload_version: 1,
          cadence_opportunity_id: opportunity.id,
          campaign_reference: campaign?.client_reference || null,
          client_name: campaign?.client_name || opportunity.client_name || null,
          company: { name: company?.name, website: company?.website, domain: company?.domain, industry: company?.industry },
          primary_contact: { full_name: contact?.full_name, job_title: contact?.job_title, email: contact?.email, phone: contact?.phone },
          qualification: {
            need_summary: opportunity.need_summary,
            pain_points: opportunity.pain_points,
            current_solution: opportunity.current_solution,
            timing: opportunity.timing,
            authority_status: opportunity.authority_status,
          },
          agreed_next_step: opportunity.next_step,
          estimated_value: opportunity.estimated_value,
          currency: opportunity.currency,
        });
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    })();
  }, [opportunity.id]);

  const send = async () => {
    if (!selectedDest) { setError("Select a destination."); return; }
    const dest = destinations.find((d) => d.id === selectedDest);
    setSending(true); setError(""); setResult(null);
    try {
      const res = await base44.functions.invoke("executeHandoff", {
        opportunity_id: opportunity.id,
        destination_type: dest.destination_type,
        destination_id: dest.id,
      });
      setResult(res.data || res);
      if ((res.data || res).status === "succeeded") onSent?.();
    } catch (e) { setError(e.message); } finally { setSending(false); }
  };

  const retry = async () => {
    if (!result?.attempt_id) return;
    setSending(true); setError("");
    try {
      const res = await base44.functions.invoke("executeHandoff", { retry_attempt_id: result.attempt_id });
      setResult(res.data || res);
      if ((res.data || res).status === "succeeded") onSent?.();
    } catch (e) { setError(e.message); } finally { setSending(false); }
  };

  const activeDests = (destinations || []).filter((d) => d.status === "active");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Handoff preview</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4 max-h-64 overflow-y-auto">
              <pre className="text-xs text-slate-600 whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>
            </div>

            {opportunity.handoff_status === "handed_off" && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Already handed off
                {opportunity.external_record_url && (
                  <a href={opportunity.external_record_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 underline ml-2">
                    View external record <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {opportunity.handoff_status === "failed" && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 mb-4">
                <AlertCircle className="w-4 h-4 inline mr-1" /> Last handoff failed: {opportunity.last_handoff_error || "Unknown error"}
              </div>
            )}

            {result && (
              <div className={`rounded-lg p-3 text-sm mb-4 ${result.status === "succeeded" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {result.status === "succeeded" ? (
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Handoff succeeded!</span>
                ) : (
                  <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {result.error || "Handoff failed"}</span>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-600 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            {activeDests.length > 0 ? (
              <div className="space-y-3">
                <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={selectedDest} onChange={(e) => setSelectedDest(e.target.value)}>
                  <option value="">Select destination...</option>
                  {activeDests.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.destination_type})</option>)}
                </select>
                <div className="flex gap-2">
                  <Button onClick={send} disabled={!selectedDest || sending} className="flex-1">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                    Send handoff
                  </Button>
                  {result && result.status !== "succeeded" && (
                    <Button variant="outline" onClick={retry} disabled={sending}>
                      <RotateCcw className="w-4 h-4 mr-1" /> Retry
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                No active destinations configured. Ask an admin to set up an integration in Integration Settings.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}