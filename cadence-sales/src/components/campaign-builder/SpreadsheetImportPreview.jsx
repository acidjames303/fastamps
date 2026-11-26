import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleAlert, Loader2, UploadCloud, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { readSpreadsheet, inferColumnMapping, accountsFromSheets, mergeAccountLists } from "@/lib/spreadsheetAccounts";
import { classifyIncomingAccounts, gapCounts } from "@/lib/importPreview";
import { filterExcludedCompanies, industriesFromAccounts } from "@/lib/companyExclusion";

const ACCEPTED = ["csv", "xlsx", "xls", "json"];
const MAX_BYTES = 10 * 1024 * 1024;
const CHIP_TONE = {
  csv: "bg-emerald-100",
  xlsx: "bg-sky-100",
  xls: "bg-sky-100",
  json: "bg-amber-100",
};

const ext = (name) => (String(name).split(".").pop() || "").toLowerCase();
const fmtSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

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
  const [helpOpen, setHelpOpen] = useState(false);
  const [queue, setQueue] = useState([]);

  const reset = () => {
    setPreview(null);
    setSummary(null);
    setError("");
    setIncludeAmbiguous([]);
    setQueue([]);
    setHelpOpen(false);
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
    setPreview(null);
    setQueue(
      files.map((file, index) => ({
        id: `${file.name}-${index}`,
        name: file.name,
        size: file.size,
        type: ext(file.name),
        progress: 12,
        status: "working",
      })),
    );

    try {
      const perFile = [];
      const headers = new Set();
      let sheetsRead = 0;
      const sheetStats = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setQueue((current) =>
          current.map((row, rowIndex) =>
            rowIndex === index ? { ...row, progress: 55, status: "working" } : row,
          ),
        );
        const sheets = await readSpreadsheet(file);
        const merged = accountsFromSheets(sheets);
        sheetsRead += merged.sheetsRead || sheets.length;
        if (Array.isArray(merged.sheetStats)) {
          sheetStats.push(...merged.sheetStats.map((stat) => ({ ...stat, file: file.name })));
        }
        perFile.push(merged.accounts.map((account) => ({ ...account, __file: file.name })));
        (merged.headers || []).forEach((header) => headers.add(header));
        setQueue((current) =>
          current.map((row, rowIndex) =>
            rowIndex === index ? { ...row, progress: 100, status: "done" } : row,
          ),
        );
      }
      let accounts = mergeAccountLists(perFile);
      if (!accounts.length) {
        throw new Error("No company rows could be read from that file. Check the company column and try again.");
      }

      // Honour campaign ICP excluded_companies (current clients / do-not-prospect).
      let excludedBlocked = [];
      if (listId) {
        try {
          const lists = await base44.entities.ProspectList.filter({ id: listId }, undefined, 1);
          const list = lists?.[0];
          let excluded = [];
          try {
            const parsed = list?.icp ? JSON.parse(list.icp) : null;
            if (parsed && Array.isArray(parsed.excluded_companies)) excluded = parsed.excluded_companies;
          } catch { /* free-text ICP */ }
          if (excluded.length) {
            const filtered = filterExcludedCompanies(accounts, excluded);
            accounts = filtered.kept;
            excludedBlocked = filtered.blocked;
          }
        } catch { /* preview still works if list lookup fails */ }
      }

      const { fresh, duplicates, ambiguous } = classifyIncomingAccounts({ accounts, existingProspects });
      const industryHints = industriesFromAccounts(accounts);

      setPreview({
        fileName: files.map((file) => file.name).join(", "),
        accounts,
        fresh,
        duplicates,
        ambiguous,
        excludedBlocked,
        industryHints,
        mapping: inferColumnMapping([...headers]),
        gaps: gapCounts(accounts),
        sheetsRead,
        filesRead: files.length,
        sheetStats,
      });
      setIncludeAmbiguous([]);
    } catch (e) {
      setQueue((current) => current.map((row) => ({ ...row, status: "error", progress: 100 })));
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
        const batch = rows.slice(i, i + 50).map((account) => {
          const primary = account.contacts?.[0] || {};
          const primaryPhone = primary.mobile || primary.phone || "";
          return {
            list_id: targetListId,
            company_name: account.company_name,
            domain: account.domain || "",
            website: account.website || "",
            industry: account.industry || "",
            employee_range: account.employee_range || "",
            location: account.location || "",
            contacts: (account.contacts || []).map((contact) => ({
              ...contact,
              mobile: contact.mobile || "",
              direct_dial: contact.direct_dial || "",
              phone: contact.mobile || contact.phone || contact.direct_dial || "",
              phone_source: contact.phone_source || (contact.phone || contact.mobile || contact.direct_dial ? "import" : ""),
              email_source: contact.email_source || (contact.email ? "import" : ""),
            })),
            full_name: primary.name || "",
            job_title: primary.title || "",
            email: primary.email || "",
            phone: primaryPhone,
            mobile: primary.mobile || primaryPhone || "",
            direct_dial: primary.direct_dial || "",
            phone_source: primaryPhone ? "import" : "",
            enrichment_status: "pending",
            fit_score: 0,
            geography_status: "unknown",
            pushed: false,
            call_status: "new",
            source: "import",
            provider_used: "import",
            organisation_id: user.organisation_id,
          };
        });
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
      setQueue([]);
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
  const sheetStats = preview?.sheetStats || [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-900">Company list</h3>
          <p className="mt-1 text-xs text-slate-500">
            CSV or Excel — every worksheet merges into one list. Preview before anything is saved.
          </p>
        </div>
        {(preview || summary || queue.length > 0) && (
          <button
            type="button"
            onClick={reset}
            aria-label="Clear the import"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!preview && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Drag and drop a spreadsheet here, or choose a file"
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
          className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors ${
            dragging ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-emerald-300"
          }`}
        >
          {parsing ? (
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          ) : (
            <div className="relative h-12 w-16" aria-hidden="true">
              <span className="absolute left-1/2 top-1/2 -ml-5 -mt-6 h-12 w-9 -translate-x-6 rotate-[-22deg] rounded-md border-2 border-slate-200 bg-emerald-100 transition-transform duration-300 group-hover:-translate-x-8" />
              <span className="absolute left-1/2 top-1/2 -ml-5 -mt-6 h-12 w-9 -translate-y-2 rounded-md border-2 border-slate-200 bg-sky-100 transition-transform duration-300 group-hover:-translate-y-3" />
              <span className="absolute left-1/2 top-1/2 -ml-5 -mt-6 h-12 w-9 translate-x-6 rotate-[22deg] rounded-md border-2 border-slate-200 bg-amber-100 transition-transform duration-300 group-hover:translate-x-8" />
            </div>
          )}
          <p className="text-sm font-medium text-slate-800">
            {parsing ? (
              "Reading every worksheet…"
            ) : (
              <>
                Drag and drop or{" "}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    inputRef.current?.click();
                  }}
                  className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                >
                  choose file
                </button>{" "}
                to add accounts
              </>
            )}
          </p>
          <p className="text-xs text-slate-400">
            CSV or Excel · every worksheet · multiple files · one row per company · max 10MB
          </p>
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

      {queue.length > 0 && !preview && (
        <ul className="space-y-2">
          {queue.map((file) => (
            <li key={file.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-10 w-8 flex-none place-items-center rounded-md border-2 border-slate-200 text-[10px] font-bold uppercase text-slate-700 ${CHIP_TONE[file.type] || "bg-slate-100"}`}
                >
                  {file.type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-400">{fmtSize(file.size)}</p>
                </div>
                <span className="text-xs text-slate-500">
                  {file.status === "done" ? "Read" : file.status === "error" ? "Failed" : "Reading…"}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${file.status === "error" ? "bg-rose-400" : "bg-emerald-500"}`}
                  style={{ width: `${file.progress}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Companies", preview.accounts.length],
              ["New", preview.fresh.length],
              ["Worksheets", preview.sheetsRead || 1],
              ["Files", preview.filesRead || 1],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">{preview.fileName}</span>
            {preview.duplicates.length ? ` · ${preview.duplicates.length} already in this list` : ""}
            {preview.ambiguous.length ? ` · ${preview.ambiguous.length} need a quick check` : ""}
            {preview.excludedBlocked?.length ? ` · ${preview.excludedBlocked.length} excluded clients skipped` : ""}
          </p>

          {sheetStats.length > 1 && (
            <div className="rounded-xl border border-slate-200">
              <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Worksheets merged
              </p>
              <ul className="divide-y divide-slate-100">
                {sheetStats.map((stat) => (
                  <li key={`${stat.file}-${stat.name}`} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                    <span className="min-w-0 truncate text-slate-700">
                      <span className="font-medium">{stat.name}</span>
                      {preview.filesRead > 1 ? <span className="text-slate-400"> · {stat.file}</span> : null}
                    </span>
                    <span className="flex-none text-slate-500">
                      {stat.accounts} compan{stat.accounts === 1 ? "y" : "ies"}
                      {stat.rows != null ? ` · ${stat.rows} rows` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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

          {preview.excludedBlocked?.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <p className="font-semibold text-slate-800">
                {preview.excludedBlocked.length} excluded client{preview.excludedBlocked.length === 1 ? "" : "s"} skipped
              </p>
              <p className="mt-1 text-slate-500">
                {preview.excludedBlocked.slice(0, 6).map((row) => row.company_name || row.name).join(", ")}
                {preview.excludedBlocked.length > 6 ? " and more" : ""} — from this campaign’s do-not-prospect list.
              </p>
            </div>
          )}

          {preview.industryHints?.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-900">
              <p className="font-semibold">Industries in this file (for lookalike search)</p>
              <p className="mt-1 text-emerald-800">
                {preview.industryHints.map((row) => `${row.name} (${row.count})`).join(" · ")}
              </p>
              <p className="mt-1 text-emerald-700/80">
                Add these to Target sectors in the campaign ICP, then find similar companies — excluded clients stay out.
              </p>
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

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setHelpOpen((open) => !open)}
                aria-label="How importing works"
                aria-expanded={helpOpen}
                className="h-8 w-8 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                ?
              </button>
              {helpOpen && (
                <div className="absolute bottom-full left-0 z-10 mb-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600 shadow-lg">
                  Every worksheet in every Excel file is merged. Cadence matches company, website, industry, size,
                  location, and optional contact columns. Nothing is written until you click Add.
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={reset} disabled={importing} className="rounded-full">
                Cancel
              </Button>
              <Button
                onClick={commit}
                disabled={importing || totalToAdd === 0}
                className="rounded-full bg-emerald-600 hover:bg-emerald-500"
              >
                {importing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1 h-4 w-4" />}
                {importing ? "Adding…" : `Add ${totalToAdd} account${totalToAdd === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
