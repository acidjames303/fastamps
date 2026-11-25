import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Sparkles, Search, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { resolveCompanyIds } from "@/lib/company";
import { assignCompaniesToList } from "@/lib/targetLists";
import { useAuth } from "@/lib/AuthContext";

// Three prospect-input modes: manual company entry, spreadsheet import (link),
// and ICP-based discovery (bounded, deduplicated, never auto-approved).
export default function AddCompaniesPanel({ targetList, onAdded }) {
  const { user } = useAuth();
  const [names, setNames] = useState("");
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const addManual = async () => {
    const list = names.split("\n").map((n) => n.trim()).filter(Boolean);
    if (!list.length || !targetList) return;
    setAdding(true); setErr(""); setMsg("");
    try {
      const getCompanyId = await resolveCompanyIds(
        list.map((name) => ({ name, owner_user_id: user.id, organisation_id: user.organisation_id }))
      );
      const ids = list.map((n) => getCompanyId(n)).filter(Boolean);
      const res = await assignCompaniesToList(targetList.id, ids, user.organisation_id, user.id);
      setMsg(`${res.added} compan${res.added === 1 ? "y" : "ies"} added.`);
      setNames("");
      onAdded?.();
    } catch (e) { setErr(e.message || "Could not add companies."); }
    finally { setAdding(false); }
  };

  const discover = async () => {
    if (!targetList) return;
    setDiscovering(true); setErr(""); setMsg(""); setCandidates([]);
    try {
      const res = await base44.functions.invoke("discoverCompanies", { target_list_id: targetList.id, count: 12 });
      const data = res.data || res;
      setCandidates(data.candidates || []);
      setSelected(new Set());
      if (data.limited) setMsg(data.note || "Discovery limited — fewer candidates found.");
    } catch (e) { setErr(e.message || "Discovery failed."); }
    finally { setDiscovering(false); }
  };

  const addSelected = async () => {
    if (!selected.size) return;
    setAdding(true); setErr("");
    try {
      const picks = candidates.filter((c) => selected.has(c.domain || c.name));
      const getCompanyId = await resolveCompanyIds(
        picks.map((c) => ({
          name: c.name, domain: c.domain, website: c.website, industry: c.industry,
          location: c.location, employee_range: c.employee_range,
          owner_user_id: user.id, organisation_id: user.organisation_id,
        }))
      );
      const ids = picks.map((c) => getCompanyId(c.name, c.domain)).filter(Boolean);
      const res = await assignCompaniesToList(targetList.id, ids, user.organisation_id, user.id);
      setCandidates([]); setSelected(new Set());
      setMsg(`${res.added} candidate${res.added === 1 ? "" : "s"} added.`);
      onAdded?.();
    } catch (e) { setErr(e.message || "Could not add candidates."); }
    finally { setAdding(false); }
  };

  const toggle = (key) => {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelected(next);
  };

  return (
    <div className="rounded-3xl bg-white border border-slate-200 p-6 space-y-5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <Plus className="w-4 h-4 text-slate-400" /> Add companies
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500">Manual entry</label>
        <Textarea
          value={names}
          onChange={(e) => setNames(e.target.value)}
          placeholder={"One company name per line\nAcme Ltd\nGlobex UK"}
          className="rounded-xl border-slate-200 mt-1.5 min-h-20 text-sm"
          disabled={!targetList}
        />
        <Button onClick={addManual} disabled={!targetList || adding || !names.trim()} size="sm" className="rounded-full mt-2 bg-emerald-600 hover:bg-emerald-700">
          {adding ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
          Add to list
        </Button>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button onClick={discover} disabled={!targetList || discovering} variant="outline" size="sm" className="rounded-full border-slate-300">
          {discovering ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
          Discover from ICP
        </Button>
        <Link to={targetList ? `/import` : "/import"}>
          <Button variant="ghost" size="sm" className="rounded-full text-slate-500">
            <Upload className="w-3.5 h-3.5 mr-1.5" /> Spreadsheet
          </Button>
        </Link>
      </div>

      {candidates.length > 0 && (
        <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100">
          <div className="px-3 py-2 text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" /> {candidates.length} candidate{candidates.length === 1 ? "" : "s"} — select to research
          </div>
          {candidates.map((c) => {
            const key = c.domain || c.name;
            return (
              <label key={key} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                  <p className="text-xs text-slate-400 truncate">{c.website || c.domain} · {c.industry} · {c.employee_range}</p>
                  {c.why_fits && <p className="text-xs text-slate-500 mt-0.5">{c.why_fits}</p>}
                </div>
              </label>
            );
          })}
          <div className="px-3 py-2 flex justify-end">
            <Button onClick={addSelected} disabled={!selected.size || adding} size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-500">
              {adding ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Add {selected.size || ""}
            </Button>
          </div>
        </div>
      )}

      {msg && <p className="text-xs text-emerald-700">{msg}</p>}
      {err && <p className="text-xs text-rose-600">{err}</p>}
    </div>
  );
}