import React, { useCallback, useEffect, useState } from "react";
import { FileText, Plus, Save, Trash2, Upload, Copy, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";

const blank = (brand_key="fastamps") => ({ name:"", subject:"", body_text:"", brand_key, tone:"", source_filename:"" });
const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
const button = "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50";

function parseEmL(text) {
  const match = text.match(/\r?\n\r?\n/);
  if (!match) return {subject:"", body_text:text};
  const headers = text.slice(0, match.index).replace(/\r?\n[ \t]+/g," ");
  const subject = headers.match(/^Subject:\s*(.*)$/im)?.[1] || "";
  const body = text.slice(match.index + match[0].length);
  return {subject,body_text:body};
}
export default function OutreachTemplates({user,brand,brandOptions,onUseTemplate}) {
  const [templates,setTemplates]=useState([]);
  const [form,setForm]=useState(blank(brand));
  const [editingId,setEditingId]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    if(!user?.id || !user?.organisation_id) return;
    try{
      const rows=await base44.entities.OutreachTemplate.filter({
        organisation_id:user.organisation_id,owner_user_id:user.id,brand_key:brand,
      },"-updated_at",300);
      setTemplates(rows||[]);
    }catch(e){setError(e.message||"Could not load templates.");}
  },[user?.id,user?.organisation_id,brand]);
  useEffect(()=>{load();setForm(blank(brand));setEditingId(null);},[load,brand]);

  const save=async(e)=>{
    e.preventDefault();
    if(!form.name.trim()||!form.subject.trim()||!form.body_text.trim()){
      setError("Provide a template name, subject and email body.");return;
    }
    setBusy(true);setError("");setNotice("");
    try{
      const now=new Date().toISOString();
      const payload={
        organisation_id:user.organisation_id,owner_user_id:user.id,brand_key:brand,
        name:form.name.trim().slice(0,150),subject:form.subject.slice(0,220),
        body_text:form.body_text.slice(0,10000),tone:form.tone.slice(0,400),
        source_filename:form.source_filename||"",updated_at:now,
      };
      if(editingId)await base44.entities.OutreachTemplate.update(editingId,payload);
      else await base44.entities.OutreachTemplate.create({...payload,created_at:now});
      setForm(blank(brand));setEditingId(null);setNotice("Template saved for your personal workspace.");
      await load();
    }catch(err){setError(err.message||"Could not save template.");}
    finally{setBusy(false);}
  };
  const remove=async(id)=>{
    if(!window.confirm("Delete this saved template? Your existing drafts will not be changed."))return;
    setBusy(true);setError("");
    try{await base44.entities.OutreachTemplate.delete(id);await load();setNotice("Template deleted.");}
    catch(err){setError(err.message||"Could not delete template.");}
    finally{setBusy(false);}
  };
  const importFile=async(file)=>{
    if(!file)return;
    if(!/\.(txt|md|eml)$/i.test(file.name)){setError("Choose a .txt, .md or .eml template file.");return;}
    if(file.size>100000){setError("Template text files must be 100 KB or smaller.");return;}
    try{
      const contents=await file.text();
      const parsed=/\.eml$/i.test(file.name)?parseEmL(contents):{subject:"",body_text:contents};
      setEditingId(null);
      setForm({
        ...blank(brand),name:file.name.replace(/\.[^.]+$/,""),
        subject:parsed.subject,body_text:parsed.body_text.slice(0,10000),
        source_filename:file.name,
      });
      setNotice("File loaded into the editor. Review the wording and save the template.");
      setError("");
    }catch(err){setError(err.message||"Template could not be read.");}
  };
  const use=(item)=>onUseTemplate?.(item);

  return <div className="grid lg:grid-cols-[minmax(0,1fr),minmax(0,1.2fr)] gap-4">
    <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-3">
      <div className="flex flex-wrap justify-between gap-2 items-center">
        <div><h2 className="text-lg font-semibold">Your templates</h2><p className="text-xs text-slate-500 mt-1">{templates.length} reusable templates for {brandOptions.find(x=>x.key===brand)?.title||brand}</p></div>
        <button type="button" className={button} onClick={()=>{setEditingId(null);setForm(blank(brand));}}>
          <Plus className="w-4 h-4"/> New
        </button>
      </div>
      <button className="text-xs text-slate-500 underline" type="button" onClick={load}><RefreshCw className="w-3.5 h-3.5 inline mr-1"/>Refresh</button>
      {!templates.length&&<p className="bg-slate-50 rounded-xl p-5 text-sm text-slate-500">No templates in this workspace yet. Import a previous sales email or save your own.</p>}
      <div className="space-y-2 max-h-[560px] overflow-y-auto">
        {templates.map(t=><div key={t.id} className={"rounded-xl border p-3 "+(editingId===t.id?"border-emerald-400 bg-emerald-50/30":"border-slate-100")}>
          <div className="flex gap-2 items-start">
            <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"/>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{t.name}</p>
              <p className="text-xs text-slate-500 truncate">{t.subject}</p>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{t.body_text}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" className={button} onClick={()=>{setEditingId(t.id);setForm({...blank(brand),...t});}}>Edit</button>
            <button type="button" className={button} onClick={()=>use(t)}><Copy className="w-3.5 h-3.5"/> Use</button>
            <button type="button" className={button+" text-red-700"} onClick={()=>remove(t.id)} disabled={busy}><Trash2 className="w-3.5 h-3.5"/></button>
          </div>
        </div>)}
      </div>
    </section>
    <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">{editingId?"Edit template":"Save a reusable email"}</h2>
      <p className="text-sm text-slate-500 mt-1">Your templates are private to your Cadence login. Use <code>{"{{first_name}}"}</code> and <code>{"{{company_name}}"}</code> for personalisation.</p>
      <label className="block mt-4 mb-4 rounded-xl border border-dashed border-slate-300 p-3 text-sm cursor-pointer hover:border-emerald-400">
        <Upload className="inline w-4 h-4 mr-2"/> Upload previous email (.txt, .md, .eml)
        <input type="file" className="sr-only" accept=".txt,.md,.eml" onChange={e=>{importFile(e.target.files?.[0]);e.target.value="";}}/>
      </label>
      <form onSubmit={save} className="space-y-3">
        <label className="block text-xs font-medium">Template name
          <input className={input+" mt-1"} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} maxLength={150} placeholder="FastAmps | Housebuilder introduction"/></label>
        <label className="block text-xs font-medium">Subject
          <input className={input+" mt-1"} value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} maxLength={220} placeholder="EV charging for {{company_name}}"/></label>
        <label className="block text-xs font-medium">Email body
          <textarea className={input+" mt-1 min-h-[230px] font-sans"} value={form.body_text}
            onChange={e=>setForm(f=>({...f,body_text:e.target.value}))} maxLength={10000}/></label>
        <label className="block text-xs font-medium">Style instructions (optional)
          <textarea className={input+" mt-1 min-h-[70px]"} value={form.tone} onChange={e=>setForm(f=>({...f,tone:e.target.value}))} maxLength={400}
            placeholder="Short, questions first, offer a site visit"/></label>
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
        {notice&&<p role="status" className="text-sm text-emerald-700">{notice}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-50"><Save className="w-4 h-4 inline mr-1"/> Save template</button>
          {editingId&&<button type="button" className={button} onClick={()=>{setEditingId(null);setForm(blank(brand));}}>Cancel</button>}
        </div>
      </form>
    </section>
  </div>;
}
