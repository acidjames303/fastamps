import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Phone, Target, Upload, Users } from "lucide-react";
import { campaignNextAction } from "@/lib/campaignNextAction";

const ICONS = {
  add_companies: Upload,
  find_contacts: Target,
  activate: Users,
  start_calling: Phone,
  waiting_companies: Target,
  waiting_contacts: Users,
};

// One recommended next step for a campaign card — secondary actions stay available nearby.
export default function CampaignNextStep({
  campaign,
  companies = 0,
  contacts = 0,
  canProspect = false,
  isManager = false,
  onActivate,
  activating = false,
}) {
  const navigate = useNavigate();
  const next = campaignNextAction({
    companies,
    contacts,
    status: campaign?.status,
    canProspect,
    isManager,
    campaignId: campaign?.id || "",
  });
  const Icon = ICONS[next.id] || ArrowRight;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
      <div className="min-w-0 flex items-start gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white text-emerald-700 border border-emerald-100">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Recommended next</p>
          <p className="text-sm font-semibold text-slate-900">{next.label}</p>
          <p className="text-xs text-slate-600">{next.detail}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {next.action === "activate" ? (
          <Button
            size="sm"
            disabled={activating}
            onClick={() => onActivate?.(campaign)}
            className="rounded-full bg-emerald-600 hover:bg-emerald-500"
          >
            {activating ? "Activating…" : next.label}
          </Button>
        ) : next.href ? (
          <Button
            size="sm"
            onClick={() => navigate(next.href)}
            className="rounded-full bg-emerald-600 hover:bg-emerald-500"
          >
            {next.label} <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        ) : null}
        {next.secondaryHref && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(next.secondaryHref)}
            className="rounded-full border-emerald-300 bg-white"
          >
            {next.secondaryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
