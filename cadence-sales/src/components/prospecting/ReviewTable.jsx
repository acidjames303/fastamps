import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Users, RefreshCw } from "lucide-react";
import FitBadge from "./FitBadge";
import { freshnessLabel } from "@/lib/prospectReview";

// Company-centric prospect review table. Each row shows fit, research status,
// confidence, decision-makers, best number, source and estimated enrichment
// cost. Actions: approve, reject, needs review, find decision-makers, refresh.
export default function ReviewTable({ rows, targetList, selected, setSelected, onRefresh, onFindDms }) {
  const [busy, setBusy] = useState({});
  const [bulkBusy, setBulkBusy] = useState(false);

  const call = async (id, fn, patch) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await base44.entities.TargetListCompanyFit.update(id, patch);
      onRefresh?.();
    } catch {}
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  };

  const refreshResearch = async (row) => {
    setBusy((b) => ({ ...b, [row.company.id]: true }));
    try {
      await base44.functions.invoke("researchCompanies", { target_list_id: targetList.id });
      onRefresh?.();
    } catch {}
    finally { setBusy((b) => ({ ...b, [row.company.id]: false })); }
  };

  const bulk = async (status) => {
    const ids = rows.filter((r) => selected.has(r.company.id) && r.fit).map((r) => r.fit.id);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      await base44.entities.TargetListCompanyFit.bulkUpdate(ids.map((id) => ({ id, review_status: status, reviewed_at: new Date().toISOString() })));
      setSelected(new Set());
      onRefresh?.();
    } catch {}
    finally { setBulkBusy(false); }
  };

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  if (!rows.length) {
    return (
      <div className="rounded-3xl bg-white border border-slate-200 p-12 text-center">
        <p className="text-slate-500">No companies in this list yet. Add companies above to start researching.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5">
          <span className="text-xs text-slate-300">{selected.size} selected</span>
          <Button onClick={() => bulk("approved")} disabled={bulkBusy} size="sm" className="rounded-full ml-auto h-7 px-3 bg-emerald-600 hover:bg-emerald-500">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve
          </Button>
          <Button onClick={() => bulk("rejected")} disabled={bulkBusy} size="sm" variant="ghost" className="rounded-full h-7 px-3 text-slate-300 hover:bg-white/10">
            <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
          </Button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden lg:block rounded-3xl bg-white border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="w-8 px-3 py-2.5"><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.company.id)) : new Set())} checked={selected.size === rows.length && rows.length > 0} /></th>
              <th className="text-left px-2 py-2.5">Company</th>
              <th className="text-left px-2 py-2.5">Fit</th>
              <th className="text-left px-2 py-2.5">Research</th>
              <th className="text-left px-2 py-2.5">DMs</th>
              <th className="text-left px-2 py-2.5">Number</th>
              <th className="text-right px-2 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const fresh = freshnessLabel(row.intel);
              return (
                <tr key={row.company.id} className="hover:bg-slate-50/50">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.has(row.company.id)} onChange={() => toggle(row.company.id)} /></td>
                  <td className="px-2 py-3">
                    <p className="font-medium text-slate-900">{row.company.name}</p>
                    <p className="text-xs text-slate-400">{row.company.website || row.company.domain || "—"} · {row.company.industry || "—"} · {row.company.employee_range || "—"}</p>
                    {row.fit?.fit_reason && <p className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">{row.fit.fit_reason}</p>}
                  </td>
                  <td className="px-2 py-3"><FitBadge band={row.fit?.fit_band} score={row.fit?.fit_score} /></td>
                  <td className="px-2 py-3">
                    <p className={`text-xs font-medium ${fresh.tone === "bad" ? "text-rose-600" : fresh.tone === "warn" ? "text-amber-600" : fresh.tone === "ok" ? "text-emerald-600" : "text-slate-400"}`}>{fresh.label}</p>
                    <p className="text-xs text-slate-400">{row.confidence ? `${row.confidence}% conf` : ""}</p>
                  </td>
                  <td className="px-2 py-3 text-slate-600">{row.dmCount || "—"}</td>
                  <td className="px-2 py-3">
                    {row.bestNumber ? <span className="text-xs text-slate-700">{row.bestNumber}</span> : <span className="text-xs text-slate-400">—</span>}
                    {row.estEnrichCost > 0 && <p className="text-xs text-slate-400">~{row.estEnrichCost} credit{row.estEnrichCost === 1 ? "" : "s"}</p>}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button onClick={() => onFindDms?.(row)} size="icon" variant="ghost" className="h-7 w-7 text-slate-500" title="Find decision-makers"><Users className="w-3.5 h-3.5" /></Button>
                      <Button onClick={() => refreshResearch(row)} disabled={busy[row.company.id]} size="icon" variant="ghost" className="h-7 w-7 text-slate-500" title="Refresh research">{busy[row.company.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}</Button>
                      {row.fit && <Button onClick={() => call(row.fit.id, null, { review_status: "approved", reviewed_at: new Date().toISOString() })} disabled={busy[row.fit.id]} size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" title="Approve"><CheckCircle2 className="w-3.5 h-3.5" /></Button>}
                      {row.fit && <Button onClick={() => call(row.fit.id, null, { review_status: "rejected", reviewed_at: new Date().toISOString() })} disabled={busy[row.fit.id]} size="icon" variant="ghost" className="h-7 w-7 text-rose-500" title="Reject"><XCircle className="w-3.5 h-3.5" /></Button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {rows.map((row) => {
          const fresh = freshnessLabel(row.intel);
          return (
            <div key={row.company.id} className="rounded-2xl bg-white border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{row.company.name}</p>
                  <p className="text-xs text-slate-400 truncate">{row.company.industry || "—"} · {row.company.employee_range || "—"}</p>
                </div>
                <FitBadge band={row.fit?.fit_band} score={row.fit?.fit_score} />
              </div>
              {row.fit?.fit_reason && <p className="text-xs text-slate-500 mt-2">{row.fit.fit_reason}</p>}
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                <span className={fresh.tone === "bad" ? "text-rose-600" : fresh.tone === "warn" ? "text-amber-600" : fresh.tone === "ok" ? "text-emerald-600" : ""}>{fresh.label}</span>
                <span>· {row.dmCount || 0} DM{row.dmCount === 1 ? "" : "s"}</span>
                <span>· {row.bestNumber || "no number"}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-3">
                <Button onClick={() => onFindDms?.(row)} size="sm" variant="outline" className="rounded-full h-7 px-3 text-xs"><Users className="w-3.5 h-3.5 mr-1" /> DMs</Button>
                <Button onClick={() => refreshResearch(row)} disabled={busy[row.company.id]} size="sm" variant="outline" className="rounded-full h-7 px-3 text-xs">{busy[row.company.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}</Button>
                {row.fit && <Button onClick={() => call(row.fit.id, null, { review_status: "approved", reviewed_at: new Date().toISOString() })} disabled={busy[row.fit.id]} size="sm" className="rounded-full h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-500">Approve</Button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}