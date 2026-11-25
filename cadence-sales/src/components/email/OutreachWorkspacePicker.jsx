import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";

// Choose a workspace, or type a new name to create one — all from one control.
export default function OutreachWorkspacePicker({ options = [], value, onChange, onCreate }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef(null);
  const current = options.find((o) => o.key === value);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const escape = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  const q = query.trim();
  const matches = useMemo(
    () => options.filter((o) => !q || o.title.toLowerCase().includes(q.toLowerCase())),
    [options, q]
  );
  const exists = options.some((o) => o.title.toLowerCase() === q.toLowerCase());

  const create = async () => {
    if (!q || exists) return;
    setBusy(true);
    setError("");
    try {
      await onCreate(q);
      setOpen(false);
      setQuery("");
    } catch (e) {
      setError(e.message || "Could not create that workspace.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setError(""); }}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-[11px] uppercase tracking-wide text-slate-400">Workspace</span>
        <span className="max-w-[10rem] truncate font-medium text-slate-900">{current?.title || "Choose"}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-lg lg:left-auto lg:right-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setError(""); }}
              placeholder="Search or type a new name…"
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div className="mt-2 max-h-64 overflow-y-auto" role="listbox">
            {matches.map((o) => (
              <button
                key={o.key}
                type="button"
                role="option"
                aria-selected={o.key === value}
                onClick={() => { onChange(o.key); setOpen(false); setQuery(""); }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <Check className={`h-4 w-4 ${o.key === value ? "text-emerald-600" : "text-transparent"}`} />
                <span className="truncate text-slate-800">{o.title}</span>
              </button>
            ))}
            {matches.length === 0 && !q && <p className="px-3 py-2 text-xs text-slate-400">No workspaces yet.</p>}
          </div>

          {!!q && !exists && (
            <button
              type="button"
              disabled={busy}
              onClick={create}
              className="mt-1 flex w-full items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-medium text-emerald-800 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {busy ? "Creating…" : `Create “${q}”`}
            </button>
          )}
          {!!q && exists && (
            <p className="mt-1 px-3 py-1 text-[11px] text-slate-400">That workspace already exists — pick it above.</p>
          )}
          {error && <p role="alert" className="mt-1 px-3 text-xs text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}