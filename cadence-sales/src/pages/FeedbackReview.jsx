import React, { useEffect, useState, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AREA_LABELS = {
  core_calling: "Core Calling", callbacks: "Callbacks", notes_history: "Notes & History",
  campaigns: "Campaigns", results_reporting: "Results & Reporting", meetings_handoff: "Meetings & Handoff",
  team_management: "Team Management", onboarding: "Onboarding", compliance: "Compliance",
  billing: "Billing", performance: "Performance", other: "Other",
};
const STATUS_LABELS = {
  new: "New", reviewing: "Reviewing", planned: "Planned", not_planned: "Not Planned", delivered: "Delivered", duplicate: "Duplicate",
};

// Platform-owner feedback review. Uses manageFeedback backend function for all
// reads and updates — no direct entity access (RLS blocks ordinary users).
export default function FeedbackReview() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterArea, setFilterArea] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("manageFeedback", { action: "list" });
      setFeedback(res.data.feedback || []);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const filtered = filterArea === "all" ? feedback : feedback.filter(f => f.product_area === filterArea);
    const groups = {};
    filtered.forEach(f => {
      const area = f.product_area || 'other';
      if (!groups[area]) groups[area] = [];
      groups[area].push(f);
    });
    return groups;
  }, [feedback, filterArea]);

  const updateStatus = async (id, newStatus) => {
    try {
      await base44.functions.invoke("manageFeedback", { action: "review", feedback_id: id, status: newStatus });
      setFeedback(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f));
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <MessageSquare className="w-7 h-7 text-slate-700" /> Feedback Review
          </h1>
          <p className="text-slate-500 mt-1">Review and prioritise product feedback from pilot users.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All areas</SelectItem>
              {Object.entries(AREA_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={load} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading feedback…</p>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No feedback submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([area, items]) => (
            <div key={area} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                <h2 className="font-display font-semibold text-slate-900 text-sm">{AREA_LABELS[area] || area}</h2>
                <Badge variant="outline" className="text-xs">{items.length}</Badge>
              </div>
              <div className="divide-y divide-slate-50">
                {items.map(f => (
                  <div key={f.id} className="px-5 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm">{f.title}</p>
                      {f.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{f.description}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{f.feedback_type}</Badge>
                        <span className="text-xs text-slate-400">{f.impact}</span>
                      </div>
                    </div>
                    <Select value={f.status} onValueChange={(v) => updateStatus(f.id, v)}>
                      <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}