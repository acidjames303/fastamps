import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CircleAlert, CircleHelp, FileText, Loader2, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
import { classifyHeading } from "@/lib/researchMatching";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["md", "markdown", "txt", "pdf", "docx", "xlsx", "xls", "csv"];
const SPREADSHEETS = ["xlsx", "xls", "csv"];
const COMPANY_COLUMN = /company|account|organi[sz]ation|business|client/i;
const PER_CALL = 5;
const SKIP = "__skip__";

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

// A research document holds one section per account, headed "## Company name".
// Everything under that heading is that account's research.
function splitSections(text) {
  const sections = [];
  let current = null;
  const push = () => {
    if (current && current.text.trim()) sections.push({ ...current, text: current.text.trim() });
  };
  String(text || "").split(/\r?\n/).forEach((line) => {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      push();
      const name = heading[1]
        .replace(/^\d+[).:\-]\s*/, "")
        .replace(/\s*[—–|·].*$/, "")
        .trim();
      current = { company_name: name, text: "" };
    } else if (current) {
      current.text += `${line}\n`;
    }
  });
  push();
  return sections.filter((section) => section.company_name);
}

// A workbook or CSV holds one row per account: the company column becomes the
// heading and every other column becomes a labelled line under it.
function spreadsheetToText(buffer) {
  const book = XLSX.read(buffer, { type: "array" });
  const lines = [];
  book.SheetNames.forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, blankrows: false, defval: "" });
    if (!rows.length) return;
    const first = rows[0].map((cell) => String(cell ?? "").trim());
    const hasHeader = first.some((cell) => COMPANY_COLUMN.test(cell));
    const headers = hasHeader ? first : rows[0].map((_, index) => (index === 0 ? "Company" : `Field ${index + 1}`));
    const nameIndex = Math.max(0, headers.findIndex((header) => COMPANY_COLUMN.test(header)));
    (hasHeader ? rows.slice(1) : rows).forEach((row) => {
      const name = String(row[nameIndex] ?? "").trim();
      if (!name) return;
      lines.push(`## ${name}`);
      headers.forEach((header, index) => {
        if (index === nameIndex) return;
        const value = String(row[index] ?? "").trim();
        if (!value || value === name) return;
        lines.push(`${header}: ${value}`);
      });
      lines.push("");
    });
  });
  return lines.join("\n");
}

