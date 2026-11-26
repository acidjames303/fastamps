import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import OutreachCompanyReview from "@/components/email/OutreachCompanyReview";

const box = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";
const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
const primary =
  "inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-slate-700";
const secondary =
  "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50 hover:bg-slate-50";
const MAX_ROWS = 10000;

function normalizeRow(row) {
  const mapped = {};
  for (const [key, value] of Object.entries(row || {})) {
    const canonical = key.trim().toLowerCase().replace(/[\s-]+/g, "_");
    mapped[canonical] = String(value ?? "").trim();
  }
  return {
    email: mapped.email || mapped.email_address || mapped.work_email || mapped.business_email || "",
    full_name:
      mapped.full_name ||
      mapped.contact_name ||
      mapped.name ||
      [mapped.first_name || mapped.firstname, mapped.last_name || mapped.lastname].filter(Boolean).join(" "),
    first_name: mapped.first_name || mapped.firstname || "",
    last_name: mapped.last_name || mapped.lastname || "",
    company_name: mapped.company_name || mapped.company || mapped.organisation || mapped.organization || "",
    job_title: mapped.job_title || mapped.position || mapped.title || "",
    website: mapped.website || mapped.company_website || mapped.company_url || "",
    company_registration_number:
      mapped.company_registration_number || mapped.company_number || mapped.registration_number || "",
    source_url: mapped.source_url || mapped.research_source || "",
    research_fact: mapped.company_research || mapped.research_fact || "",
    research_source_url: mapped.research_source_url || mapped.company_research_source_url || "",
  };
}

