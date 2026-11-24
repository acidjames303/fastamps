import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, RefreshCw, Loader2, MailPlus, ShieldCheck, ArrowLeft, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import OutreachCompanyReview from "@/components/email/OutreachCompanyReview";
import {renderPersonalised} from "../../../base44/shared/outreachIdentity.ts";

const box = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";
const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
const primary = "inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-slate-700";
const secondary = "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50 hover:bg-slate-50";
const MAX_ROWS = 10000; // Import is paged in 40-record backend invocations.

function normalizeRow(row) {
  const mapped = {};
  for (const [key, value] of Object.entries(row || {})) {
    const canonical = key.trim().toLowerCase().replace(/[\s-]+/g, "_");
    mapped[canonical] = String(value ?? "").trim();
  }
  return {
    email: mapped.email || mapped.email_address || mapped.work_email || mapped.business_email || "",
    full_name: mapped.full_name || mapped.contact_name || mapped.name ||
      [mapped.first_name || mapped.firstname, mapped.last_name || mapped.lastname].filter(Boolean).join(" "),
    first_name: mapped.first_name || mapped.firstname || "",
    last_name: mapped.last_name || mapped.lastname || "",
    company_name: mapped.company_name || mapped.company || mapped.organisation || mapped.organization || "",
    job_title: mapped.job_title || mapped.position || mapped.title || "",
    website: mapped.website || mapped.company_website || mapped.company_url || "",
    company_registration_number: mapped.company_registration_number || mapped.company_number || mapped.registration_number || "",
    source_url: mapped.source_url || mapped.research_source || "",
    research_fact: mapped.company_research || mapped.research_fact || "",
    research_source_url: mapped.research_source_url || mapped.company_research_source_url || "",
  };
}

