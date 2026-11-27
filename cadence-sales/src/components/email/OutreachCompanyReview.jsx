import React,{useEffect,useRef,useState} from "react";
import {AlertTriangle,BookOpen,CheckCircle2,ExternalLink,ShieldCheck,UserRoundCheck,X,Sparkles} from "lucide-react";
import {base44} from "@/api/base44Client";
import { hasReusableResearch, pickableFindings } from "@/lib/outreachResearchReuse";

const input="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
const label="block text-xs font-medium text-slate-700";
const darkButton="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
const link=(url)=>/^https:\/\/[^/\s]+/i.test(url||'')?url:null;

export default function OutreachCompanyReview({lead,onClose,onSaved}) {
  const [form,setForm]=useState({
    company_name:"",website:"",company_registration_number:"",
    company_source_url:"",review_note:"",research_fact:"",research_source_url:"",
  });
  const [first,setFirst]=useState("");
  const [last,setLast]=useState("");
  const [busy,setBusy]=useState(false);
  const [researchBusy,setResearchBusy]=useState(false);
  const [suggestions,setSuggestions]=useState(null);
  const [campaignFindings,setCampaignFindings]=useState([]);
  const requestEpoch=useRef(0);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    requestEpoch.current += 1;
    setResearchBusy(false);
    if(!lead)return;
    setForm({
      company_name:lead.company_name||"",website:lead.website||lead.company_domain||"",
      company_registration_number:lead.company_registration_number||"",
      company_source_url:lead.company_review_source_url||"",
      review_note:"",research_fact:lead.research_fact||"",
      research_source_url:lead.research_source_url||"",
    });
    setFirst(lead.first_name||"");setLast(lead.last_name||"");
    setError("");setNotice("");setSuggestions(null);
    setCampaignFindings(pickableFindings({ lead }));
  },[lead]);

  // Reuse Prospecting / Dialer AccountResearch — no new research credit.
  useEffect(()=>{
    let cancelled=false;
    if(!lead){setCampaignFindings([]);return undefined;}
    (async()=>{
      let record=null;
      try{
        if(lead.account_research_id){
          record=await base44.entities.AccountResearch.get(lead.account_research_id);
        }else if(lead.prospect_id){
          const rows=await base44.entities.AccountResearch.filter(
            {prospect_id:lead.prospect_id},"-researched_at",3,
          );
          record=rows?.[0]||null;
        }
      }catch{record=null;}
      if(!cancelled)setCampaignFindings(pickableFindings({lead,researchRecord:record}));
    })();
    return()=>{cancelled=true;};
  },[lead]);

  if(!lead)return null;
  const update=(key,value)=>setForm(p=>({...p,[key]:value}));
  const checkedSource=link(form.company_source_url);
  const officialSearch="https://find-and-update.company-information.service.gov.uk/search?q="+encodeURIComponent(lead.company_name||"");
  const run=async(action,body)=>{
    setBusy(true);setError("");setNotice("");
    try {
      const response=await base44.functions.invoke("manageOutreachLeads",{
        action,lead_id:lead.id,...body,
      });
      const data=response.data||response;
      if(!data.ok)throw new Error(data.error||"Could not save review.");
      setNotice(data.message||"Review saved.");
      await onSaved?.();
    }catch(e){setError(e.message||"Review failed.");}
    finally{setBusy(false);}
  };
  const suggestResearch=async()=>{
    if(!window.confirm("Run one web-grounded AI research suggestion for "+(lead.company_name||"this business")+"? This uses one company-research/Smart Action allowance, shares the company name/domain with the research provider, and will NOT automatically add anything to your emails."))return;
    const currentRequest=++requestEpoch.current;
    setResearchBusy(true);setError("");setNotice("");setSuggestions(null);
    try{
      const response=await base44.functions.invoke("suggestOutreachCompanyResearch",{
        action:"suggest",lead_id:lead.id,consent_research:true,
      });
      if(requestEpoch.current!==currentRequest)return;
      const data=response.data||response;
      if(!data.ok)throw new Error(data.error||"Company research unavailable.");
      setSuggestions(data);
      setNotice("Research suggestions retrieved. Open each source and manually verify the company before saving any detail.");
    }catch(e){if(requestEpoch.current===currentRequest)setError(e.message||"Research suggestions unavailable.");}
    finally{if(requestEpoch.current===currentRequest)setResearchBusy(false);}
  };
  const saveCompany=async()=>{
    if(!form.company_source_url.trim()){
      setError("Add a specific HTTPS source confirming the business identity.");return;
    }
    if(!window.confirm("Have you checked the website or Companies House record against this exact business, not a similarly named company? This will release the company flag for a separate contact review."))return;
    await run("resolve_company",form);
  };
  const saveName=async()=>{
    if(!first.trim()){setError("Enter a checked first name, not an email-pattern guess.");return;}
    if(!window.confirm("Did you verify that this is the real name of the person at this business?"))return;
    await run("confirm_contact_name",{first_name:first,last_name:last});
  };

  return <section className="rounded-2xl border-2 border-amber-200 bg-white p-4 sm:p-5 space-y-4" aria-label="Review the company and contact">
    <div className="flex justify-between gap-2 items-start">
      <div>
        <p className="text-xs uppercase tracking-wider font-semibold text-amber-700">Manual identity and research check</p>
        <h3 className="text-lg font-semibold mt-1">{lead.company_name||"Unknown company"}</h3>
        <p className="text-sm text-slate-600">{lead.email}</p>
      </div>
      <button type="button" aria-label="Close company review" onClick={onClose} className="rounded-lg border p-2 hover:bg-slate-50"><X className="w-4 h-4"/></button>
    </div>

    {!!lead.company_match_reason&&<div role="alert" className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
      <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0"/>
      <div className="text-sm text-amber-900"><strong>Possible company mismatch.</strong><p className="mt-1">{lead.company_match_reason}</p>
        {!!lead.company_match_candidate_name&&<p className="mt-2">Potential match: <strong>{lead.company_match_candidate_name}</strong>{lead.company_match_candidate_domain?" · "+lead.company_match_candidate_domain:""}</p>}
      </div>
    </div>}

    <p className="text-xs text-slate-600">Source from import: {lead.source_file||"unknown"} · Name source: {lead.name_source||"unknown"}. A business email domain or similar trading name is a clue, not proof of legal identity.</p>
    <div className="flex flex-wrap gap-3 text-xs">
      <a target="_blank" rel="noopener noreferrer" href={officialSearch} className="inline-flex gap-1 items-center text-emerald-700 underline">
        <ExternalLink className="w-3.5 h-3.5"/> Search UK Companies House</a>
      {checkedSource&&<a target="_blank" rel="noopener noreferrer" href={checkedSource} className="inline-flex gap-1 items-center text-emerald-700 underline">
        <ExternalLink className="w-3.5 h-3.5"/> Open evidence link</a>}
      {link(lead.source_url)&&<a href={lead.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex gap-1 items-center underline text-slate-600">
        Contact source <ExternalLink className="w-3.5 h-3.5"/></a>}
    </div>

    <div className="space-y-3 border-t border-slate-100 pt-4">
      <h4 className="font-semibold flex gap-2 items-center text-sm"><ShieldCheck className="w-4 h-4"/> Check the exact business</h4>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className={label}>Correct company or trading name<input className={input+" mt-1"} value={form.company_name} onChange={e=>update("company_name",e.target.value)} maxLength={180}/></label>
        <label className={label}>Official website/domain<input className={input+" mt-1"} value={form.website} onChange={e=>update("website",e.target.value)} placeholder="https://example.co.uk"/></label>
        <label className={label}>Company registration number (if relevant)<input className={input+" mt-1"} value={form.company_registration_number} onChange={e=>update("company_registration_number",e.target.value)} placeholder="e.g. 01234567"/></label>
        <label className={label}>Evidence URL (required)<input className={input+" mt-1"} value={form.company_source_url} onChange={e=>update("company_source_url",e.target.value)} placeholder="https://..."/></label>
      </div>
      <label className={label}>Why you're confident this is the correct company
        <textarea className={input+" mt-1 min-h-20"} value={form.review_note} onChange={e=>update("review_note",e.target.value)}
          placeholder="Compared company number, registered name and official website; not the similarly named business." maxLength={400}/>
      </label>
      <h4 className="font-semibold flex gap-2 items-center text-sm"><BookOpen className="w-4 h-4"/> Optional source-backed research</h4>
      {hasReusableResearch(campaignFindings) && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
          <p className="text-xs font-semibold text-emerald-900">From campaign / Dialer research</p>
          <p className="text-xs text-emerald-800/90">
            Reuse what Prospecting already captured. Check the source, then copy into the fact below — no extra research credit.
          </p>
          {campaignFindings.map((fact,index)=>(
            <div key={`${fact.label}-${index}`} className="rounded-xl border border-emerald-100 bg-white p-3 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{fact.label}</p>
              <p className="text-sm text-slate-700">{fact.fact}</p>
              {fact.source_url ? (
                <a href={fact.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700 underline inline-flex items-center gap-1">
                  <ExternalLink className="w-3 h-3"/> Check original source
                </a>
              ) : null}
              <button
                type="button"
                onClick={()=>{update("research_fact",fact.fact);update("research_source_url",fact.source_url||"");}}
                className="block rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
              >
                Use this fact
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-600">
            {hasReusableResearch(campaignFindings)
              ? "Need something else? One credit runs a fresh web suggestion. Never auto-inserted."
              : "No campaign research on this contact yet. One credit finds public-company suggestions — never auto-inserted."}
          </p>
          <button type="button" disabled={busy||researchBusy} onClick={suggestResearch}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">
            <Sparkles className="w-3.5 h-3.5 inline mr-1"/>{researchBusy?"Researching…":"Suggest company research"}
          </button>
        </div>
        {suggestions&&<div className="space-y-2 border-t border-slate-200 pt-3">
          <p className="text-xs font-semibold">Identity assessment: {suggestions.identity_status} (AI suggestion, unverified)</p>
          {!!suggestions.identity_warning&&<p className="text-xs text-amber-800">{suggestions.identity_warning}</p>}
          {!!suggestions.suggested_company_name&&<p className="text-xs">Possible identity: {suggestions.suggested_company_name} · {suggestions.suggested_website||"website not found"}</p>}
          {!suggestions.findings?.length&&<p className="text-xs text-slate-600">No safely sourced suggestions for this exact identity. Do not add invented facts.</p>}
          {(suggestions.findings||[]).map((fact,index)=><div key={index} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <p className="text-sm text-slate-700">{fact.fact}</p>
            <a href={fact.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700 underline inline-flex items-center gap-1"><ExternalLink className="w-3 h-3"/> Check original source</a>
            <button type="button" onClick={()=>{update("research_fact",fact.fact);update("research_source_url",fact.source_url);}}
              className="block rounded-lg border px-2 py-1 text-xs font-semibold">Copy into manual review (not yet approved)</button>
          </div>)}
        </div>}
      </div>
      <label className={label}>Specific, supported business fact
        <textarea className={input+" mt-1 min-h-20"} value={form.research_fact} onChange={e=>update("research_fact",e.target.value)}
          placeholder="Only include facts you found on a reliable page about this exact business." maxLength={900}/></label>
      {!!form.research_fact&&<label className={label}>Research citation URL (required for this fact)
        <input className={input+" mt-1"} type="url" value={form.research_source_url} onChange={e=>update("research_source_url",e.target.value)} placeholder="https://..."/></label>}
      <p className="text-xs text-slate-500">UK registered business details are not necessarily evidence of its projects, EV charger needs, annual builds or upcoming tenders. Verify commercial claims separately.</p>
      <button type="button" disabled={busy} onClick={saveCompany} className={darkButton}><CheckCircle2 className="w-4 h-4"/> Confirm company & save source</button>
    </div>

    <div className="space-y-3 border-t border-slate-100 pt-4">
      <h4 className="font-semibold flex gap-2 items-center text-sm"><UserRoundCheck className="w-4 h-4"/> Verify the person</h4>
      {!!lead.name_suggestion&&<p className="rounded-xl p-3 bg-slate-50 text-sm text-slate-700">Email pattern suggests <strong>{lead.name_suggestion}</strong>. This is NOT a confirmed name and will not be used in emails until you check it.</p>}
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>Confirmed first name<input className={input+" mt-1"} value={first} onChange={e=>setFirst(e.target.value)}/></label>
        <label className={label}>Last name<input className={input+" mt-1"} value={last} onChange={e=>setLast(e.target.value)}/></label>
      </div>
      <button type="button" disabled={busy} onClick={saveName} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-slate-50">
        Confirm person's name
      </button>
      <p className="text-xs text-slate-500">If the person's first name genuinely cannot be confirmed, the greeting remains “Hello,” rather than creating a fake personal name or gendered title.</p>
    </div>
    {error&&<p role="alert" className="rounded-xl bg-red-50 text-red-700 text-sm p-3">{error}</p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 text-emerald-800 text-sm p-3">{notice}</p>}
  </section>;
}