// The campaign's contact queue: pushed prospects and optional spreadsheet rows,
// reviewed here before any draft can be written.
export default function OutreachContactsStep({ brand, campaignId, onChange }) {
  const [leads, setLeads] = useState([]);
  const [page, setPage] = useState(0);
  const [nextPage, setNextPage] = useState(null);
  const [selected, setSelected] = useState([]);
  const [reviewFilter, setReviewFilter] = useState("all");
  const [reviewSearch, setReviewSearch] = useState("");
  const [inspectingLead, setInspectingLead] = useState(null);
  const [sourceFile, setSourceFile] = useState("");
  const [rows, setRows] = useState([]);
  const [reading, setReading] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, created: 0, duplicate: 0, invalid: 0, flagged_company: 0 });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const approvedOnPage = useMemo(() => leads.filter((lead) => lead.review_status === "approved"), [leads]);
  const filteredLeads = useMemo(() => {
    const query = reviewSearch.trim().toLowerCase();
    return leads.filter(
      (lead) =>
        (reviewFilter === "all" || lead.review_status === reviewFilter) &&
        (!query ||
          [lead.full_name, lead.company_name, lead.email, lead.job_title].some((value) =>
            String(value || "").toLowerCase().includes(query)
          ))
    );
  }, [leads, reviewFilter, reviewSearch]);

  useEffect(() => {
    onChange?.({ leads, selected });
  }, [leads, selected, onChange]);

  const fetchLeads = useCallback(
    async (requestedPage = 0) => {
      if (!campaignId) {
        setLeads([]);
        return;
      }
      setWorking(true);
      setError("");
      try {
        const response = await base44.functions.invoke("manageOutreachLeads", {
          action: "list",
          brand_key: brand,
          campaign_id: campaignId,
          page: requestedPage,
          review_status: "",
        });
        const data = response.data || response;
        if (!data.ok) throw new Error(data.error || "Could not retrieve contacts.");
        setLeads(data.leads || []);
        setPage(requestedPage);
        setNextPage(data.next_page);
        setSelected([]);
      } catch (e) {
        setError(e?.response?.data?.error || e.message || "Could not retrieve contacts.");
      } finally {
        setWorking(false);
      }
    },
    [brand, campaignId]
  );

  useEffect(() => {
    setLeads([]);
    setSelected([]);
    fetchLeads(0);
  }, [fetchLeads]);

  const parseFile = async (file) => {
    if (!file) return;
    setReading(true);
    setError("");
    setNotice("");
    try {
      if (!/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error("Please choose a .csv or .xlsx spreadsheet.");
      if (file.size > 15 * 1024 * 1024) throw new Error("The file is too large (15 MB maximum).");
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const sheets = (workbook.SheetNames || []).map((name) => workbook.Sheets[name]).filter(Boolean);
      if (!sheets.length) throw new Error("No worksheet found.");
      // Every tab, not just the first: client files often put the people on tab two.
      const parsed = sheets.flatMap((sheet) => XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }));
      if (parsed.length > MAX_ROWS) throw new Error("Choose a file with at most 10,000 rows per import.");
      const normalized = parsed.map(normalizeRow);
      if (!normalized.some((row) => row.email)) {
        throw new Error("No email column found. Use Email, Work Email or Email Address.");
      }
      setSourceFile(file.name);
      setRows(normalized);
      setProgress({ done: 0, total: normalized.length, created: 0, duplicate: 0, invalid: 0, flagged_company: 0 });
    } catch (e) {
      setError(e.message || "Could not read the spreadsheet.");
    } finally {
      setReading(false);
    }
  };

  const importRows = async () => {
    if (!rows.length || !sourceFile || working) return;
    setWorking(true);
    setError("");
    setNotice("");
    const id = "import_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12);
    const stats = { done: 0, total: rows.length, created: 0, duplicate: 0, invalid: 0, flagged_company: 0 };
    try {
      for (let offset = 0; offset < rows.length; offset += 40) {
        const response = await base44.functions.invoke("manageOutreachLeads", {
          action: "import",
          brand_key: brand,
          import_batch_id: id,
          source_file: sourceFile,
          rows: rows.slice(offset, offset + 40),
        });
        const data = response.data || response;
        if (!data.ok) throw new Error(data.error || "Import interrupted.");
        stats.created += data.created || 0;
        stats.duplicate += data.duplicate || 0;
        stats.invalid += data.invalid || 0;
        stats.flagged_company += data.flagged_company || 0;
        stats.done = Math.min(offset + 40, rows.length);
        setProgress({ ...stats });
      }
      setRows([]);
      setNotice(
        `${stats.created} contacts imported${stats.flagged_company ? `, ${stats.flagged_company} needing a company check` : ""}. No emails sent.`
      );
      await fetchLeads(0);
    } catch (e) {
      setError((e.message || "Import interrupted.") + " Completed batches are saved. Retrying skips duplicates.");
    } finally {
      setWorking(false);
    }
  };

  const changeReview = async (lead, status) => {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const roleAddress =
        /^(info|sales|admin|support|contact|hello|office|enquiries|inquiries|reception|general|marketing|bookings|booking)@/i.test(
          lead.email
        );
      if (
        status === "approved" &&
        !window.confirm(
          "Have you checked this named contact's suitability and the business reason for emailing them? Uploaded addresses are not independently verified."
        )
      )
        return;
      const noName = !lead.first_name && status === "approved";
      if (noName && !window.confirm("No confirmed first name. Approve a generic Hello greeting rather than guessing a name?"))
        return;
      const response = await base44.functions.invoke("manageOutreachLeads", {
        action: "review",
        lead_id: lead.id,
        review_status: status,
        allow_unknown_name: noName,
        allow_generic: roleAddress && status === "approved" ? window.confirm("This is a role inbox. Include it anyway?") : false,
      });
      const data = response.data || response;
      if (!data.ok) throw new Error(data.error || "Could not save review.");
      await fetchLeads(page);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not save review.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {!!inspectingLead && (
        <OutreachCompanyReview
          lead={inspectingLead}
          onClose={() => setInspectingLead(null)}
          onSaved={async () => {
            setInspectingLead(null);
            await fetchLeads(page);
          }}
        />
      )}

      <section className={`${box} space-y-3`}>
        <div className="flex items-center gap-3">
          <UploadCloud className="w-6 h-6 text-emerald-700" />
          <div>
            <h3 className="font-semibold">Add contacts</h3>
            <p className="text-xs text-slate-500">
              Push prospect contacts from Prospecting, or import a spreadsheet. Both land in the same review queue.
            </p>
          </div>
        </div>
        <label className="block rounded-xl border-2 border-dashed border-slate-200 p-6 text-center cursor-pointer hover:border-emerald-400">
          <input type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={(e) => parseFile(e.target.files?.[0])} />
          <FileSpreadsheet className="w-7 h-7 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold mt-2">{reading ? "Reading spreadsheet…" : sourceFile || "Optional spreadsheet"}</p>
          <p className="text-xs text-slate-500 mt-1">
            Columns: Email, First/Last Name, Company, Job Title, Website, Company Number, optional research fact and source
            URL
          </p>
        </label>
        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap justify-between gap-3 items-center">
              <p className="text-sm">
                <strong>{rows.length.toLocaleString()}</strong> uploaded rows
              </p>
              <button className={primary} type="button" disabled={working} onClick={importRows}>
                {working && <Loader2 className="w-4 h-4 animate-spin" />} Import for review
              </button>
            </div>
            <div className="bg-slate-100 rounded-xl overflow-hidden h-2">
              <div
                className="bg-emerald-600 h-2 transition-all"
                style={{ width: (progress.total ? (progress.done / progress.total) * 100 : 0) + "%" }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {progress.done} processed · {progress.created} saved · {progress.duplicate} duplicates · {progress.invalid}{" "}
              invalid · {progress.flagged_company} company checks
            </p>
          </>
        )}
      </section>

      <section className={`${box} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Review contacts</h3>
            <p className="text-xs text-slate-500">
              Page {page + 1} · approve only correctly matched contacts before drafting
            </p>
          </div>
          <button type="button" className={secondary} disabled={working} onClick={() => fetchLeads(page)}>
            <RefreshCw className={"w-4 h-4 " + (working ? "animate-spin" : "")} /> Refresh
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr),auto]">
          <input
            className={input}
            value={reviewSearch}
            placeholder="Find a contact on this page…"
            onChange={(e) => setReviewSearch(e.target.value)}
            aria-label="Search this page of contacts"
          />
          <select
            className={input}
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value)}
            aria-label="Review status"
          >
            <option value="all">All statuses</option>
            <option value="needs_review">Needs review</option>
            <option value="flagged_company">Company check</option>
            <option value="approved">Approved</option>
            <option value="excluded">Excluded</option>
            <option value="suppressed">Suppressed</option>
          </select>
        </div>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={approvedOnPage.length > 0 && approvedOnPage.every((lead) => selected.includes(lead.id))}
            onChange={(e) => setSelected(e.target.checked ? approvedOnPage.map((lead) => lead.id) : [])}
          />
          Select all {approvedOnPage.length} approved contacts on this page
        </label>
        {!leads.length && (
          <p className="text-sm text-slate-500 py-8 text-center">
            No contacts in this campaign yet. Push them from Prospecting, or import a spreadsheet above.
          </p>
        )}
        <div className="max-h-[620px] overflow-y-auto divide-y">
          {filteredLeads.map((lead) => (
            <div
              key={lead.id}
              className={"py-3 flex gap-3 items-start " + (lead.review_status === "flagged_company" ? "bg-amber-50/50" : "")}
            >
              <input
                type="checkbox"
                className="mt-1"
                aria-label={"Select " + (lead.full_name || lead.email)}
                disabled={lead.review_status !== "approved"}
                checked={selected.includes(lead.id)}
                onChange={(e) =>
                  setSelected((current) =>
                    e.target.checked ? [...current, lead.id] : current.filter((id) => id !== lead.id)
                  )
                }
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-slate-900">
                  {lead.full_name || "Name missing"} <span className="text-slate-500 font-normal">{lead.job_title}</span>
                </p>
                <p className="text-xs text-slate-600">
                  {lead.company_name || "Company missing"} · {lead.email}
                </p>
                {(lead.phone || lead.mobile) && (
                  <p className="text-[11px] text-slate-500">
                    {[lead.mobile && `Mobile ${lead.mobile}`, lead.phone && `Phone ${lead.phone}`].filter(Boolean).join(" · ")}
                  </p>
                )}
                {!!lead.research_fact && (
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    Research: {lead.research_fact}
                    {lead.research_source_url && (
                      <a
                        href={lead.research_source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 inline-flex items-center gap-0.5 text-emerald-700"
                      >
                        source <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">{lead.company_match_reason || lead.review_note}</p>
                <p className="text-[11px] text-slate-400">
                  {lead.push_source === "prospecting" ? "Pushed from prospecting" : `Source: ${lead.source_file || "unknown"}`}{" "}
                  · verification {lead.verification_status || "unknown"}
                  {lead.tps_ctps_status ? ` · TPS ${lead.tps_ctps_status}` : ""}
                </p>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <span
                  className={
                    "text-[11px] rounded-lg px-2 py-1 " +
                    (lead.review_status === "approved"
                      ? "bg-emerald-50 text-emerald-700"
                      : lead.review_status === "suppressed"
                        ? "bg-red-50 text-red-700"
                        : lead.review_status === "flagged_company"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700")
                  }
                >
                  {lead.review_status === "flagged_company" ? "Company mismatch" : lead.review_status}
                </span>
                {lead.review_status !== "suppressed" && (
                  <div className="flex flex-wrap gap-1">
                    <button className="text-xs underline text-amber-800" type="button" onClick={() => setInspectingLead(lead)}>
                      Check company / person
                    </button>
                    {lead.review_status !== "approved" && lead.review_status !== "flagged_company" && (
                      <button
                        className="text-xs underline text-emerald-700"
                        disabled={working}
                        onClick={() => changeReview(lead, "approved")}
                      >
                        Approve
                      </button>
                    )}
                    {lead.review_status !== "excluded" && (
                      <button className="text-xs underline text-slate-500" disabled={working} onClick={() => changeReview(lead, "excluded")}>
                        Exclude
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center">
          <button className={secondary} disabled={working || page === 0} type="button" onClick={() => fetchLeads(page - 1)}>
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button className={secondary} disabled={working || nextPage === null} type="button" onClick={() => fetchLeads(nextPage)}>
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}