import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Loader2 } from "lucide-react";
import LeadSheetStatusBadge from "@/components/leadsheet/LeadSheetStatusBadge";
import { buildLeadSheetPrefill, prefilledFieldKeys } from "@/lib/leadSheet";
import { createLeadSheetDraft } from "@/lib/leadSheetApi";

// Offered on a qualified opportunity: Cadence drafts the lead sheet from what
// is already known, and the caller fills only what is genuinely missing.
export default function LeadSheetOffer({ opportunity }) {
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!opportunity?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    base44.entities.LeadSheet
      .filter({ opportunity_id: opportunity.id }, "-created_date", 1)
      .then((rows) => { if (!cancelled) setExisting((rows && rows[0]) || null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [opportunity?.id]);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const fields = buildLeadSheetPrefill({ opportunity });
      const result = await createLeadSheetDraft({
        source: "opportunity",
        opportunity_id: opportunity.id,
        campaign_id: opportunity.campaign_id || "",
        company_id: opportunity.company_id || "",
        contact_id: opportunity.primary_contact_id || "",
        fields,
        prefilled_fields: prefilledFieldKeys(fields),
      });
      setExisting(result?.sheet || null);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Could not draft the lead sheet.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-2">
        <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Lead sheet</h2>
            {existing && <LeadSheetStatusBadge status={existing.status} />}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {existing
              ? "Drafted from this opportunity. Fill in what is missing, then submit it for the BDM to send."
              : "Cadence drafts the client-ready lead sheet from this opportunity — known answers filled, blanks left for the caller."}
          </p>
          {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
          <div className="mt-2">
            {existing ? (
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to={`/lead-sheets?id=${existing.id}`}>
                  Open lead sheet <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </Button>
            ) : (
              <Button size="sm" onClick={create} disabled={busy} className="rounded-full">
                {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
                Draft lead sheet
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}