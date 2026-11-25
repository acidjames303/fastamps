import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CircleAlert, CircleHelp, FileText, Loader2, Upload, X } from "lucide-react";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["md", "markdown", "txt"];
const PER_CALL = 5;

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

// Drop a research document onto the list and every account it covers gets the
// findings filed against it — readable from the row's "see research" view.
export default function ResearchImportPanel({ listId, prospects = [], onImported, embedded = false }) {
  const [files, setFiles] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [dragging, setDragging] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const inputRef = useRef(null);

  const addFiles = async (fileList) => {
    setError("");
    setSummary("");
    const accepted = [];
    for (const file of Array.from(fileList || [])) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!ACCEPTED.includes(ext)) {
        setError(`${file.name} — upload a Markdown or text document.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} — ${formatSize(file.size)} is over the 5.0MB limit.`);
        continue;
      }
      const sections = splitSections(await file.text());
      if (!sections.length) {
        setError(`${file.name} — no account headings found. Use one “## Company” heading per account.`);
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${Date.now()}-${accepted.length}`,
        name: file.name,
        size: file.size,
        sections,
        total: sections.length,
        done: 0,
        status: "ready",
      });
    }
    if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
  };

  const pick = (fileList) => {
    if (!fileList || !fileList.length) return;
    addFiles(fileList);
  };

  const removeFile = (id) => setFiles((prev) => prev.filter((file) => file.id !== id));

  const clearAll = () => {
    if (running) return;
    setFiles([]);
    setError("");
    setSummary("");
  };

  const runImport = async () => {
    if (!listId || running || !files.length) return;
    setRunning(true);
    setError("");
    setSummary("");
    let imported = 0;
    const unmatched = [];
    try {
      for (const file of files) {
        setFiles((prev) => prev.map((item) => (item.id === file.id ? { ...item, status: "running" } : item)));
        for (let i = 0; i < file.sections.length; i += PER_CALL) {
          const batch = file.sections.slice(i, i + PER_CALL);
          const response = await base44.functions.invoke("importResearchDocument", {
            prospect_list_id: listId,
            document_name: file.name,
            sections: batch.map((section) => ({ company_name: section.company_name, text: section.text })),
          });
          const data = response.data || response;
          if (data?.error) throw new Error(data.error);
          imported += data?.imported || 0;
          if (Array.isArray(data?.unmatched)) unmatched.push(...data.unmatched);
          const done = Math.min(i + PER_CALL, file.sections.length);
          setFiles((prev) => prev.map((item) => (item.id === file.id ? { ...item, done } : item)));
        }
        setFiles((prev) => prev.map((item) => (item.id === file.id ? { ...item, status: "done" } : item)));
      }
      await onImported?.();
      const missing = unmatched.length
        ? ` ${unmatched.length} section${unmatched.length === 1 ? "" : "s"} had no matching account in this list.`
        : "";
      setSummary(`${imported} account${imported === 1 ? "" : "s"} updated with this document's findings.${missing}`);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "The import stopped. Try again in a moment.");
    } finally {
      setRunning(false);
    }
  };

  if (!listId || !prospects.length) return null;

  const totalSections = files.reduce((sum, file) => sum + file.total, 0);

  return (
    <div className={embedded ? "space-y-4" : "rounded-3xl border border-slate-200 bg-white p-5 space-y-4"}>
      <div className="flex items-start justify-between gap-3">
        {!embedded ? (
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 mt-0.5 flex-none text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Import a research document</p>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Already researched these accounts elsewhere? Drop the document in and Cadence files each account's
              findings against it, keeping published evidence apart from anything the customer confirmed.
            </p>
          </div>
        </div>
        ) : <div />}
        {files.length > 0 && (
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
          Drag and drop, or <span className="italic text-emerald-700 underline underline-offset-2">choose file</span> to import
        </p>
        <p className="text-xs text-slate-500">Markdown or text · one “## Company” heading per account · max 5.0MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".md,.markdown,.txt,text/plain,text/markdown"
          className="absolute h-px w-px opacity-0"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            pick(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

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
                  <span className="text-[10px] font-bold tracking-wide text-emerald-700">MD</span>
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
              One “## Company” heading per account. Cadence matches each heading to the accounts already in this list,
              extracts the findings from that section, and keeps published sources separate from customer-confirmed notes.
              Re-importing the same document refreshes those findings instead of duplicating them.
            </div>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" className="rounded-full border-slate-300" onClick={clearAll} disabled={running || !files.length}>
            Cancel
          </Button>
          <Button
            onClick={runImport}
            disabled={running || !files.length}
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