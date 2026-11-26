import React, { useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, CheckCircle2, CircleAlert, FileSpreadsheet, Loader2, Plus, UploadCloud, X,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { readSpreadsheet } from "@/lib/spreadsheetAccounts";
import { planWorkbook, planSummary, SHEET_ROLES, parseTargetRoles } from "@/lib/workbookPlan";
import DictateButton from "@/components/dialer/DictateButton";

const ACCEPTED = ["csv", "xlsx", "xls", "json"];
const MAX_BYTES = 10 * 1024 * 1024;
const ext = (name) => (String(name).split(".").pop() || "").toLowerCase();

// A client workbook as it really arrives: several tabs, half the columns filled,
// named people on one tab and approved accounts on another. This reads every
// tab, shows what it matched and what is missing, and writes nothing until the
// counts have been seen and the enrichment plan approved.
export default function WorkbookImport({ listId, onListCreated, onImported }) {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [roleOverrides, setRoleOverrides] = useState({});
  const [aliases, setAliases] = useState([]);
  const [aliasDraft, setAliasDraft] = useState({ alias: "", target: "" });
  const [clientEmail, setClientEmail] = useState("");
  const [instructions, setInstructions] = useState("");
  const [approved, setApproved] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const reset = () => {
    setFiles([]);
    setRoleOverrides({});
    setAliases([]);
    setAliasDraft({ alias: "", target: "" });
    setClientEmail("");
    setInstructions("");
    setApproved(false);
    setResult(null);
    setError("");
  };

  const plan = useMemo(() => {
    if (!files.length) return null;
    return planWorkbook(files, {
      roles: roleOverrides,
      aliases,
      roleInstructions: `${clientEmail}\n${instructions}`,
    });
  }, [files, roleOverrides, aliases, clientEmail, instructions]);

  const summary = planSummary(plan);
  const targetRoles = parseTargetRoles(`${instructions}\n${clientEmail}`);

  const addFiles = async (fileList) => {
    setError("");
    setResult(null);
    const chosen = Array.from(fileList || []).filter((file) => {
      if (!ACCEPTED.includes(ext(file.name))) {
        setError(`${file.name} — use CSV, Excel or JSON.`);
        return false;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} — that file is over the 10MB limit.`);
        return false;
      }
      return true;
    });
    if (!chosen.length) return;
    setParsing(true);
    try {
      const parsed = [];
      for (const file of chosen) {
        parsed.push({ fileName: file.name, sheets: await readSpreadsheet(file) });
      }
      setFiles((current) => [...current, ...parsed]);
    } catch (e) {
      setError(e?.message || "Could not read that workbook.");
    } finally {
      setParsing(false);
    }
  };

  const addAlias = () => {
    const alias = aliasDraft.alias.trim();
    const target = aliasDraft.target.trim();
    if (!alias || !target) return;
    setAliases((current) => [...current, { alias, target }]);
    setAliasDraft({ alias: "", target: "" });
  };

  const commit = async () => {
    if (!plan || importing) return;
    if (!summary.accounts) {
      setError("No account rows were read. Check that one tab holds the approved accounts.");
      return;
    }
    setImporting(true);
    setError("");
    try {
      let targetListId = listId;
      const response = await base44.functions.invoke("importWorkbookAccounts", {
        list_id: targetListId || undefined,
        list_name: files[0]?.fileName?.replace(/\.[^.]+$/, "").slice(0, 60) || "Imported client list",
        brief: [clientEmail, instructions].filter(Boolean).join("\n\n").slice(0, 4000),
        accounts: plan.accounts,
        ambiguous: plan.ambiguous,
        unmatched_contacts: plan.unmatchedContacts,
        aliases: plan.aliases,
        target_roles: targetRoles,
        role_instructions: `${clientEmail}\n\n${instructions}`.slice(0, 8000),
        workbooks: files.map((file) => file.fileName),
        sheets: plan.sheets.map((sheet) => ({
          workbook: sheet.fileName,
          sheet: sheet.sheetName,
          role: sheet.role,
          detected: sheet.detected,
          rows: sheet.rows,
          fields: Object.fromEntries((sheet.fields || []).map((field) => [field.key, field.column])),
          unmapped_headers: sheet.unmappedHeaders || [],
        })),
        counts: plan.counts,
        batch_key: files.map((file) => file.fileName).join("|").slice(0, 200),
        enrichment_approved: approved,
      });
      const data = response?.data || response;
      if (data?.error) throw new Error(data.error);
      targetListId = data.list_id;
      if (!listId) await onListCreated?.(targetListId);
      setResult(data);
      setFiles([]);
      setApproved(false);
      await onImported?.(targetListId);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "The import could not be completed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex items-start gap-2">
        <FileSpreadsheet className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Client workbook</p>
          <p className="mt-1 text-xs text-slate-500">
            Every tab is read — approved accounts and named contacts are joined on website or exact company name.
            Nothing is saved until you have seen the counts.
          </p>
        </div>
        {(files.length > 0 || result) && (
          <button
            type="button"
            onClick={reset}
            aria-label="Clear the workbook"
            className="ml-auto rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
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
        onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer?.files); }}
        onDragOver={(event) => event.preventDefault()}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center hover:border-emerald-300"
      >
        {parsing ? <Loader2 className="h-5 w-5 animate-spin text-emerald-600" /> : <UploadCloud className="h-5 w-5 text-slate-400" />}
        <p className="text-sm font-medium text-slate-800">
          {parsing ? "Reading every tab…" : "Drop the client workbook, or choose files"}
        </p>
        <p className="text-xs text-slate-400">CSV, Excel or JSON · several files at once · max 10MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.json"
          className="hidden"
          onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }}
        />
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <CircleAlert className="mt-0.5 h-4 w-4 flex-none" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            {result.accounts_created} account{result.accounts_created === 1 ? "" : "s"} added
            {result.accounts_updated ? `, ${result.accounts_updated} enriched in place` : ""}
            {result.contacts_added ? ` · ${result.contacts_added} named contacts` : ""}
            {result.phones_added ? ` · ${result.phones_added} numbers kept` : ""}. Nothing was overwritten.
          </span>
        </div>
      )}

      {plan && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200">
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Tabs read
            </p>
            <ul className="divide-y divide-slate-100">
              {plan.sheets.map((sheet) => (
                <li key={`${sheet.fileName}-${sheet.sheetName}`} className="space-y-1 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-700">
                      <span className="font-medium">{sheet.sheetName}</span>
                      <span className="text-slate-400"> · {sheet.fileName} · {sheet.rows} rows</span>
                    </p>
                    <select
                      value={sheet.role}
                      onChange={(event) => setRoleOverrides((current) => ({
                        ...current,
                        [`${sheet.fileName}::${sheet.sheetName}`]: event.target.value,
                      }))}
                      aria-label={`What ${sheet.sheetName} holds`}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      {SHEET_ROLES.map((role) => (
                        <option key={role.id} value={role.id}>{role.label}</option>
                      ))}
                    </select>
                  </div>
                  {sheet.role !== "ignore" && (
                    <p className="text-[11px] text-slate-500">
                      {(sheet.fields || []).filter((field) => field.column).length} columns matched
                      {sheet.unmappedHeaders?.length
                        ? ` · ${sheet.unmappedHeaders.length} kept as raw data (${sheet.unmappedHeaders.slice(0, 3).join(", ")}${sheet.unmappedHeaders.length > 3 ? "…" : ""})`
                        : " · every column matched"}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              [summary.accounts, "accounts"],
              [summary.namedContacts, "named contacts"],
              [summary.accountsWithContacts, "with people"],
              [summary.accountsWithoutContacts, "without people"],
              [summary.contactsMissingEmail, "missing email"],
              [summary.contactsMissingMobileOrDirect, "missing mobile/direct"],
              [summary.contactsMissingLinkedIn, "missing LinkedIn"],
              [summary.phoneCandidates, "numbers kept"],
            ].map(([value, label]) => (
              <span key={label} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700">
                <span className="font-semibold">{value}</span> {label}
              </span>
            ))}
          </div>

          {(plan.ambiguous.length > 0 || plan.unmatchedContacts.length > 0) && (
            <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900">
              {plan.ambiguous.length > 0 && (
                <p className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                  <span>
                    {plan.ambiguous.length} compan{plan.ambiguous.length === 1 ? "y" : "ies"} need a check —
                    {plan.ambiguous[0].reason === "shared_domain"
                      ? ` ${plan.ambiguous[0].names?.join(" and ")} share ${plan.ambiguous[0].domain}. Both are kept separately.`
                      : " the same name appears with different websites. Both are kept separately."}
                  </span>
                </p>
              )}
              {plan.unmatchedContacts.length > 0 && (
                <p className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                  <span>
                    {plan.unmatchedContacts.length} named contact{plan.unmatchedContacts.length === 1 ? "" : "s"} match no
                    account ({plan.unmatchedContacts.slice(0, 3).map((row) => row.account_name).join(", ")}
                    {plan.unmatchedContacts.length > 3 ? "…" : ""}). They are not invented — add the account or an alias.
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Search aliases</p>
            <p className="text-[11px] text-slate-500">
              The client may use a different name from the account (MARCH for Musk Process Services). The original name is
              always kept on the record.
            </p>
            {aliases.length > 0 && (
              <ul className="space-y-1">
                {aliases.map((alias, index) => (
                  <li key={`${alias.alias}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                    <span><span className="font-medium">{alias.alias}</span> → {alias.target}</span>
                    <button
                      type="button"
                      onClick={() => setAliases((current) => current.filter((_, position) => position !== index))}
                      className="text-slate-400 hover:text-rose-600"
                      aria-label={`Remove alias ${alias.alias}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                value={aliasDraft.alias}
                onChange={(event) => setAliasDraft({ ...aliasDraft, alias: event.target.value })}
                placeholder="Name in the file"
                aria-label="Alias as written in the file"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
              />
              <input
                value={aliasDraft.target}
                onChange={(event) => setAliasDraft({ ...aliasDraft, target: event.target.value })}
                placeholder="Account name in Cadence"
                aria-label="Account name the alias means"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
              />
              <Button type="button" variant="outline" onClick={addAlias} className="rounded-full h-8 text-xs">
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Client email and role priorities</p>
            <textarea
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
              placeholder="Paste the client's email here — what they want, who to speak to, anything to avoid."
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800"
            />
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Managing Director or Founder, Technical Director, Process Engineering Director…"
              rows={2}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800"
            />
            <DictateButton value={instructions} onChange={setInstructions} label="Dictate roles" />
            {targetRoles.length > 0 && (
              <p className="text-[11px] text-slate-500">
                Discovery priorities: {targetRoles.join(" · ")}. Existing people are never removed for not matching these.
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Enrichment plan</p>
            <ul className="space-y-0.5 text-[11px] text-slate-600">
              <li>{summary.contactsMissingMobileOrDirect} contacts need a mobile or direct number (Lusha first, then your other providers).</li>
              <li>{summary.contactsMissingEmail} contacts need a work email.</li>
              <li>{summary.accountsWithoutContacts} accounts have no named person — discovery would find decision-makers.</li>
            </ul>
            <label className="flex items-start gap-2 text-[11px] text-slate-700">
              <input
                type="checkbox"
                checked={approved}
                onChange={(event) => setApproved(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5"
              />
              <span>
                I approve paid enrichment for these gaps. Recorded against this import; nothing is spent until you start a
                run, and imported data is never overwritten.
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={commit}
              disabled={importing || !summary.accounts}
              className="rounded-full bg-emerald-600 hover:bg-emerald-500"
            >
              {importing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1 h-4 w-4" />}
              {importing ? "Saving…" : `Import ${summary.accounts} accounts`}
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