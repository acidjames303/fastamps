import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Split } from "lucide-react";
import SplitCampaignData from "@/components/campaigns/SplitCampaignData";

// Campaign setup step 4 — open the same Split data experience used on Campaigns.
export default function StepAssign({ campaignId, onAssigned }) {
  const [callers, setCallers] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [profiles, camp] = await Promise.all([
          base44.entities.UserProfile.filter({}, "-created_date", 80).catch(() => []),
          campaignId ? base44.entities.Campaign.get(campaignId).catch(() => null) : null,
        ]);
        const active = (profiles || []).filter((p) =>
          p.status === "active"
          && ["bdm", "internal_bd", "sales_manager", "organisation_admin"].includes(p.app_role),
        );
        setCallers(active);
        setCampaign(camp || { id: campaignId, name: "Campaign" });
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold text-slate-900">Split data across the team</h3>
        <p className="mt-1 text-sm text-slate-500">
          Share accounts evenly, by UK territory, by industry, or describe the split in plain English.
        </p>
      </div>

      <Button onClick={() => setOpen(true)} disabled={!callers.length} className="w-full rounded-full bg-emerald-600 hover:bg-emerald-500">
        <Split className="mr-2 h-4 w-4" />
        Open split data
      </Button>

      {!callers.length && (
        <p className="text-sm text-slate-400">No active callers found. Invite team members first.</p>
      )}

      {lastResult && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Split applied — {lastResult.created || 0} new, {lastResult.updated || 0} moved.
        </p>
      )}

      <SplitCampaignData
        campaign={campaign}
        callers={callers}
        open={open}
        onClose={() => setOpen(false)}
        onDone={(data) => {
          setLastResult(data);
          onAssigned?.(data);
        }}
      />
    </div>
  );
}
