import React,{useEffect,useMemo,useRef,useState} from "react";
import {CalendarClock,PauseCircle,RefreshCw,ShieldCheck} from "lucide-react";
import {base44} from "@/api/base44Client";
import {buildHeldPlan} from "@/lib/outreachSchedule";

const button="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-slate-50";
const input="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";
const DEFAULT_DATE=new Date(Date.now()+86400000).toISOString().slice(0,10)+"T09:30";

export default function OutreachSchedule({brand,brandLabel}) {
  const [rows,setRows]=useState([]);
  const requestEpoch=useRef(0);
  const [start,setStart]=useState(DEFAULT_DATE);
  const [timezone,setTimezone]=useState("Europe/London");
  const [maxDaily,setMaxDaily]=useState(40);
  const [loading,setLoading]=useState(false);
  const [status,setStatus]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{requestEpoch.current+=1;setRows([]);setLoading(false);setStatus("");setError("");},[brand]);
  const approved=useMemo(()=>rows.filter(d=>d.status==="approved_hold"),[rows]);
  const planned=useMemo(()=>{try{return buildHeldPlan(approved,start,maxDaily,timezone);}catch{return [];}},[approved,start,maxDaily,timezone]);

  const load=async()=>{
    const epoch=++requestEpoch.current;
    const sourceBrand=brand;
    setLoading(true);setError("");setStatus("");
    const results=[];
    try{
      for(let page=0;page<=200;page++){
        const response=await base44.functions.invoke("exportOutreachDrafts",{brand_key:sourceBrand,page});
        if(requestEpoch.current!==epoch)return;
        const data=response.data||response;
        if(!data.ok)throw Error(data.error||"Could not load personal drafts.");
        results.push(...(data.drafts||[]));
        setStatus(results.length.toLocaleString()+" drafts loaded");
        if(!data.has_more){if(requestEpoch.current===epoch)setRows(results);return;}
      }
      throw Error("Exceeded the draft listing limit.");
    }catch(e){if(requestEpoch.current===epoch)setError(e.message||"Could not load drafts.");}
    finally{if(requestEpoch.current===epoch)setLoading(false);}
  };
  const mutate=async(action)=>{
    const eligible=action==="plan"?approved:rows.filter(d=>d.delivery_lock==="scheduled_hold");
    if(!eligible.length){setError("No eligible drafts found. Load your latest list first.");return;}
    const slots=action==="plan"?buildHeldPlan(eligible,start,Number(maxDaily),timezone):eligible.map(d=>({id:d.id}));
    if(!window.confirm(
      (action==="plan"?"Save future HOLD dates for ":"Return to HOLD for ")+slots.length+
      " draft(s)?\n\nThese plans will NOT send mail. A delivery service is not connected or enabled."))return;
    setLoading(true);setError("");setStatus("");
    try{
      let updated=0;
      for(let i=0;i<slots.length;i+=50){
        const response=await base44.functions.invoke("manageOutreachSchedule",{
          action,timezone,drafts:slots.slice(i,i+50),
        });
        const data=response.data||response;
        if(!data.ok)throw Error(data.error||"Could not save this schedule batch.");
        updated+=data.updated||0;
        setStatus(updated.toLocaleString()+"/"+slots.length.toLocaleString()+" saved on hold");
      }
      setStatus(updated.toLocaleString()+" schedule records saved. Sending remains LOCKED.");
      setRows([]);
    }catch(e){setError((e.message||"Schedule update failed.")+" Completed batches are retained; reload to inspect saved records.");}
    finally{setLoading(false);}
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
    <div>
      <h2 className="text-lg font-semibold">Schedule & hold — {brandLabel||brand}</h2>
      <p className="text-sm text-slate-500 mt-1">Plan dates for up to 3,000+ personally approved messages. Future delivery remains disabled until the mailbox, compliance and reliability release gates pass.</p>
    </div>
    <div className="flex flex-wrap gap-2 items-center">
      <button type="button" className={button} disabled={loading} onClick={load}><RefreshCw className={"w-4 h-4 "+(loading?"animate-spin":"")}/> Load all drafts</button>
      <span className="text-xs text-slate-500">{rows.length.toLocaleString()} loaded · {approved.length.toLocaleString()} content-approved · {rows.filter(x=>x.delivery_lock==="scheduled_hold").length.toLocaleString()} date-planned</span>
    </div>
    <div className="grid sm:grid-cols-3 gap-3">
      <label className="text-xs font-medium">Start date and local time
        <input className={input+" mt-1 w-full"} type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label>
      <label className="text-xs font-medium">Sending timezone
        <select className={input+" mt-1 w-full"} value={timezone} onChange={e=>setTimezone(e.target.value)}>
          <option value="Europe/London">UK (Europe/London)</option>
          <option value="Europe/Zagreb">Europe/Zagreb</option>
          <option value="UTC">UTC</option>
          <option value="America/New_York">New York</option>
        </select></label>
      <label className="text-xs font-medium">Drafts per working day (planning limit)
        <input className={input+" mt-1 w-full"} type="number" value={maxDaily} min={1} max={75} onChange={e=>setMaxDaily(Number(e.target.value))}/></label>
    </div>
    <p className="text-xs text-slate-500">Plans run Monday–Friday, between approximately 09:30 and 16:30 in your chosen timezone. Public holidays, provider sending limits and replies must be checked before any future live sending.</p>
    {!!approved.length&&<div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-sm font-medium">Schedule preview</p>
      <p className="text-xs text-slate-500 mt-1">First: {planned[0]?.scheduled_at?new Date(planned[0].scheduled_at).toLocaleString("en-GB",{timeZone:timezone}):"Choose a valid date"}</p>
      <p className="text-xs text-slate-500">Last: {planned.at(-1)?.scheduled_at?new Date(planned.at(-1).scheduled_at).toLocaleString("en-GB",{timeZone:timezone}):"—"}</p>
      <div className="space-y-1 mt-2">{planned.slice(0,4).map((x,i)=><p key={x.id} className="text-[11px] text-slate-600">
        {i+1}. {new Date(x.scheduled_at).toLocaleString("en-GB",{timeZone:timezone})} · {approved[i]?.subject}</p>)}</div>
    </div>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        disabled={loading||!approved.length||!planned.length} onClick={()=>mutate("plan")}><CalendarClock className="w-4 h-4"/> Save future schedule on HOLD</button>
      <button type="button" className={button} disabled={loading||!rows.some(x=>x.delivery_lock==="scheduled_hold")} onClick={()=>mutate("hold")}>
        <PauseCircle className="w-4 h-4"/> Cancel dates & hold all</button>
    </div>
    {error&&<p role="alert" className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</p>}
    {status&&<p role="status" className="text-sm text-emerald-700">{status}</p>}
    <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
      <ShieldCheck className="w-4 h-4 shrink-0"/> No auto-sending, background queue, retry worker or sender OAuth is enabled. Planned dates are safely stored as held metadata only.
    </div>
  </section>;
}