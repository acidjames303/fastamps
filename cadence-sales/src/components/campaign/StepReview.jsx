import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertCircle, Building2, Users, Phone, FileText } from "lucide-react";

export default function StepReview({ campaignId, form, onActivate, activating }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [assignments, campaign] = await Promise.all([
          base44.entities.CampaignAssignment.filter({ campaign_id: campaignId }, "-created_date", 500),
          base44.entities.Campaign.get(campaignId),
        ]);
        const companyIds = [...new Set((assignments || []).map((a) => a.company_id))];
        const assigned = (assignments || []).filter((a) => a.assigned_user_id);
        const unassigned = (assignments || []).filter((a) => !a.assigned_user_id);

        let dialableContacts = 0;
        let noContacts = 0;
        for (const cid of companyIds) {
          const contacts = await base44.entities.Contact.filter({ company_id: cid }, "-created_date", 10).catch(() => []);
          if (contacts.length === 0) { noContacts++; continue; }
          if (contacts.some((c) => c.phone && c.number_status !== "dnc" && c.number_status !== "bad")) dialableContacts++;
        }

        setSummary({
          totalCompanies: companyIds.length,
          assignedCount: assigned.length,
          unassignedCount: unassigned.length,
          assignedUsers: [...new Set(assigned.map((a) => a.assigned_user_id))],
          dialableContacts,
          noContacts,
          campaign,
        });
      } catch {} finally { setLoading(false); }
    })();
  }, [campaignId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>;

  const stats = [
    { icon: Building2, label: "Companies", value: summary?.totalCompanies || 0 },
    { icon: Phone, label: "Dialable", value: summary?.dialableContacts || 0, tone: "emerald" },
    { icon: Users, label: "Assigned callers", value: summary?.assignedUsers?.length || 0 },
    { icon: AlertCircle, label: "No contacts", value: summary?.noContacts || 0, tone: "amber" },
  ];

  const canActivate = summary?.totalCompanies > 0 && summary?.assignedUsers?.length > 0 && summary?.dialableContacts > 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 p-4">
            <s.icon className={`w-4 h-4 mb-2 ${s.tone === "emerald" ? "text-emerald-500" : s.tone === "amber" ? "text-amber-500" : "text-slate-400"}`} />
            <div className="text-2xl font-semibold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="w-4 h-4 text-slate-400" />
          <span className="font-medium text-slate-900">{form.name || summary?.campaign?.name}</span>
        </div>
        <div className="text-xs text-slate-500 space-y-0.5">
          <div>Client: {form.client_name || summary?.campaign?.client_name || "—"}</div>
          <div>Dates: {form.start_date || summary?.campaign?.start_date || "—"} → {form.end_date || summary?.campaign?.end_date || "—"}</div>
          <div>Unassigned companies: {summary?.unassignedCount || 0}</div>
        </div>
      </div>

      {!canActivate && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 inline mr-1" />
          Cannot activate: {summary?.totalCompanies === 0 ? "no companies added" : summary?.assignedUsers?.length === 0 ? "no callers assigned" : "no dialable contacts found"}.
        </div>
      )}

      <Button onClick={onActivate} disabled={!canActivate || activating} className="w-full">
        {activating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
        Activate campaign
      </Button>
    </div>
  );
}