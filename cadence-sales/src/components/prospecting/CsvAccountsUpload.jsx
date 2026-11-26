import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { UploadCloud, X, CircleAlert, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  readSpreadsheet,
  toAccounts,
  guessCompanyColumn,
  accountsFromSheets,
  mergeAccountLists,
} from "@/lib/spreadsheetAccounts";

const ACCEPTED = ["csv", "xlsx", "xls", "json"];
const MAX_BYTES = 10 * 1024 * 1024;

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    records: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          website: { type: "string" },
          domain: { type: "string" },
          industry: { type: "string" },
          employee_range: { type: "string" },
          location: { type: "string" },
          contact_name: { type: "string" },
          job_title: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
        },
      },
    },
  },
};

const CHIP_TONE = {
  csv: "bg-emerald-100",
  xlsx: "bg-sky-100",
  xls: "bg-sky-100",
  json: "bg-amber-100",
};

const ext = (name) => (String(name).split(".").pop() || "").toLowerCase();

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export default function CsvAccountsUpload({ listId, existingProspects = [], onListCreated, onImported }) {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const busyRef = useRef(false);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [columnPick, setColumnPick] = useState(null);

  const pending = files.filter((f) => f.status === "ready");

  const addFiles = (fileList) => {
    setError("");
    setSummary(null);
    const next = [];
    for (const file of Array.from(fileList || [])) {
      const type = ext(file.name);
      if (!ACCEPTED.includes(type)) {
        setError(`${file.name} — only CSV, Excel or JSON files are supported.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} — ${fmtSize(file.size)} is over the 10MB limit.`);
        continue;
      }
      next.push({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        raw: file,
        name: file.name,
        size: file.size,
        type,
        progress: 0,
        status: "ready",
      });
    }
    if (next.length) {
      setFiles((prev) => [...prev, ...next]);
      // Dropping or choosing a file is the action — start importing straight away.
      importQueue(next);
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer?.files);
  };

  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const clearAll = () => {
    if (busy) return;
    setFiles([]);
    setError("");
    setSummary(null);
    setColumnPick(null);
  };

  const markFile = (id, patch) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  // AI extraction is the fallback for files that cannot be parsed as a table.
  const extractWithAI = async (raw) => {
    const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: raw });
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 600 });
    const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: signed_url,
      json_schema: EXTRACT_SCHEMA,
    });
    if (extracted?.status === "error") return { accounts: [], headers: [] };
    const rows = extracted?.output?.records || extracted?.output || [];
    return toAccounts(Array.isArray(rows) ? rows : []);
  };

  // Read the workbook locally and merge every worksheet (not just the largest).
  const readAccounts = async (raw) => {
    let sheets = [];
    try {
      sheets = await readSpreadsheet(raw);
    } catch {
      return { ...(await extractWithAI(raw)), rows: [], sheetsRead: 0, sheetStats: [] };
    }
    const merged = accountsFromSheets(sheets);
    if (merged.accounts.length) return merged;
    const ai = await extractWithAI(raw);
    if (ai.accounts.length) return { ...ai, rows: [], sheetsRead: sheets.length, sheetStats: merged.sheetStats };
    return merged;
  };

  const saveAccounts = async (accounts, fileName, meta = {}) => {
    let targetListId = listId;
    if (!targetListId) {
      const created = await base44.entities.ProspectList.create({
        name: String(fileName || "").replace(/\.[^.]+$/, "").slice(0, 60),
        brief: `Accounts imported from ${fileName}`,
        status: "ready",
        company_count: 0,
        permitted_countries: ["GB"],
        organisation_id: user.organisation_id,
        owner_user_id: user.id,
      });
      targetListId = created.id;
      await onListCreated?.(targetListId);
    }

    const existingKeys = new Set(
      (existingProspects || []).map((p) => (p.domain || p.company_name || "").toLowerCase()),
    );
    const fresh = accounts.filter((a) => !existingKeys.has((a.domain || a.company_name).toLowerCase()));

    for (let i = 0; i < fresh.length; i += 50) {
      await base44.entities.Prospect.bulkCreate(
        fresh.slice(i, i + 50).map((a) => ({
          list_id: targetListId,
          company_name: a.company_name,
          domain: a.domain || "",
          website: a.website || "",
          industry: a.industry || "",
          employee_range: a.employee_range || "",
          location: a.location || "",
          contacts: a.contacts,
          full_name: a.contacts[0]?.name || "",
          job_title: a.contacts[0]?.title || "",
          email: a.contacts[0]?.email || "",
          phone: a.contacts[0]?.phone || "",
          enrichment_status: "pending",
          fit_score: 0,
          geography_status: "unknown",
          pushed: false,
          call_status: "new",
          organisation_id: user.organisation_id,
        })),
      );
    }

    setSummary({
      imported: fresh.length,
      skipped: accounts.length - fresh.length,
      sheetsRead: meta.sheetsRead || 0,
      filesRead: meta.filesRead || 1,
      sheetStats: meta.sheetStats || [],
    });
    await onImported?.(targetListId);
  };

  const importQueue = async (queue) => {
    if (!queue.length || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setSummary(null);
    setColumnPick(null);
    let currentId = null;
    try {
      const perFile = [];
      let sheetsRead = 0;
      const sheetStats = [];
      for (const file of queue) {
        currentId = file.id;
        markFile(file.id, { status: "working", progress: 20 });
        const read = await readAccounts(file.raw);
        sheetsRead += read.sheetsRead || 0;
        if (Array.isArray(read.sheetStats)) {
          sheetStats.push(...read.sheetStats.map((s) => ({ ...s, file: file.name })));
        }
        if (!read.accounts.length && read.rows.length && read.headers.length) {
          setColumnPick({
            fileId: file.id,
            fileName: file.name,
            headers: read.headers,
            rows: read.rows,
            column: guessCompanyColumn(read.headers, read.rows),
            sheetsRead: read.sheetsRead || 0,
            sheetStats: read.sheetStats || [],
          });
          throw new Error(
            `${file.name} — we read ${read.sheetsRead || 1} sheet${(read.sheetsRead || 1) === 1 ? "" : "s"} (${read.rows.length} rows) but couldn't spot the company column. Choose it below.`,
          );
        }
        if (!read.accounts.length) {
          throw new Error(
            `${file.name} — no readable company rows found across ${(read.sheetsRead || 0) || "any"} worksheet${(read.sheetsRead || 0) === 1 ? "" : "s"}.`,
          );
        }
        perFile.push(read.accounts);
        markFile(file.id, { progress: 85 });
      }

      await saveAccounts(mergeAccountLists(perFile), queue[0].name, {
        sheetsRead,
        filesRead: queue.length,
        sheetStats,
      });
      queue.forEach((f) => markFile(f.id, { status: "done", progress: 100 }));
      setFiles((prev) => prev.filter((f) => f.status !== "done"));
    } catch (e) {
      if (currentId) markFile(currentId, { status: "error", progress: 0 });
      setError(e?.response?.data?.error || e.message || "Could not import that spreadsheet.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const importAll = () => importQueue(pending);

  // Finish an import using a company column the user picked.
  const importPickedColumn = async () => {
    if (!columnPick?.column || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const { accounts } = toAccounts(columnPick.rows, { nameColumn: columnPick.column });
      if (!accounts.length) throw new Error(`“${columnPick.column}” has no values to import.`);
      await saveAccounts(accounts, columnPick.fileName, {
        sheetsRead: columnPick.sheetsRead || 1,
        filesRead: 1,
        sheetStats: columnPick.sheetStats || [],
      });
      markFile(columnPick.fileId, { status: "done", progress: 100 });
      setFiles((prev) => prev.filter((f) => f.status !== "done"));
      setColumnPick(null);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not import that spreadsheet.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-900">Import accounts from a spreadsheet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Cadence researches every company with AI, then finds emails and numbers with your providers.
          </p>
        </div>
        <button
          type="button"
          onClick={clearAll}
          aria-label="Clear spreadsheet queue"
          className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Drag and drop a spreadsheet here, or choose a file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
        onDrop={onDrop}
        className={`group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-5 py-8 text-center cursor-pointer transition-colors ${
          dragging ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"
        }`}
      >
        <div className="relative w-16 h-12" aria-hidden="true">
          <span className="absolute left-1/2 top-1/2 -mt-6 -ml-5 h-12 w-9 rounded-md bg-emerald-100 border-2 border-slate-200 rotate-[-8deg] transition-transform duration-300 group-hover:rotate-[-22deg] group-hover:-translate-x-6" />
          <span className="absolute left-1/2 top-1/2 -mt-6 -ml-5 h-12 w-9 rounded-md bg-sky-100 border-2 border-slate-200 transition-transform duration-300 group-hover:-translate-y-2" />
          <span className="absolute left-1/2 top-1/2 -mt-6 -ml-5 h-12 w-9 rounded-md bg-amber-100 border-2 border-slate-200 rotate-[8deg] transition-transform duration-300 group-hover:rotate-[22deg] group-hover:translate-x-6" />
        </div>
        <p className="text-sm font-medium text-slate-800">
          Drag and drop or{" "}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            className="underline underline-offset-2 font-semibold text-emerald-700 hover:text-emerald-800"
          >
            choose file
          </button>{" "}
          to add accounts.
        </p>
        <p className="text-xs text-slate-400">
          CSV or Excel · every worksheet · multiple files · one row per company or contact · max 10MB
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.json"
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <CircleAlert className="w-4 h-4 mt-0.5 flex-none" />
          <span>{error}</span>
        </div>
      )}

      {columnPick && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 space-y-2">
          <p className="text-xs text-amber-800">
            Which column in {columnPick.fileName} holds the company name?
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={columnPick.column}
              onChange={(e) => setColumnPick({ ...columnPick, column: e.target.value })}
              disabled={busy}
              aria-label="Company name column"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="">Choose a column…</option>
              {columnPick.headers.map((header) => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
            <Button
              onClick={importPickedColumn}
              disabled={busy || !columnPick.column}
              className="rounded-full bg-emerald-600 hover:bg-emerald-500"
            >
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
              Import using this column
            </Button>
          </div>
        </div>
      )}

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className={`h-10 w-8 flex-none rounded-md border-2 border-slate-200 grid place-items-center text-[10px] font-bold uppercase text-slate-700 ${CHIP_TONE[file.type] || "bg-slate-100"}`}>
                  {file.type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-400">{fmtSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  disabled={busy}
                  aria-label={`Remove ${file.name}`}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${file.progress}%` }} />
                </div>
                <span className="w-16 text-right text-xs text-slate-500">
                  {file.status === "done" ? "Added" : file.status === "working" ? "Reading…" : file.status === "error" ? "Failed" : "Ready"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-xs text-slate-400">No files added yet.</p>
      )}

      {summary && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-none" />
          <span>
            {summary.imported} account{summary.imported === 1 ? "" : "s"} added
            {summary.skipped ? `, ${summary.skipped} already in this list` : ""}
            {summary.filesRead > 1 ? ` from ${summary.filesRead} files` : ""}
            {summary.sheetsRead > 1 ? ` across ${summary.sheetsRead} worksheets` : ""}
            . Next: research them with AI.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            aria-label="How importing works"
            aria-expanded={helpOpen}
            className="h-8 w-8 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            ?
          </button>
          {helpOpen && (
            <div className="absolute bottom-full left-0 z-10 mb-2 w-60 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600 shadow-lg">
              Export target companies from your CRM or data source, then drop one or more files in. Cadence reads every
              worksheet in an Excel workbook and merges duplicate companies. Columns: company name, website, industry,
              size, location, plus optional contact name, job title, email and phone.
            </div>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" className="rounded-full border-slate-300" onClick={clearAll} disabled={busy || !files.length}>
            Cancel
          </Button>
          <Button
            onClick={importAll}
            disabled={busy || !pending.length}
            className="rounded-full bg-emerald-600 hover:bg-emerald-500"
          >
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
            {pending.length === 1 ? "Import file" : "Import all"}
          </Button>
        </div>
      </div>
    </div>
  );
}