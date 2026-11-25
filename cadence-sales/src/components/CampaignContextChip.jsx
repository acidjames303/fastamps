import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, X } from "lucide-react";
import { clearActiveCampaign, getActiveCampaign } from "@/lib/campaignContext";

/**
 * Shows the sticky campaign focus in the header.
 * Click opens Campaigns; clear returns to no-context mode.
 */
export default function CampaignContextChip() {
  const [campaign, setCampaign] = useState(() => getActiveCampaign());

  useEffect(() => {
    const sync = () => setCampaign(getActiveCampaign());
    const onCustom = (e) => setCampaign(e.detail || null);
    window.addEventListener("storage", sync);
    window.addEventListener("cadence:campaign-context", onCustom);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("cadence:campaign-context", onCustom);
    };
  }, []);

  if (!campaign?.id) return null;

  return (
    <div className="hidden sm:flex items-center gap-1 max-w-[220px] rounded-full border border-emerald-200 bg-emerald-50 pl-2.5 pr-1 py-1 text-xs text-emerald-900">
      <ClipboardList className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
      <Link
        to={`/dialer?list=${campaign.id}`}
        className="truncate font-medium hover:underline"
        title={`Continue on ${campaign.name}`}
      >
        {campaign.name}
      </Link>
      <button
        type="button"
        aria-label="Clear campaign context"
        className="p-1 rounded-full hover:bg-emerald-100 text-emerald-700"
        onClick={() => {
          clearActiveCampaign();
          setCampaign(null);
        }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
