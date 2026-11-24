import React, { useState } from "react";
import { BriefcaseBusiness, Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const defaults = [
  {key:"fastamps",title:"FastAmps"},
  {key:"b2bsalesleads",title:"B2B Sales Leads"},
  {key:"acidjames",title:"Acid James"},
  {key:"other",title:"Other"},
];
const input="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
export default function OutreachWorkspaces({user,customWorkspaces,onReload,onSelect,selectedKey}) {
  const [name,setName]=useState("");
  const [sender,setSender]=useState("");
  const [tone,setTone]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const create=async(e)=>{
    e.preventDefault();setError("");setNotice("");
    const label=name.trim().slice(0,120);
    if(!label){setError("Give the workspace a name.");return;}
    if([...defaults.map(x=>x.title),...customWorkspaces.map(x=>x.name)]
      .some(x=>x.toLowerCase()===label.toLowerCase())){setError("Choose a distinct workspace name.");return;}
    if(customWorkspaces.length>=50){setError("Maximum 50 custom workspaces per user.");return;}
    setBusy(true);
    try{
      const key="custom_"+crypto.randomUUID().replace(/-/g,"");
      await base44.entities.OutreachWorkspace.create({
        organisation_id:user.organisation_id,owner_user_id:user.id,brand_key:key,
        name:label,description:"Personal outreach workspace",sender_address:sender.trim(),
        tone_guidance:tone.trim().slice(0,700),is_archived:false,
        created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
      });
      setName("");setSender("");setTone("");
      setNotice("Personal workspace created. Only your Cadence login can use its contacts, templates and drafts.");
      await onReload?.();
      onSelect?.(key);
    }catch(e){setError(e.message||"Workspace creation failed.");}
    finally{setBusy(false);}
  };
  const archive=async(w)=>{
    if(!window.confirm("Archive "+w.name+"? Existing drafts and templates will be preserved, not deleted."))return;
    setBusy(true);setError("");
    try{
      await base44.entities.OutreachWorkspace.update(w.id,{is_archived:true,updated_at:new Date().toISOString()});
      if(selectedKey===w.brand_key)onSelect?.("other");
      await onReload?.();setNotice("Workspace archived; its drafts have been preserved.");
    }catch(e){setError(e.message||"Could not archive workspace.");}
    finally{setBusy(false);}
  };
  return <div className="grid lg:grid-cols-[1fr,1fr] gap-4">
    <section className="rounded-2xl border bg-white p-5 space-y-3">
      <h2 className="text-lg font-semibold">Your outreach workspaces</h2>
      <p className="text-sm text-slate-500">Each user has their own drafts, contacts, templates, campaigns and signatures. Malcolm can log in and run his own independent outreach.</p>
      {[...defaults,...customWorkspaces.filter(w=>!w.is_archived).map(w=>({...w,key:w.brand_key,title:w.name}))].map(w=>
        <div key={w.key} className={"flex items-center gap-3 rounded-xl border p-3 "+(selectedKey===w.key?"border-emerald-500 bg-emerald-50":"border-slate-100")}>
          <BriefcaseBusiness className="w-4 h-4 text-slate-500"/>
          <div className="min-w-0 flex-1"><p className="font-medium text-sm">{w.title}</p>
            <p className="text-xs text-slate-400">{w.key.startsWith("custom_")?"Your custom workspace":"Default workspace · private to your account"}</p></div>
          <button type="button" className="text-xs underline text-emerald-700" onClick={()=>onSelect?.(w.key)}>Open</button>
          {w.key.startsWith("custom_")&&<button type="button" className="p-1.5 text-red-600" title="Archive" onClick={()=>archive(w)} disabled={busy}><Trash2 className="w-4 h-4"/></button>}
        </div>
      )}
    </section>
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-lg font-semibold">Create another workspace</h2>
      <p className="text-sm text-slate-500 mt-1">For another agency, client, service or personal project. Your colleague can separately create workspaces on their own login.</p>
      <form className="space-y-4 mt-5" onSubmit={create}>
        <label className="block text-xs font-medium">Workspace name<input className={input+" mt-1"} value={name} onChange={e=>setName(e.target.value)} placeholder="New agency or client" maxLength={120}/></label>
        <label className="block text-xs font-medium">Preferred sender email (optional)<input className={input+" mt-1"} value={sender} onChange={e=>setSender(e.target.value)} type="email" placeholder="me@example.co.uk"/></label>
        <p className="text-[11px] text-amber-700">A sender address here is only a label. You must separately authorise a real mailbox before future scheduled delivery or test sending.</p>
        <label className="block text-xs font-medium">Writing style<input className={input+" mt-1"} value={tone} onChange={e=>setTone(e.target.value)} maxLength={700} placeholder="Short, warm, practical, personalised"/></label>
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
        {notice&&<p role="status" className="text-sm text-emerald-700">{notice}</p>}
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-slate-900 text-white rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50"><Plus className="w-4 h-4"/> Create workspace</button>
      </form>
    </section>
  </div>;
}
