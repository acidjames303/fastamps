import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, X, Search, Loader2, Sparkles, Info } from "lucide-react";

// companies is an array of objects: { name, domain, website, industry, employee_range, location }
// Manual entry and CSV upload produce { name } only; Google discovery populates full firmographics.
export default function CompanyInput({ companies, setCompanies, onDiscover, discovering, discoverErr, discoveredCount, listId }) {
  const fileRef = useRef(null);
  const [importWarning, setImportWarning] = useState("");

  const looksMerged = (name) => /(?:Group|Foods|Engineering|Partners|Limited|Ltd)[A-Z][a-z]/.test(name) || name.length > 120;
  const parseDelimitedRow = (row, separator) => {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < row.length; i += 1) {
      const ch = row[i];
      if (ch === '"' && quoted && row[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === separator && !quoted) { cells.push(cell.trim()); cell = ""; }
      else cell += ch;
    }
    cells.push(cell.trim());
    return cells;
  };

  // Merge incoming names with existing objects — preserves discovered data for
  // names that haven't changed, adds plain { name } for new entries.
  const mergeNames = (rawNames) => {
    const invalid = rawNames.filter((name) => name && looksMerged(name));
    const names = rawNames.filter((name) => name && !looksMerged(name));
    setImportWarning(invalid.length ? `${invalid.length} row${invalid.length === 1 ? "" : "s"} look like merged company names and were held back for review. No existing prospects were changed.` : "");
    const byName = new Map(companies.map((c) => [(c.name || "").toLowerCase(), c]));
    const result = [];
    const seen = new Set();
    for (const name of names) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(byName.get(key) || { name });
    }
    setCompanies(result);
  };

  const onText = (e) => {
    mergeNames(e.target.value.split(/\r?\n/).map((s) => s.trim()));
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const sep = lines[0]?.includes(",") ? "," : lines[0]?.includes("\t") ? "\t" : ",";
      const header = (lines[0] || "").toLowerCase();
      let names;
      if (/company|account|name/.test(header)) {
        const cols = parseDelimitedRow(lines[0], sep);
        const idx = cols.findIndex((c) => /company|account/.test(c.toLowerCase()));
        names = lines.slice(1).map((l) => (parseDelimitedRow(l, sep)[idx >= 0 ? idx : 0] || "").trim()).filter(Boolean);
      } else {
        names = lines.map((l) => parseDelimitedRow(l, sep)[0].trim()).filter(Boolean);
      }
      mergeNames(names);
    };
    reader.readAsText(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const nameList = companies.map((c) => c.name).join("\n");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-slate-400">Companies</p>
        {companies.length > 0 && (
          <button onClick={() => setCompanies([])} className="text-xs text-slate-400 hover:text-rose-600 inline-flex items-center gap-1">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Primary discovery action — works before and after list creation */}
      <Button
        onClick={onDiscover}
        disabled={discovering}
        className="rounded-full bg-emerald-600 hover:bg-emerald-500 w-full h-11"
      >
        {discovering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
        {discovering ? "Searching Google…" : "Discover companies via Google"}
      </Button>

      {/* Disclaimer about connecting a data provider for better results */}
      <div className="flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-200 p-2.5">
        <Info className="w-3.5 h-3.5 text-sky-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-sky-700 leading-snug">
          Google discovery finds real company names and websites. To enrich with direct phone numbers and decision-maker contacts,{" "}
          <Link to="/integration-settings" className="font-semibold underline underline-offset-2 hover:text-sky-800">connect a data provider</Link>.
        </p>
      </div>

      {discoveredCount > 0 && !discovering && (
        <p className="text-sm text-emerald-700 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" /> Found {discoveredCount} real compan{discoveredCount === 1 ? "y" : "ies"} via Google search.
        </p>
      )}
      {discoverErr && <p className="text-sm text-rose-600">{discoverErr}</p>}
      {importWarning && <p className="text-sm text-amber-700 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">{importWarning}</p>}

      {/* Manual entry — always available so you can type/paste a list right away */}
      <Textarea
        value={nameList}
        onChange={onText}
        placeholder={"Type or paste company names — one per line\nAcme Ltd\nGlobex Corp\nInitech"}
        className="rounded-2xl bg-white border-slate-200 min-h-32 font-mono text-sm"
      />
      {listId && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFile} className="hidden" />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="rounded-full border-slate-300 text-slate-700">
            <Upload className="w-4 h-4 mr-2" /> Upload CSV
          </Button>
        </div>
      )}
      {companies.length > 0 && (
        <p className="text-sm text-slate-500">{companies.length} compan{companies.length === 1 ? "y" : "ies"} ready to enrich.</p>
      )}
    </div>
  );
}