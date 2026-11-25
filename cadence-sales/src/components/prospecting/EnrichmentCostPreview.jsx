import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_LABELS = {
  pending: "Pending",
  enriching: "In progress",
  enriched: "Enriched (legacy)",
  complete: "Complete",
  partially_enriched: "Partially enriched",
  no_contact_details: "No contact details",
  not_found: "Not found",
  out_of_scope: "Out of scope",
  provider_unavailable: "Provider unavailable",
  failed: "Failed",
};

// Cost preview dialog shown before starting a paid enrichment batch.
// Displays the number of companies to process, providers that will be used,
// estimated credits, and remaining monthly allowance. Requires explicit
// confirmation before charging any credits.
export default function EnrichmentCostPreview({ open, onClose, onConfirm, prospects, newCompaniesCount = 0, listId, permittedCountries }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    base44.functions.invoke("getUsageAndBilling", {}).then((res) => setUsage(res.data || res)).catch(() => setUsage(null));
  }, [open]);

  if (!open) return null;

  // Count billable prospects — excludes out_of_scope, cached (already enriched/complete),
  // and those within cooldown.
  const existingBillable = prospects.filter((p) => {
    if (["complete", "enriched", "out_of_scope"].includes(p.enrichment_status)) return false;
    if (p.enrichment_status === "not_found" && p.retry_cooldown_expires_at && new Date(p.retry_cooldown_expires_at) > new Date()) return false;
    return true;
  });
  const newCompanies = Array.from({ length: newCompaniesCount }, () => ({ contacts: [] }));
  const billable = [...existingBillable, ...newCompanies];

  const cached = prospects.filter((p) => ["complete", "enriched", "partially_enriched"].includes(p.enrichment_status)).length;
  const outOfScope = prospects.filter((p) => p.enrichment_status === "out_of_scope").length;
  const contactsToSubmit = existingBillable.reduce((sum, p) => sum + Math.min(p.contacts?.length || 1, 3), 0) + newCompaniesCount;

  const lushaConnected = usage?.connected?.LUSHA_API_KEY;
  const fullenrichConnected = usage?.connected?.FULLENRICH_API_KEY;

  // Estimated costs: Lusha ~1 credit/contact, FullEnrich ~10 credits/contact
  const lushaEstimate = lushaConnected ? contactsToSubmit : 0;
  const fullenrichEstimate = fullenrichConnected ? contactsToSubmit * 10 : 0;
  const aiEstimate = billable.length; // 1 InvokeLLM call per company
  const totalEstimate = lushaEstimate + fullenrichEstimate + aiEstimate;

  const remainingAllowance = usage?.monthly_allowance ?? usage?.remaining_credits ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <h2 className="font-display text-xl font-semibold text-slate-900">Enrichment cost preview</h2>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-widest text-slate-400">Companies to process</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{billable.length}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-widest text-slate-400">Contacts to submit</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{contactsToSubmit}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <p className="text-xs uppercase tracking-widest text-slate-400">Providers</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">AI web research</span>
              <span className="text-slate-900 font-medium">{billable.length} credits</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Lusha {lushaConnected ? "" : "(not connected)"}</span>
              <span className={lushaConnected ? "text-slate-900 font-medium" : "text-slate-400"}>{lushaEstimate} credits</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">FullEnrich {fullenrichConnected ? "" : "(not connected)"}</span>
              <span className={fullenrichConnected ? "text-slate-900 font-medium" : "text-slate-400"}>{fullenrichEstimate} credits</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-100">
              <span className="font-medium text-slate-900">Maximum possible cost</span>
              <span className="font-semibold text-slate-900">{totalEstimate} credits</span>
            </div>
          </div>

          {remainingAllowance != null && (
            <div className="flex items-center justify-between text-sm rounded-xl bg-emerald-50 border border-emerald-200 p-3">
              <span className="text-emerald-700">Remaining monthly allowance</span>
              <span className="font-semibold text-emerald-800">{remainingAllowance} credits</span>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1 text-xs text-slate-500">
            <p><CheckCircle2 className="w-3 h-3 inline mr-1 text-emerald-500" /> {cached} cached (no charge)</p>
            {outOfScope > 0 && <p><AlertTriangle className="w-3 h-3 inline mr-1 text-amber-500" /> {outOfScope} out of scope (no charge)</p>}
            <p>No charge for out-of-scope, cached, duplicate, or suppressed records.</p>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="outline" onClick={onClose} className="rounded-full border-slate-300 flex-1">Cancel</Button>
          <Button
            onClick={() => { onConfirm(); onClose(); }}
            disabled={loading || billable.length === 0}
            className="rounded-full bg-emerald-600 hover:bg-emerald-500 flex-1"
          >
            <Sparkles className="w-4 h-4 mr-2" /> Confirm & enrich {billable.length} companies
          </Button>
        </div>
      </div>
    </div>
  );
}