import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleAlert, FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { readSpreadsheet, toAccounts, inferColumnMapping, accountsFromSheets, mergeAccountLists } from "@/lib/spreadsheetAccounts";
import { classifyIncomingAccounts, gapCounts } from "@/lib/importPreview";

const ACCEPTED = ["csv", "xlsx", "xls", "json"];
const MAX_BYTES = 10 * 1024 * 1024;

const ext = (name) => (String(name).split(".").pop() || "").toLowerCase();

// Reads a company list, shows what Cadence inferred and what is missing, and
// puts any duplicate or ambiguous company in front of a person before a single
// record is written. Existing records are never changed by an import.
export default function SpreadsheetImportPreview({ listId, existingProspects = [], onListCreated, onImported, onImportedRows }) {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [includeAmbiguous, setIncludeAmbiguous] = useState([]);
  const [summary, setSummary] = useState(null);

  const reset = () => {
    setPreview(null);
    setSummary(null);
    setError("");
    setIncludeAmbiguous([]);
  };

  const parseFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => {
      const type = ext(file.name);
      if (!ACCEPTED.includes(type)) {
        setError(`${file.name} — use CSV, Excel or JSON for a company list.`);
        return false;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} — that file is over the 10MB limit.`);
        return false;
      }
      return true;
    });
    if (!files.length) return;

    setParsing(true);
    setError("");
    setSummary(null);
    try {
      const perFile = [];
      const headers = new Set();
      let sheetsRead = 0;
      const sheetStats = [];
      for (const file of files) {
        const sheets = await readSpreadsheet(file);
        const merged = accountsFromSheets(sheets);
        sheetsRead += merged.sheetsRead || sheets.length;
        if (Array.isArray(merged.sheetStats)) {
          sheetStats.push(...merged.sheetStats.map((stat) => ({ ...stat, file: file.name })));
        }
        perFile.push(merged.accounts.map((account) => ({ ...account, __file: file.name })));
        (merged.headers || []).forEach((header) => headers.add(header));
      }
      const accounts = mergeAccountLists(perFile);
      if (!accounts.length) {
        throw new Error("No company rows could be read from that file. Check the company column and try again.");
      }

      const { fresh, duplicates, ambiguous } = classifyIncomingAccounts({ accounts, existingProspects });

      setPreview({
        fileName: files.map((file) => file.name).join(", "),
        accounts,
        fresh,
        duplicates,
        ambiguous,
        mapping: inferColumnMapping([...headers]),
        gaps: gapCounts(accounts),
        sheetsRead,
        filesRead: files.length,
        sheetStats,
      });
      setIncludeAmbiguous([]);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not read that file.");
    } finally {
      setParsing(false);
    }
  };

  const commit = async () => {
    if (!preview || importing) return;
    setImporting(true);
    setError("");
    try {
      let targetListId = listId;
      if (!targetListId) {
        const created = await base44.entities.ProspectList.create({
          name: String(preview.fileName).replace(/\.[^.]+$/, "").slice(0, 60),
          brief: `Accounts imported from ${preview.fileName}`,
          status: "ready",
          company_count: 0,
          permitted_countries: ["GB"],
          organisation_id: user.organisation_id,
          owner_user_id: user.id,
        });
        targetListId = created.id;
        await onListCreated?.(targetListId);
      }

      const chosenAmbiguous = preview.ambiguous
        .filter((row) => includeAmbiguous.includes(row.account.company_name))
        .map((row) => row.account);
      const rows = [...preview.fresh, ...chosenAmbiguous];

      const created = [];
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50).map((account) => ({
          list_id: targetListId,
          company_name: account.company_name,
          domain: account.domain || "",
          website: account.website || "",
          industry: account.industry || "",
          employee_range: account.employee_range || "",
          location: account.location || "",
          contacts: (account.contacts || []).map((contact) => ({ ...contact, email_source: contact.email_source || "import" })),
          full_name: account.contacts?.[0]?.name || "",
          job_title: account.contacts?.[0]?.title || "",
          email: account.contacts?.[0]?.email || "",
          phone: account.contacts?.[0]?.phone || "",
          enrichment_status: "pending",
          fit_score: 0,
          geography_status: "unknown",
          pushed: false,
          call_status: "new",
          source: "import",
          provider_used: "import",
          organisation_id: user.organisation_id,
        }));
        const result = await base44.entities.Prospect.bulkCreate(batch);
        const list = Array.isArray(result) ? result : [result];
        list.filter(Boolean).forEach((record) => created.push(record));
      }

      setSummary({
        imported: rows.length,
        duplicates: preview.duplicates.length,
        ambiguousSkipped: preview.ambiguous.length - chosenAmbiguous.length,
        sheetsRead: preview.sheetsRead || 0,
        filesRead: preview.filesRead || 1,
        ids: created.map((record) => record.id),
      });
      setPreview(null);
      setIncludeAmbiguous([]);
      await onImported?.(targetListId);
      await onImportedRows?.(created.map((record) => record.id));
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not add those accounts.");
    } finally {
      setImporting(false);
    }
  };

  const ambiguousIncluded = (name) => includeAmbiguous.includes(name);
  const totalToAdd = preview ? preview.fresh.length + includeAmbiguous.length : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex items-start gap-2">
        <FileSpreadsheet className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Company list</p>
          <p className="mt-1 text-xs text-slate-500">
            CSV, Excel or JSON. Cadence shows what it read and what is missing before anything is saved.
          </p>
        </div>
        {(preview || summary) && (
          <button
            type="button"
            onClick={reset}
            aria-label="Clear the import"
            className="ml-auto rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!preview && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            parseFiles(event.dataTransfer?.files);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${
            dragging ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-emerald-300"
          }`}
        >
          {parsing ? (
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          ) : (
            <UploadCloud className="h-5 w-5 text-slate-400" />
          )}
          <p className="text-sm font-medium text-slate-800">
            {parsing ? "Reading the file…" : "Drop a file, or choose one"}
          </p>
          <p className="text-xs text-slate-400">CSV or Excel · every worksheet · multiple files · one row per company · max 10MB</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".csv,.xlsx,.xls,.json"
            className="hidden"
            onChange={(event) => {
              parseFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <CircleAlert className="mt-0.5 h-4 w-4 flex-none" />
          <span>{error}</span>
        </div>
      )}

      {summary && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            {summary.imported} account{summary.imported === 1 ? "" : "s"} added
            {summary.duplicates ? ` · ${summary.duplicates} already in this list` : ""}
            {summary.ambiguousSkipped ? ` · ${summary.ambiguousSkipped} skipped as ambiguous` : ""}
            {summary.filesRead > 1 ? ` · ${summary.filesRead} files` : ""}
            {summary.sheetsRead > 1 ? ` · ${summary.sheetsRead} worksheets` : ""}.
          </span>
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">{preview.fileName}</span> · {preview.accounts.length} compan
            {preview.accounts.length === 1 ? "y" : "ies"} read · {preview.fresh.length} new
            {preview.sheetsRead > 1 ? ` · ${preview.sheetsRead} worksheets` : ""}
            {preview.filesRead > 1 ? ` · ${preview.filesRead} files` : ""}
          </p>

          <div className="rounded-xl border border-slate-200">
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Columns Cadence matched
            </p>
            <ul className="divide-y divide-slate-100">
              {preview.mapping.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                  <span className="text-slate-500">{row.label}</span>
                  <span className={row.column ? "text-slate-800" : "italic text-slate-400"}>
                    {row.column || "not found"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {preview.gaps.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {preview.gaps.map((gap) => (
                <span key={gap.label} className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-800">
                  {gap.missing} missing {gap.label.toLowerCase()}
                </span>
              ))}
            </div>
          )}

          {preview.duplicates.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">{preview.duplicates.length} already in this list</p>
              <p className="mt-0.5">
                {preview.duplicates.slice(0, 4).map((row) => row.account.company_name).join(", ")}
                {preview.duplicates.length > 4 ? " and more" : ""} — left exactly as they are.
              </p>
            </div>
          )}

          {preview.ambiguous.length > 0 && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-xs font-semibold text-amber-900">
                {preview.ambiguous.length} possible match{preview.ambiguous.length === 1 ? "" : "es"} — check before adding
              </p>
              <p className="text-[11px] text-amber-800">
                The name looks like an account already in this list. Nothing is added unless you tick it.
              </p>
              <ul className="space-y-1.5">
                {preview.ambiguous.slice(0, 12).map((row) => (
                  <li key={row.account.company_name} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5">
                    <input
                      id={`ambiguous-${row.account.company_name}`}
                      type="checkbox"
                      checked={ambiguousIncluded(row.account.company_name)}
                      onChange={(event) =>
                        setIncludeAmbiguous((current) =>
                          event.target.checked
                            ? [...current, row.account.company_name]
                            : current.filter((name) => name !== row.account.company_name),
                        )
                      }
                      className="h-3.5 w-3.5"
                    />
                    <label htmlFor={`ambiguous-${row.account.company_name}`} className="min-w-0 flex-1 text-xs text-slate-700">
                      <span className="font-medium">{row.account.company_name}</span>
                      <span className="text-slate-400"> · looks like “{row.existing.company_name}”</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={commit}
              disabled={importing || totalToAdd === 0}
              className="rounded-full bg-emerald-600 hover:bg-emerald-500"
            >
              {importing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1 h-4 w-4" />}
              {importing ? "Adding…" : `Add ${totalToAdd} account${totalToAdd === 1 ? "" : "s"}`}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={importing} className="rounded-full">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}