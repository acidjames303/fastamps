import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FileDown, FileText, FolderOpen, AlertCircle } from "lucide-react";
import LeadSheetRow from "@/components/leadsheet/LeadSheetRow";
import { LEAD_SHEET_STATUSES, LEAD_SHEET_STATUS_KEYS } from "@/lib/leadSheet";
import { downloadLeadSheets, listLeadSheets } from "@/lib/leadSheetApi";

// The lead sheets folder. Reused on the Lead sheets page, in the admin inbox
// and inside reporting — one list, one set of filters, one bulk download.
export default function LeadSheetFolder({
  scope = "mine",
  campaignId = "",
  from = "",
  to = "",
  compact = false,
  scroll = false,
  showDateFilter = false,
  title,
  onOpen,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dateFrom, setDateFrom] = useState(from);
  const [dateTo, setDateTo] = useState(to);

  useEffect(() => { setDateFrom(from); }, [from]);
  useEffect(() => { setDateTo(to); }, [to]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listLeadSheets({
        scope,
        status: status || undefined,
        campaign_id: campaignId || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        missing_only: missingOnly,
      });
      const rows = data.items || [];
      setItems(rows);
      setSelected((prev) => prev.filter((id) => rows.some((row) => row.id === id)));
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Could not load lead sheets.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [scope, status, campaignId, dateFrom, dateTo, missingOnly]);

  const download = async (kinds) => {
    const chosen = items.filter((item) => selected.includes(item.id));
    if (!chosen.length) {
      setError("Select at least one lead sheet first.");
      return;
    }
    setBusy(kinds.join("-"));
    setError("");
    setMessage("");
    try {
      await downloadLeadSheets(chosen, kinds);
      setMessage(`Downloaded ${chosen.length} lead sheet${chosen.length === 1 ? "" : "s"} as ${kinds.map((k) => k.toUpperCase()).join(" and ")}.`);
      load();
    } catch (e) {
      setError(e?.message || "Could not build the document.");
    } finally {
      setBusy("");
    }
  };

  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">
            {title || (scope === "review" ? "Lead sheets for review" : "My lead sheets")}
          </h3>
          <span className="text-xs text-slate-400">{items.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMissingOnly((value) => !value)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              missingOnly ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500"
            }`}
          >
            Missing only
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => download(["pdf"])}
            disabled={!!busy || !selected.length}
            className="rounded-full h-8 text-xs"
          >
            {busy === "pdf" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1" />}
            PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => download(["docx"])}
            disabled={!!busy || !selected.length}
            className="rounded-full h-8 text-xs"
          >
            {busy === "docx" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
            Word
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setStatus("")}
          className={`rounded-full border px-2.5 py-1 text-[11px] ${!status ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500"}`}
        >
          All
        </button>
        {LEAD_SHEET_STATUS_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${status === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500"}`}
          >
            {LEAD_SHEET_STATUSES[key].label}
          </button>
        ))}
      </div>

      {showDateFilter && (
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-40 rounded-full border-slate-200 text-xs" />
          <span className="text-xs text-slate-400">to</span>
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-40 rounded-full border-slate-200 text-xs" />
          {(dateFrom || dateTo) && (
            <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-slate-400 hover:text-slate-600">
              Clear dates
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}
      {message && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{message}</p>}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-slate-300 animate-spin" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center">
          {scope === "review"
            ? "No lead sheets waiting for review. Drafts appear here once a caller submits one."
            : "No lead sheets yet. One is drafted automatically after a lead or meeting outcome on a call."}
        </p>
      ) : (
        <div className={`${compact ? "space-y-1.5" : "space-y-2"} ${scroll ? "max-h-[calc(100vh-24rem)] overflow-y-auto pr-1" : ""}`}>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? [] : items.map((item) => item.id))}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              Select all
            </label>
            {selected.length > 0 && (
              <button type="button" onClick={() => setSelected([])} className="hover:text-slate-600">
                Clear {selected.length} selected
              </button>
            )}
          </div>
          {items.map((sheet) => (
            <LeadSheetRow
              key={sheet.id}
              sheet={sheet}
              selected={selected.includes(sheet.id)}
              onToggle={() => setSelected((prev) => (prev.includes(sheet.id) ? prev.filter((id) => id !== sheet.id) : [...prev, sheet.id]))}
              onOpen={() => onOpen?.(sheet.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}