import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Phone, ShieldCheck, UserCheck } from "lucide-react";

// Dialog for one company: find decision-makers, select contacts, approve paid
// enrichment (explicit), and add approved contacts to the Target List queue.
export default function DecisionMakerDialog({ targetList, company, onClose, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [enriching, setEnriching] = useState(false);
  const [approving, setApproving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const find = async () => {
    setLoading(true); setErr(""); setMsg("");
    try {
      const res = await base44.functions.invoke("findDecisionMakers", { target_list_id: targetList.id, company_id: company.id });
      const data = res.data || res;
      setContacts(data.contacts || []);
      setSelected(new Set((data.contacts || []).map((c) => c.id)));
      if (!data.found) setMsg("No decision-makers found.");
    } catch (e) { setErr(e.message || "Search failed."); }
    finally { setLoading(false); }
  };

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const enrich = async () => {
    setEnriching(true); setErr(""); setMsg("");
    let ok = 0, fail = 0;
    for (const c of contacts.filter((ct) => selected.has(ct.id))) {
      try {
        const res = await base44.functions.invoke("enrichContact", {
          target_list_id: targetList.id, contact_id: c.id, approved: true,
        });
        const d = res.data || res;
        if (d.enriched || d.skipped) ok++;
        else fail++;
      } catch { fail++; }
    }
    setEnriching(false);
    setMsg(`${ok} enriched, ${fail} not found.`);
    onChanged?.();
  };

  const approve = async (contactId) => {
    setApproving(true); setErr("");
    try {
      const res = await base44.functions.invoke("approveProspect", {
        target_list_id: targetList.id, company_id: company.id, contact_id: contactId,
      });
      const d = res.data || res;
      setMsg(d.added ? "Added to calling queue." : "Already in queue.");
      onChanged?.();
    } catch (e) { setErr(e.message || "Approval failed."); }
    finally { setApproving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Decision-makers</p>
            <h3 className="font-display text-lg font-semibold text-slate-900">{company.name}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm">Close</button>
        </div>

        <Button onClick={find} disabled={loading} variant="outline" size="sm" className="rounded-full mt-4 border-slate-300">
          {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Users className="w-3.5 h-3.5 mr-1.5" />}
          {contacts.length ? "Search again" : "Find decision-makers"}
        </Button>

        {contacts.length > 0 && (
          <div className="mt-4 divide-y divide-slate-100 border border-slate-200 rounded-2xl">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{c.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">{c.job_title || "—"} · {c.provider}</p>
                </div>
                <Button onClick={() => approve(c.id)} disabled={approving} size="sm" variant="ghost" className="rounded-full h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-50">
                  <UserCheck className="w-3.5 h-3.5 mr-1" /> Add to queue
                </Button>
              </div>
            ))}
            <div className="px-3 py-2 flex items-center justify-between bg-slate-50 rounded-b-2xl">
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Paid reveal — {selected.size} selected
              </p>
              <Button onClick={enrich} disabled={!selected.size || enriching} size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                {enriching ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Phone className="w-3.5 h-3.5 mr-1.5" />}
                Approve enrichment
              </Button>
            </div>
          </div>
        )}

        {msg && <p className="text-xs text-emerald-700 mt-3">{msg}</p>}
        {err && <p className="text-xs text-rose-600 mt-3">{err}</p>}
      </div>
    </div>
  );
}