// Drop a research document onto the campaign. Each account heading is matched to
// an account in the list, and anything ambiguous or missing is put in front of a
// person to confirm before a single finding is filed.
export default function ResearchImportPanel({ listId, prospects = [], onImported }) {
  const [files, setFiles] = useState([]);
  const [filed, setFiled] = useState([]); // documents already added to this box
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [choices, setChoices] = useState({}); // reviewKey -> prospect id | SKIP
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [dragging, setDragging] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const inputRef = useRef(null);

  // What this list already holds, read back from the saved research, so an
  // upload is visibly stored even after a refresh.
  const loadFiled = async () => {
    if (!listId) return;
    const rows = await base44.entities.AccountResearch
      .filter({ prospect_list_id: listId }, "-created_date", 500)
      .catch(() => []);
    const saved = {};
    rows.forEach((row) => {
      const prompt = String(row.prompt || "");
      if (!prompt.startsWith("Imported research:")) return;
      const name = prompt.slice("Imported research:".length).trim() || "Uploaded research";
      if (!saved[name]) saved[name] = { id: name, name, accounts: new Set() };
      saved[name].accounts.add(row.prospect_id);
    });
    setFiled(Object.values(saved).map((doc) => ({ id: doc.id, name: doc.name, accounts: doc.accounts.size })));
  };

  useEffect(() => { loadFiled(); }, [listId]);

  const reviewRows = useMemo(() => {
    const rows = [];
    // Only documents still waiting to be filed need a person's confirmation.
    files.filter((file) => file.status !== "done").forEach((file) => {
      file.sections.forEach((section, index) => {
        const match = classifyHeading(section.company_name, prospects);
        rows.push({
          key: `${file.id}-${index}`,
          fileId: file.id,
          fileName: file.name,
          index,
          company_name: section.company_name,
          match,
        });
      });
    });
    return rows;
  }, [files, prospects]);

  const needingReview = reviewRows.filter((row) => row.match.status !== "matched");
  const unresolved = needingReview.filter((row) => !choices[row.key]);

  // Markdown, text, Excel and CSV are read in the browser. PDF and Word are read
  // once on the server (stored privately) and only the extracted text comes back.
  const readDocumentText = async (file, ext) => {
    if (["md", "markdown", "txt"].includes(ext)) return file.text();
    if (SPREADSHEETS.includes(ext)) return spreadsheetToText(await file.arrayBuffer());
    const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
    const response = await base44.functions.invoke("extractResearchDocument", { file_uri, format: ext });
    const data = response.data || response;
    if (data?.error) throw new Error(data.error);
    return data.text || "";
  };

  const addFiles = async (fileList) => {
    setError("");
    setSummary("");
    const accepted = [];
    for (const file of Array.from(fileList || [])) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!ACCEPTED.includes(ext)) {
        setError(`${file.name} — upload a PDF, Word, Markdown, text, Excel or CSV document.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} — ${formatSize(file.size)} is over the 10MB limit.`);
        continue;
      }
      try {
        const sections = splitSections(await readDocumentText(file, ext));
        if (!sections.length) {
          setError(`${file.name} — no account headings found. Use one “## Company” heading per account.`);
          continue;
        }
        accepted.push({
          id: `${file.name}-${file.size}-${Date.now()}-${accepted.length}`,
          name: file.name,
          size: file.size,
          type: ext,
          sections,
          total: sections.length,
          done: 0,
          status: "ready",
        });
      } catch (e) {
        setError(`${file.name} — ${e?.response?.data?.error || e.message || "that document could not be read."}`);
      }
    }
    if (accepted.length) {
      const next = [...files, ...accepted];
      setFiles(next);
      // Every heading matched an account exactly: save it straight away, no click.
      const allMatched = accepted.every((file) =>
        file.sections.every((section) => classifyHeading(section.company_name, prospects).status === "matched"),
      );
      if (allMatched) await runImport(next);
    }
  };

  const pick = (fileList) => {
    if (!fileList || !fileList.length) return;
    addFiles(fileList);
  };

  // Pasted findings go through exactly the same path as a document: one
  // “## Company” heading per account.
  const addPasted = () => {
    const text = pasteText.trim();
    if (!text) { setError("Paste the research first — one “## Company” heading per account."); return; }
    const file = new File([text], `Pasted research ${filed.length + files.length + 1}.md`, { type: "text/markdown" });
    addFiles([file]);
    setPasteText("");
    setPasteOpen(false);
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
    setChoices((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith(`${id}-`))),
    );
  };

  const clearAll = () => {
    if (running) return;
    setFiles([]);
    setPasteOpen(false);
    setPasteText("");
    setChoices({});
    setError("");
    setSummary("");
  };

  const choiceFor = (row) => {
    if (row.match.status === "matched") return row.match.prospect.id;
    return choices[row.key] || "";
  };

  const runImport = async (queue) => {
    const docs = queue || files;
    if (!listId || running || !docs.length) return;
    const blockers = docs
      .filter((file) => file.status !== "done")
      .flatMap((file) =>
        file.sections.map((section, index) => ({
          match: classifyHeading(section.company_name, prospects),
          key: `${file.id}-${index}`,
        })),
      )
      .filter((row) => row.match.status !== "matched" && !choices[row.key]);
    if (blockers.length) {
      setError("Confirm the accounts marked “needs review” before importing — nothing is filed until you do.");
      return;
    }
    setRunning(true);
    setError("");
    setSummary("");
    let imported = 0;
    const review = [];
    try {
      for (const file of docs) {
        setFiles((prev) => prev.map((item) => (item.id === file.id ? { ...item, status: "running" } : item)));
        for (let i = 0; i < file.sections.length; i += PER_CALL) {
          const batch = file.sections.slice(i, i + PER_CALL).map((section, offset) => {
            const index = i + offset;
            const key = `${file.id}-${index}`;
            const match = classifyHeading(section.company_name, prospects);
            const chosen = match.status === "matched" ? match.prospect.id : choices[key];
            return {
              company_name: section.company_name,
              text: section.text,
              prospect_id: chosen === SKIP ? "" : chosen || "",
            };
          });
          const skipped = batch
            .filter((section, offset) => {
              const key = `${file.id}-${i + offset}`;
              const match = classifyHeading(section.company_name, prospects);
              return match.status !== "matched" && choices[key] === SKIP;
            })
            .map((section) => section.company_name);

          const response = await base44.functions.invoke("importResearchDocument", {
            prospect_list_id: listId,
            document_name: file.name,
            sections: batch.filter((section) => !skipped.includes(section.company_name)),
            skip: skipped,
          });
          const data = response.data || response;
          if (data?.error) throw new Error(data.error);
          imported += data?.imported || 0;
          review.push(...(data?.ambiguous || []), ...(data?.needs_review || []));
          const done = Math.min(i + PER_CALL, file.sections.length);
          setFiles((prev) => prev.map((item) => (item.id === file.id ? { ...item, done } : item)));
        }
        setFiles((prev) => prev.map((item) => (item.id === file.id ? { ...item, status: "done" } : item)));
      }
      await onImported?.();
      const left = review.length
        ? ` ${review.length} heading${review.length === 1 ? "" : "s"} still need a person to match them.`
        : "";
      // Saved: read back what the list now holds and leave the box ready for more.
      await loadFiled();
      setFiles([]);
      setChoices({});
      setSummary(`Saved — ${imported} account${imported === 1 ? "" : "s"} updated with this document's findings.${left}`);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "The import stopped. Try again in a moment.");
    } finally {
      setRunning(false);
    }
  };

  if (!listId || !prospects.length) return null;

  const totalSections = files.reduce((sum, file) => sum + file.total, 0);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 mt-0.5 flex-none text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Upload research you already have</p>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Drop documents in, one after another, and Cadence files each account's findings against it — keeping
              published evidence apart from anything the customer confirmed. Headings that do not match an account
              exactly are put in front of you first.
            </p>
          </div>
        </div>
        {(files.length > 0 || filed.length > 0) && (
          <button
            type="button"
            onClick={clearAll}
            disabled={running}
            aria-label="Clear files"
            className="flex-none w-8 h-8 grid place-items-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

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
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return;
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          pick(event.dataTransfer?.files);
        }}
        className={`group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
          dragging
            ? "border-emerald-500 bg-emerald-50"
            : "border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/40"
        }`}
      >
        <div className="relative h-14 w-20" aria-hidden="true">
          <span className="absolute left-1/2 top-1/2 h-14 w-10 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-md border-2 border-slate-300 bg-white transition-transform duration-300 group-hover:-translate-x-[70%] group-hover:-rotate-[20deg]" />
          <span className="absolute left-1/2 top-1/2 h-14 w-10 -translate-x-1/2 -translate-y-1/2 rotate-6 rounded-md border-2 border-emerald-300 bg-emerald-50 transition-transform duration-300 group-hover:-translate-y-[60%] group-hover:rotate-0" />
          <span className="absolute left-1/2 top-1/2 h-14 w-10 -translate-x-1/2 -translate-y-1/2 rotate-[22deg] rounded-md border-2 border-slate-300 bg-white transition-transform duration-300 group-hover:translate-x-[10%] group-hover:rotate-[20deg]" />
        </div>
        <p className="text-sm font-medium text-slate-800">
          Drag and drop, or <span className="italic text-emerald-700 underline underline-offset-2">choose file</span> to {filed.length ? "add more" : "import"}
        </p>
        <p className="text-xs text-slate-500">PDF, Word, Markdown, text, Excel or CSV · one “## Company” heading per account · max 10MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".md,.markdown,.txt,.pdf,.docx,.xlsx,.xls,.csv,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="absolute h-px w-px opacity-0"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            pick(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {pasteOpen ? (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <label htmlFor="paste-research" className="text-xs font-semibold text-slate-800">
            Paste research — one “## Company” heading per account
          </label>
          <textarea
            id="paste-research"
            autoFocus
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            rows={6}
            placeholder={"## Acme Ltd\nFinding: opened a new plant in Leeds (source: acme.co.uk/news)"}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={addPasted} className="rounded-full bg-emerald-600 hover:bg-emerald-500">
              Add to this box
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setPasteOpen(false); setPasteText(""); }}
              className="rounded-full text-slate-500"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPasteOpen(true)}
          className="self-start text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
        >
          Or paste research text into this box
        </button>
      )}

      {filed.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-xs font-semibold text-emerald-900">Saved in this list</p>
          <ul className="mt-1.5 space-y-1">
            {filed.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 text-xs text-emerald-900">
                <span className="min-w-0 truncate">{doc.name}</span>
                <span className="flex-none text-emerald-700">
                  {doc.accounts} account{doc.accounts === 1 ? "" : "s"} filed
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-emerald-800">
            Saved automatically as soon as a document is added. Keep adding — each one is filed against the same
            accounts and never overwrites what is already there.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          <CircleAlert className="w-4 h-4 mt-0.5 flex-none" />
          <span>{error}</span>
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file) => {
            const percent = file.total ? Math.round((file.done / file.total) * 100) : 0;
            return (
              <li key={file.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white p-3">
                <span className="row-span-2 grid h-11 w-9 place-items-center rounded-md border border-emerald-200 bg-emerald-50">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    {(file.type || "md").slice(0, 4)}
                  </span>
                </span>
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-sm font-medium text-slate-800">{file.name}</span>
                  <span className="flex-none text-xs italic text-slate-400">
                    {formatSize(file.size)} · {file.total} account{file.total === 1 ? "" : "s"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  disabled={running}
                  aria-label={`Remove ${file.name}`}
                  className="grid h-6 w-6 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${file.status === "done" ? 100 : percent}%` }}
                    />
                  </div>
                  <span className="min-w-[52px] text-right text-xs italic text-slate-500">
                    {file.status === "done" ? "Filed" : file.status === "running" ? `${percent}%` : "Ready"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {needingReview.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs font-semibold text-amber-900">
            {needingReview.length} heading{needingReview.length === 1 ? "" : "s"} need your confirmation
          </p>
          <p className="text-[11px] text-amber-800">
            Cadence will not guess which account a heading belongs to. Pick the account, or mark it as not in this list.
          </p>
          <ul className="space-y-2">
            {needingReview.map((row) => (
              <li key={row.key} className="rounded-xl border border-amber-200 bg-white p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{row.company_name}</span>
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-800">
                    {row.match.status === "ambiguous" ? "needs review" : "not in list"}
                  </span>
                </div>
                <select
                  value={choices[row.key] || ""}
                  onChange={(event) => setChoices((prev) => ({ ...prev, [row.key]: event.target.value }))}
                  disabled={running}
                  aria-label={`Match ${row.company_name} to an account`}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                >
                  <option value="">Choose the account…</option>
                  {row.match.candidates?.length > 0 && (
                    <optgroup label="Suggested">
                      {row.match.candidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.company_name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="All accounts in this campaign">
                    {prospects.map((prospect) => (
                      <option key={prospect.id} value={prospect.id}>
                        {prospect.company_name}
                      </option>
                    ))}
                  </optgroup>
                  <option value={SKIP}>Not in this campaign — skip this heading</option>
                </select>
              </li>
            ))}
          </ul>
          {unresolved.length > 0 && (
            <p className="text-[11px] text-amber-900">
              {unresolved.length} still to confirm before this document can be filed.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <button
            type="button"
            onClick={() => setHelpOpen((open) => !open)}
            aria-label="How the import reads your document"
            aria-expanded={helpOpen}
            className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <CircleHelp className="w-4 h-4" />
          </button>
          {helpOpen && (
            <div className="absolute bottom-11 left-0 z-10 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600 shadow-lg">
              One “## Company” heading per account. A heading that matches an account exactly is filed automatically;
              anything else is listed for you to confirm, and nothing is filed against a guessed account. Re-importing
              the same document refreshes those findings instead of duplicating them.
            </div>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" className="rounded-full border-slate-300" onClick={clearAll} disabled={running || !files.length}>
            Cancel
          </Button>
          <Button
            onClick={runImport}
            disabled={running || !files.length || unresolved.length > 0}
            className="rounded-full bg-emerald-600 hover:bg-emerald-500"
          >
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {running
              ? "Filing research…"
              : files.length
                ? `Import ${totalSections} account${totalSections === 1 ? "" : "s"}`
                : "Import research"}
          </Button>
        </div>
      </div>

      {summary && <p className="text-xs text-emerald-700">{summary}</p>}
    </div>
  );
}