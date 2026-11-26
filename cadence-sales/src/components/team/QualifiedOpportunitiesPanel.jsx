import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ClipboardCopy, FileText, Loader2 } from "lucide-react";
import { buildLeadSheetSummary } from "@/lib/leadSheetSummary";

/**
 * Qualified opportunities waiting for manager review — lives in Admin Inbox
 * so IRs and lead handovers share one management surface.
 */
export default function QualifiedOpportunitiesPanel({ limit }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [acting, setActing] = useState("");

  const load = async () => {
    setError("");
    try {
      const list = await base44.entities.Opportunity.filter(
        { manager_review_status: "awaiting_review" },
        "-updated_date",
        50,
      );
      setItems(list || []);
    } catch (e) {
      setError(e.message || "Could not load opportunities.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copySummary = async (opp) => {
    setActing(opp.id);
    setError("");
    try {
      const [contact, company] = await Promise.all([
        opp.primary_contact_id
          ? base44.entities.Contact.get(opp.primary_contact_id).catch(() => null)
          : Promise.resolve(null),
        opp.company_id
          ? base44.entities.Company.get(opp.company_id).catch(() => null)
          : Promise.resolve(null),
      ]);
      const text = buildLeadSheetSummary({ opportunity: opp, contact, company });
      await navigator.clipboard.writeText(text);
      setCopiedId(opp.id);
      setTimeout(() => setCopiedId(""), 2500);
    } catch (e) {
      setError(e.message || "Could not copy the lead summary.");
    } finally {
      setActing("");
    }
  };

  const shown = typeof limit === "number" ? items.slice(0, limit) : items;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Qualified opportunities
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Prefill a client lead summary from what Cadence already holds, then review and approve. Nothing auto-sends.
          </p>
        </div>
        {typeof limit === "number" && items.length > limit && (
          <Link to="/manager-inbox?tab=leads" className="text-sm text-emerald-700 hover:underline shrink-0">
            View all ({items.length})
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-slate-400 p-6">
          No opportunities awaiting review. When a caller logs Qualified, it appears here with the fields they already captured.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {shown.map((opp) => (
            <div key={opp.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1 min-w-0">
                <Link to={`/opportunities/${opp.id}`} className="font-medium text-slate-900 hover:underline">
                  {opp.name || "Opportunity"}
                </Link>
                <p className="text-xs text-slate-500 mt-1">
                  Need: {opp.need_summary || "—"}
                  {opp.next_step ? ` · Next: ${opp.next_step}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={acting === opp.id}
                  onClick={() => copySummary(opp)}
                >
                  {acting === opp.id ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : copiedId === opp.id ? (
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  ) : (
                    <ClipboardCopy className="w-3.5 h-3.5 mr-1" />
                  )}
                  {copiedId === opp.id ? "Copied" : "Copy lead summary"}
                </Button>
                <Button type="button" size="sm" className="rounded-full" asChild>
                  <Link to={`/opportunities/${opp.id}`}>Review</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-rose-600 px-5 pb-4">{error}</p>}
    </div>
  );
}
