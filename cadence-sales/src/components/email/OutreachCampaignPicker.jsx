import React from "react";
import { FolderOpen } from "lucide-react";

export default function OutreachCampaignPicker({ campaigns, value, onChange, disabled = false, onManage }) {
  const selected = campaigns.find((campaign) => campaign.id === value) || null;

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-slate-600">
        Outreach campaign
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
        >
          <option value="">Choose a campaign…</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name || "Untitled campaign"}
            </option>
          ))}
        </select>
      </label>

      {selected ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-900 space-y-1">
          <p className="font-medium">{selected.name}</p>
          {!!selected.client_name && <p>Client: {selected.client_name}</p>}
          {!!selected.objective && <p className="line-clamp-2">{selected.objective}</p>}
          <p className="text-emerald-700">
            Contacts, research and drafts in this studio all stay inside this campaign.
          </p>
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Pick the campaign first — its brief grounds every draft, and its research list is reused for every contact.
        </p>
      )}

      {!!onManage && (
        <button
          type="button"
          onClick={onManage}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
        >
          <FolderOpen className="w-3.5 h-3.5" /> Manage campaigns
        </button>
      )}
    </div>
  );
}