import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ArrowRight, RefreshCw } from "lucide-react";

const REVIEW_LABELS = {
  not_submitted: "Not submitted", awaiting_review: "Awaiting review",
  approved: "Approved", changes_requested: "Changes requested", rejected: "Rejected",
};

export default function ReviewQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [opps, setOpps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Opportunity.filter(
        { manager_review_status: "awaiting_review" }, "-updated_date", 50,
      );
      setOpps(list || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const doAction = async (oppId, action) => {
    setActing(oppId);
    try {
      await base44.functions.invoke("manageOpportunityReview", {
        opportunity_id: oppId, action,
      });
      await load();
    } catch {} finally { setActing(null); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Review Queue</h1>
          <p className="text-sm text-slate-500">{opps.length} opportunit{opps.length === 1 ? "y" : "ies"} awaiting review</p>
        </div>
        <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {opps.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
          <p className="text-slate-500">No opportunities awaiting review. You're all caught up.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {opps.map((opp) => (
            <div key={opp.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <button onClick={() => navigate(`/opportunities/${opp.id}`)} className="text-left">
                    <h3 className="text-sm font-semibold text-slate-900 hover:underline">{opp.name}</h3>
                  </button>
                  <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                    <div>Need: {opp.need_summary || "—"}</div>
                    <div>Next step: {opp.next_step || "—"}</div>
                    <div>Timing: {opp.timing || "—"} · Authority: {opp.authority_status || "unknown"}</div>
                    <div>Est. value: £{opp.estimated_value || 0}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" onClick={() => doAction(opp.id, "approve")} disabled={acting === opp.id} className="bg-emerald-600 hover:bg-emerald-700 h-8 px-3">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => doAction(opp.id, "request_changes")} disabled={acting === opp.id} className="h-8 px-3">
                    Changes
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => doAction(opp.id, "reject")} disabled={acting === opp.id} className="h-8 px-3 text-rose-600">
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/opportunities/${opp.id}`)} className="h-8 px-2">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {acting === opp.id && <div className="mt-2 text-xs text-slate-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Processing...</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}