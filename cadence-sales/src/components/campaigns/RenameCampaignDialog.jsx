import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

// Rename a campaign in place — the new name flows to the list, the dialer and reports.
export default function RenameCampaignDialog({ campaign, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setName(campaign?.name || "");
    setErr("");
  }, [campaign?.id]);

  if (!campaign) return null;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr("");
    try {
      await base44.entities.Campaign.update(campaign.id, { name: trimmed });
      onSaved({ ...campaign, name: trimmed });
      onClose();
    } catch (e) {
      setErr(e.message || "Could not rename this campaign.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="font-semibold text-slate-900">Rename campaign</h3>
          <p className="text-xs text-slate-400 mt-1">The new name appears everywhere this campaign is shown.</p>
        </div>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          placeholder="Campaign name"
          className="rounded-xl"
        />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" className="rounded-full" onClick={onClose}>Cancel</Button>
          <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700" disabled={busy || !name.trim()} onClick={save}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}