export default function OutreachCampaignStudio({ brand, user, onDraftsCreated }) {
  const [stage, setStage] = useState("import");
  const [folder,setFolder] = useState("all");
  const [inspectingLead,setInspectingLead] = useState(null);
  const [templates,setTemplates] = useState([]);
  const [templateId,setTemplateId] = useState("");
  const [sourceFile, setSourceFile] = useState("");
  const [rows, setRows] = useState([]);
  const [reading, setReading] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, created: 0, duplicate: 0, invalid: 0, flagged: 0, flagged_company: 0 });
  const [leads, setLeads] = useState([]);
  const [page, setPage] = useState(0);
  const [nextPage, setNextPage] = useState(null);
  const [selected, setSelected] = useState([]);
  const [reviewFilter, setReviewFilter] = useState("all");
  const [reviewSearch, setReviewSearch] = useState("");
  const [subject, setSubject] = useState("{{company_name}} — quick question");
  const [body, setBody] = useState("{{greeting}},\n\nAre you the right person to speak to about this at {{company_name}}?\n\nWould it be useful to arrange a quick conversation?\n\nBest,");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const importRef = useRef(null);
  const approvedOnPage = useMemo(() => leads.filter((l) => l.review_status === "approved"), [leads]);
  const filteredLeads = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase();
    return leads.filter((lead) =>
      (reviewFilter === "all" || lead.review_status === reviewFilter) &&
      (!q || [lead.full_name, lead.company_name, lead.email, lead.job_title].some(x=>String(x||"").toLowerCase().includes(q)))
    );
  }, [leads,reviewFilter,reviewSearch]);

  useEffect(()=>{
    let active=true;
    if(!user?.id||!user?.organisation_id)return;
    base44.entities.OutreachTemplate.filter({
      organisation_id:user.organisation_id,owner_user_id:user.id,brand_key:brand,
    },"-updated_at",300).then(rows=>{if(active)setTemplates(rows||[]);})
    .catch(()=>{if(active)setTemplates([]);});
    return ()=>{active=false;};
  },[brand,user?.id,user?.organisation_id]);

  const fetchLeads = useCallback(async (requestedPage = 0) => {
    setWorking(true); setError("");
    try {
      const response = await base44.functions.invoke("manageOutreachLeads", {
        action: "list", brand_key: brand, page: requestedPage,
        review_status: folder === "flagged_company" ? "flagged_company" : "",
      });
      const data = response.data || response;
      if (!data.ok) throw new Error(data.error || "Could not retrieve prospects.");
      setLeads(data.leads || []);
      setPage(requestedPage);
      setNextPage(data.next_page);
      setSelected([]);
    } catch (e) { setError(e.message || "Could not retrieve prospects."); }
    finally { setWorking(false); }
  }, [brand,folder]);

  useEffect(() => {
    setRows([]); setSourceFile(""); setLeads([]); setSelected([]);setInspectingLead(null);
    setStage("import");setFolder("all"); setPage(0);
  }, [brand]);
  useEffect(()=>{fetchLeads(0);},[fetchLeads]);

  const parseFile = async (file) => {
    if (!file) return;
    setReading(true); setError(""); setNotice("");
    try {
      if (!/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error("Please choose a .csv or .xlsx spreadsheet.");
      if (file.size > 15 * 1024 * 1024) throw new Error("The file is too large (15 MB maximum).");
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error("No worksheet found.");
      const parsed = XLSX.utils.sheet_to_json(firstSheet, { defval: "", raw: false });
      if (parsed.length > MAX_ROWS) throw new Error("Choose a file with at most 10,000 rows per import.");
      const normalized = parsed.map(normalizeRow);
      if (!normalized.some((r) => r.email)) throw new Error("No email column found. Use Email, Work Email or Email Address.");
      setSourceFile(file.name);
      setRows(normalized);
      setProgress({ done: 0, total: normalized.length, created: 0, duplicate: 0, invalid: 0, flagged: 0, flagged_company: 0 });
    } catch (e) { setError(e.message || "Could not read the spreadsheet."); }
    finally { setReading(false); }
  };

  const importRows = async () => {
    if (!rows.length || !sourceFile || working) return;
    setWorking(true); setError(""); setNotice("");
    const id = "import_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12);
    importRef.current = id;
    const stats = { done: 0, total: rows.length, created: 0, duplicate: 0, invalid: 0, flagged: 0, flagged_company: 0 };
    try {
      for (let offset = 0; offset < rows.length; offset += 40) {
        const response = await base44.functions.invoke("manageOutreachLeads", {
          action: "import", brand_key: brand, import_batch_id: id,
          source_file: sourceFile, rows: rows.slice(offset, offset + 40),
        });
        const data = response.data || response;
        if (!data.ok) throw new Error(data.error || "Import interrupted.");
        stats.created += data.created || 0;
        stats.duplicate += data.duplicate || 0;
        stats.invalid += data.invalid || 0;
        stats.flagged += data.flagged || 0;
        stats.flagged_company += data.flagged_company || 0;
        stats.done = Math.min(offset + 40, rows.length);
        setProgress({ ...stats });
      }
      setRows([]);
      setNotice(stats.created + " prospects imported. "+stats.flagged_company+" possible company matches require manual checking. No emails sent.");
      setReviewFilter("all");setReviewSearch("");
      setFolder(stats.flagged_company>0?"flagged_company":"all");
      setStage("review");
      if(stats.flagged_company===0)await fetchLeads(0);
    } catch (e) {
      setError((e.message || "Import interrupted.") + " Completed batches are already saved. Retrying the same file skips duplicate addresses.");
    } finally { setWorking(false); }
  };

  const changeReview = async (lead, status) => {
    setWorking(true); setError(""); setNotice("");
    try {
      const roleAddress = /^(info|sales|admin|support|contact|hello|office|enquiries|inquiries|reception|general|marketing|bookings|booking)@/i.test(lead.email);
      if (status === "approved" && !window.confirm(
        "Have you checked this named contact's suitability and the business reason for emailing them? " +
        "Uploaded email addresses are not independently verified.")) return;
      const noName = !lead.first_name && status === "approved";
      if(noName && !window.confirm("No confirmed first name. Approve a generic Hello greeting rather than guessing a name?"))return;
      const response = await base44.functions.invoke("manageOutreachLeads", {
        action: "review", lead_id: lead.id, review_status: status,allow_unknown_name:noName,
        allow_generic: roleAddress && status === "approved" ? window.confirm(
          "This is a generic or role-based inbox. Confirm you want to include it despite your named-contact preference."
        ) : false,
      });
      const data = response.data || response;
      if (!data.ok) throw new Error(data.error || "Could not save review.");
      await fetchLeads(page);
    } catch (e) { setError(e.message || "Could not save review."); }
    finally { setWorking(false); }
  };

  const generatedPreview = useMemo(() => {
    const candidate = leads.find((l) => selected.includes(l.id)) ||
      leads.find((l) => l.review_status === "approved");
    if(!candidate)return {subject:"",body:"",error:"Select an approved contact to preview the real details. No example names are inserted.",candidate:null};
    const sub=renderPersonalised(subject,candidate);
    const message=renderPersonalised(body,candidate);
    if(!sub.ok||!message.ok)return {subject:"",body:"",error:sub.error||message.error,candidate};
    return {subject:sub.text,body:message.text,error:"",candidate};
  }, [leads, selected, subject, body]);

  const createDrafts = async () => {
    const selectedLeads = leads.filter((l) => selected.includes(l.id) && l.review_status === "approved");
    if (!selectedLeads.length) return setError("Select at least one reviewed prospect.");
    if (!subject.trim() || !body.trim()) return setError("Subject and message template are required.");
    if (!window.confirm("Create " + selectedLeads.length + " editable drafts? Nothing will be sent.")) return;
    setWorking(true); setError(""); setNotice("");
    try {
      let drafted = 0, skipped = 0, missing = 0;
      const reasonSamples = [];
      for (let offset = 0; offset < selectedLeads.length; offset += 25) {
        const response = await base44.functions.invoke("manageOutreachLeads", {
          action: "generate", lead_ids: selectedLeads.slice(offset, offset + 25).map((l) => l.id),
          brand_key: brand, subject_template: subject, body_template: body,
        });
        const data = response.data || response;
        if (!data.ok) throw new Error(data.error || "Draft generation failed.");
        drafted += data.drafted || 0; skipped += data.skipped || 0;
        missing += data.skipped_missing_data || 0;
        reasonSamples.push(...(data.errors||[]));
      }
      setSelected([]);
      setNotice(drafted + " personal drafts saved. "+skipped+" skipped as duplicates/suppressed; "+missing+" missing verified fields."+(reasonSamples.length?" Example: "+reasonSamples[0].reason:"")+" No messages sent.");
      await onDraftsCreated?.();
    } catch (e) { setError(e.message || "Draft generation failed."); }
    finally { setWorking(false); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Campaign draft studio</h2>
          <p className="text-sm text-slate-500 mt-1">Import, review and prepare personal drafts. Human review required; sending remains disabled.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={working||reading} aria-current={stage==="import"?"step":undefined}
            className={stage==="import"?primary:secondary} onClick={()=>setStage("import")}>1. Import</button>
          <button type="button" disabled={working||reading} aria-current={stage==="review"&&folder==="all"?"step":undefined}
            className={stage==="review"&&folder==="all"?primary:secondary}
            onClick={()=>{setStage("review");setFolder("all");setInspectingLead(null);fetchLeads(0);}}>2. Review & draft</button>
          <button type="button" disabled={working||reading} aria-current={stage==="review"&&folder==="flagged_company"?"step":undefined}
            className={stage==="review"&&folder==="flagged_company"?"inline-flex items-center rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-2.5 text-sm font-semibold":secondary}
            onClick={()=>{setStage("review");setFolder("flagged_company");setReviewFilter("all");setReviewSearch("");setInspectingLead(null);}}>
            Company flags{progress.flagged_company>0?" ("+progress.flagged_company+")":""}
          </button>
        </div>
      </div>
      {notice && <p role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</p>}
      {!!inspectingLead && <OutreachCompanyReview lead={inspectingLead}
        onClose={()=>setInspectingLead(null)}
        onSaved={async()=>{setInspectingLead(null);await fetchLeads(page);}}/>}
      {stage === "import" ? (
        <section className={box + " space-y-4"}>
          <div className="flex items-center gap-3"><UploadCloud className="w-6 h-6 text-emerald-700"/>
            <div><h3 className="font-semibold">Upload an outreach contact list</h3>
              <p className="text-xs text-slate-500">CSV or Excel. Named contacts preferred. Up to 10,000 records per file in batches of 40.</p></div>
          </div>
          <label className="block rounded-xl border-2 border-dashed border-slate-200 p-8 text-center cursor-pointer hover:border-emerald-400">
            <input type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={(e)=>parseFile(e.target.files?.[0])}/>
            <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto"/>
            <p className="text-sm font-semibold mt-3">{reading ? "Reading spreadsheet…" : sourceFile || "Choose spreadsheet"}</p>
            <p className="text-xs text-slate-500 mt-1">Columns: Email, First Name, Last Name (or Full Name), Company, Job Title, Website, Company Number, Source URL, optional Research Fact + Research Source URL</p>
          </label>
          {rows.length > 0 && <>
            <div className="flex flex-wrap justify-between gap-3 items-center">
              <p className="text-sm"><strong>{rows.length.toLocaleString()}</strong> uploaded rows</p>
              <button className={primary} type="button" disabled={working} onClick={importRows}>
                {working && <Loader2 className="w-4 h-4 animate-spin"/>} Import for review
              </button>
            </div>
            <div className="bg-slate-100 rounded-xl overflow-hidden h-2"><div className="bg-emerald-600 h-2 transition-all" style={{width:(progress.total ? (progress.done/progress.total)*100 : 0)+"%"}}/></div>
            <p className="text-xs text-slate-500">{progress.done} processed · {progress.created} saved · {progress.duplicate} duplicate addresses · {progress.invalid} invalid · {progress.flagged_company} company identity flags</p>
            <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr className="border-b text-slate-500"><th className="p-2">Contact</th><th className="p-2">Company</th><th className="p-2">Email</th></tr></thead><tbody>
              {rows.slice(0,8).map((r,i)=><tr className="border-b" key={i}><td className="p-2">{r.full_name}</td><td className="p-2">{r.company_name}</td><td className="p-2">{r.email}</td></tr>)}
            </tbody></table></div>
          </>}
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <ShieldCheck className="h-4 w-4 shrink-0"/> Importing does not verify email deliverability or permission to contact. Prospects remain blocked from draft generation until you review them. No AI enrichment provider is charged.
          </div>
        </section>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1.05fr),minmax(0,0.95fr)] gap-4">
          <section className={box + " space-y-3"}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="font-semibold">{folder==="flagged_company"?"Possible company matches · review folder":"Review prospects"}</h3><p className="text-xs text-slate-500">Page {page+1} · {folder==="flagged_company"?"Company-identity concerns are blocked from drafts until resolved":"Approve only correctly matched contacts before creating personal drafts"}</p></div>
              <button type="button" className={secondary} disabled={working} onClick={()=>fetchLeads(page)}>
                <RefreshCw className={"w-4 h-4 "+(working?"animate-spin":"")}/> Refresh
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr),auto]">
              <label className="sr-only" htmlFor="outreach-review-search">Search this page of contacts</label>
              <input id="outreach-review-search" className={input} value={reviewSearch}
                placeholder="Find a contact on this page…" onChange={e=>setReviewSearch(e.target.value)}/>
              <label className="sr-only" htmlFor="outreach-review-filter">Review status</label>
              <select id="outreach-review-filter" className={input} value={reviewFilter}
                onChange={e=>setReviewFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="needs_review">Needs review</option>
                <option value="flagged_company">Company match flagged</option>
                <option value="approved">Approved</option>
                <option value="excluded">Excluded</option>
                <option value="suppressed">Suppressed</option>
              </select>
            </div>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={approvedOnPage.length>0 && approvedOnPage.every(l=>selected.includes(l.id))}
                onChange={(e)=>setSelected(e.target.checked?approvedOnPage.map(l=>l.id):[])}/>
              Select all {approvedOnPage.length} approved contacts on this page
            </label>
            <p className="text-[11px] text-slate-500">{filteredLeads.length} shown on this page of {leads.length}. Search and filters apply to this page only.</p>
            {!leads.length && <p className="text-sm text-slate-500 py-8 text-center">No contacts found for this brand. Import a spreadsheet to begin.</p>}
            <div className="max-h-[660px] overflow-y-auto divide-y">
              {filteredLeads.map(lead=><div key={lead.id} className={"py-3 flex gap-3 items-start "+(lead.review_status==="flagged_company"?"bg-amber-50/50":"")}> 
                <input type="checkbox" className="mt-1" aria-label={"Select "+(lead.full_name||lead.email)} disabled={lead.review_status!=="approved"} checked={selected.includes(lead.id)}
                  onChange={(e)=>setSelected(v=>e.target.checked?[...v,lead.id]:v.filter(id=>id!==lead.id))}/>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-slate-900">{lead.full_name || "Name missing"} <span className="text-slate-500 font-normal">{lead.job_title}</span></p>
                  <p className="text-xs text-slate-600">{lead.company_name || "Company missing"} · {lead.email}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{lead.company_match_reason||lead.review_note}</p>
                  {!!lead.company_match_candidate_name&&<p className="text-[11px] text-amber-800 mt-1">Similar business: {lead.company_match_candidate_name}{lead.company_match_candidate_domain?" · "+lead.company_match_candidate_domain:""}</p>}
                  {!!lead.name_suggestion&&<p className="text-[11px] text-amber-800 mt-1">Unverified email-name hint: {lead.name_suggestion}</p>}
                  <p className="text-[11px] text-slate-400">Source: {lead.source_file || "unknown"} · Verification: {lead.verification_status || "unknown"}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className={"text-[11px] rounded-lg px-2 py-1 " +
                    (lead.review_status === "approved" ? "bg-emerald-50 text-emerald-700":
                      lead.review_status==="suppressed"?"bg-red-50 text-red-700":lead.review_status==="flagged_company"?"bg-amber-100 text-amber-800":"bg-slate-100 text-slate-700")}>{lead.review_status==="flagged_company"?"Company mismatch":lead.review_status}</span>
                  {lead.review_status!=="suppressed" && <div className="flex flex-wrap gap-1">
                    <button className="text-xs underline text-amber-800" type="button"
                      onClick={()=>setInspectingLead(lead)}>Check company / person</button>
                    {lead.review_status!=="approved" && lead.review_status!=="flagged_company" &&
                      <button className="text-xs underline text-emerald-700" disabled={working}
                      onClick={()=>changeReview(lead,"approved")}>Approve</button>}
                    {lead.review_status!=="excluded" && <button className="text-xs underline text-slate-500" disabled={working}
                      onClick={()=>changeReview(lead,"excluded")}>Exclude</button>}
                  </div>}
                </div>
              </div>)}
            </div>
            <div className="flex justify-between items-center">
              <button className={secondary} disabled={working || page===0} type="button" onClick={()=>fetchLeads(page-1)}><ArrowLeft className="w-4 h-4"/> Back</button>
              <button className={secondary} disabled={working || nextPage===null} type="button" onClick={()=>fetchLeads(nextPage)}>Next <ArrowRight className="w-4 h-4"/></button>
            </div>
          </section>
          <section className={box + " space-y-4"}>
            <div><h3 className="font-semibold">3. Create personalised drafts</h3>
              <p className="text-xs text-slate-500 mt-1">Choose a saved template or edit a new one. Strict merge fields only; no unsupported research claims.</p></div>
            <label className="block text-xs font-medium">Saved templates
              <select className={input+" mt-1"} value={templateId} onChange={e=>{
                const id=e.target.value;setTemplateId(id);
                const t=templates.find(t=>t.id===id);
                if(t){setSubject(t.subject||"");setBody(t.body_text||"");}
              }}>
                <option value="">Custom unsaved wording</option>
                {templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <p className="text-xs text-slate-600">Safe fields: <code>{"{{greeting}}"}</code> (Hi James / Hello), <code>{"{{first_name}}"}</code>, <code>{"{{last_name}}"}</code>, <code>{"{{company_name}}"}</code>, <code>{"{{job_title}}"}</code>, <code>{"{{verified_company_fact}}"}</code> (only human-approved, cited research).</p>
            <label className="block text-xs font-medium text-slate-700">Subject
              <input className={input + " mt-1"} value={subject} onChange={e=>setSubject(e.target.value)} maxLength={220}/></label>
            <label className="block text-xs font-medium text-slate-700">Body
              <textarea className={input + " mt-1 min-h-44 font-sans leading-relaxed"} value={body} onChange={e=>setBody(e.target.value)} maxLength={8000}/></label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-[11px] text-slate-500">Actual imported contact: {generatedPreview.candidate?.email||"none selected"}</p>
              {generatedPreview.error?<p className="text-xs text-amber-800">{generatedPreview.error}</p>:
                <><p className="text-sm font-semibold">{generatedPreview.subject}</p>
                  <p className="whitespace-pre-wrap text-xs text-slate-700 leading-6">{generatedPreview.body}</p>
                  {!!generatedPreview.candidate?.research_source_url&&
                    generatedPreview.candidate?.research_review_status==="approved"&&
                    <p className="text-[11px] text-slate-500">Research source: {generatedPreview.candidate.research_source_url}</p>}</>}
            </div>
            <button className={primary + " w-full justify-center"} type="button" disabled={working || selected.length===0 || !!generatedPreview.error} onClick={createDrafts}>
              {working ? <Loader2 className="w-4 h-4 animate-spin"/>:<MailPlus className="w-4 h-4"/>}
              Create {selected.length} editable {selected.length===1?"draft":"drafts"}
            </button>
            <div className="flex gap-2 text-xs text-slate-600 bg-amber-50 p-3 rounded-xl"><ShieldCheck className="w-4 h-4 shrink-0"/>
              No emails will be sent, scheduled or automatically approved. Every new draft will appear under My drafts.</div>
          </section>
        </div>
      )}
    </div>
  );
}
