import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, Search, Loader2, Building2 } from "lucide-react";

export default function StepCompanies({ campaignId, onCountChange }) {
  const [assignments, setAssignments] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAssignments = async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const list = await base44.entities.CampaignAssignment.filter({ campaign_id: campaignId }, "-created_date", 200);
      const enriched = await Promise.all((list || []).map(async (a) => {
        const company = await base44.entities.Company.get(a.company_id).catch(() => null);
        return { ...a, company_name: company?.name || "Unknown", company_domain: company?.domain || "" };
      }));
      setAssignments(enriched);
      onCountChange?.(enriched.length);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadAssignments(); }, [campaignId]);

  const search = async () => {
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const all = await base44.entities.Company.filter({}, "-created_date", 100);
      const filtered = (all || []).filter((c) =>
        (c.name || "").toLowerCase().includes(query.toLowerCase()) ||
        (c.domain || "").toLowerCase().includes(query.toLowerCase())
      );
      const existingIds = new Set(assignments.map((a) => a.company_id));
      setResults(filtered.filter((c) => !existingIds.has(c.id)).slice(0, 20));
    } catch {} finally { setSearching(false); }
  };

  const addCompany = async (company) => {
    try {
      await base44.entities.CampaignAssignment.create({
        campaign_id: campaignId,
        company_id: company.id,
        organisation_id: company.organisation_id,
        status: "unassigned",
        assignment_method: "manual",
        assigned_at: new Date().toISOString(),
        priority: "normal",
        lock_version: 1,
      });
      setResults((r) => r.filter((c) => c.id !== company.id));
      await loadAssignments();
    } catch {}
  };

  const removeCompany = async (assignmentId) => {
    try {
      await base44.entities.CampaignAssignment.delete(assignmentId);
      await loadAssignments();
    } catch {}
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Search companies by name or domain..." />
        </div>
        <Button variant="outline" onClick={search} disabled={searching}>
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Search results — click to add</p>
          {results.map((c) => (
            <button key={c.id} onClick={() => addCompany(c)} className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition text-left">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-900">{c.name}</span>
                {c.domain && <span className="text-xs text-slate-400">{c.domain}</span>}
              </div>
              <Plus className="w-4 h-4 text-slate-400" />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-slate-500">{assignments.length} compan{assignments.length === 1 ? "y" : "ies"} added</p>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No companies added yet — search above to add target companies.</p>
        ) : (
          assignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-900">{a.company_name}</span>
                {a.company_domain && <span className="text-xs text-slate-400">{a.company_domain}</span>}
                {a.status === "assigned" && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Assigned</span>}
              </div>
              <button onClick={() => removeCompany(a.id)} className="text-slate-400 hover:text-rose-500 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}