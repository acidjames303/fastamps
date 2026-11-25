import React,{useState,useEffect,useRef} from "react";
import {Archive,Download,FileSpreadsheet,Mail,ShieldCheck,RefreshCw} from "lucide-react";
import {base44} from "@/api/base44Client";
import {draftsToCsv,draftsToMbox,draftsToAppleScript,downloadText} from "@/lib/outreachExport";

const button="inline-flex items-center gap-2 border border-slate-200 rounded-xl bg-white px-3 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-slate-50";
export default function OutreachExports({brand,brandLabel}) {
  const [drafts,setDrafts]=useState([]);
  const exportableDrafts=drafts.filter(d=>!d.identity_warning);
  const blockedCount=drafts.length-exportableDrafts.length;
  const [loading,setLoading]=useState(false);
  const [progress,setProgress]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [testAddress,setTestAddress]=useState("");
  const [batchIndex,setBatchIndex]=useState(0);
  const runId=useRef(0);
  useEffect(()=>{runId.current+=1;setDrafts([]);setLoading(false);setProgress("");setBatchIndex(0);setError("");setNotice("");},[brand]);
  const retrieve=async()=>{
    const id=++runId.current;
    setLoading(true);setDrafts([]);setError("");setNotice("");
    const output=[];
    try{
      for(let page=0;page<201;page++){
        const response=await base44.functions.invoke("exportOutreachDrafts",{brand_key:brand,page});
        if(runId.current!==id)return;
        const data=response.data||response;
        if(!data.ok)throw new Error(data.error||"Could not retrieve your drafts.");
        output.push(...(data.drafts||[]));
        setProgress(output.length.toLocaleString()+" drafts loaded...");
        if(!data.has_more){setDrafts(output);setProgress(output.length.toLocaleString()+" drafts available for export.");return;}
      }
      throw new Error("Campaign exceeded the export limit. Export in smaller groups.");
    }catch(e){if(runId.current===id)setError(e.message||"Could not load drafts.");}
    finally{if(runId.current===id)setLoading(false);}
  };
  const exportCsv=()=>downloadText("cadence-"+brand+"-drafts.csv",draftsToCsv(drafts),"text/csv;charset=utf-8");
  const exportMbox=()=>downloadText("cadence-"+brand+"-archive.mbox",draftsToMbox(drafts),"application/mbox");
  const exportScript=(testMode=false,count=10)=>{
    try{
      const subset=testMode?exportableDrafts.slice(batchIndex*50,batchIndex*50+count):
        exportableDrafts.slice(batchIndex*50,batchIndex*50+50);
      if(!subset.length)throw Error("Load drafts and select a populated batch first.");
      if(!window.confirm((testMode?"Create "+subset.length+" Apple Mail TEST drafts addressed only to "+testAddress:
        "Create "+subset.length+" Apple Mail drafts addressed to the original contacts")+
        "?\n\nThe downloaded script never sends mail. Inspect it in Script Editor and test with ONE first."))return;
      const content=draftsToAppleScript(subset,{testAddress,testMode});
      downloadText("cadence-"+brand+(testMode?"-test":"-drafts")+"-"+(batchIndex+1)+".applescript",content,"text/plain;charset=utf-8");
      setNotice("AppleScript downloaded. It has NOT been run; no draft created in Mac Mail and no email sent.");
    }catch(e){setError(e.message||"Could not prepare Apple Mail script.");}
  };
  const numberOfBatches=Math.max(1,Math.ceil(exportableDrafts.length/50));
  return <section className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-6 space-y-4">
    <div>
      <h2 className="text-lg font-semibold">Download and test your drafts</h2>
      <p className="text-sm text-slate-500 mt-1">Your {brandLabel||brand} exports are private to your account. Download up to thousands of drafts in one CSV or MBOX archive. Apple Mail script packs are deliberately limited to 50 at a time.</p>
    </div>
    <div className="flex items-center gap-3 flex-wrap">
      <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm disabled:opacity-50" disabled={loading} onClick={retrieve} type="button">
        <RefreshCw className={"w-4 h-4 "+(loading?"animate-spin":"")}/> Load all my drafts
      </button>
      <p className="text-xs text-slate-500">{progress||"No draft content loaded"}</p>
    </div>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="text-sm text-emerald-700">{notice}</p>}
    {blockedCount>0&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{blockedCount} draft(s) have company-identity warnings. They remain available in audit CSV/MBOX downloads but are excluded from Mac Mail script packs until the company is resolved and the draft regenerated.</p>}
    <div className="grid sm:grid-cols-2 gap-3">
      <button type="button" className={button} disabled={!drafts.length||loading} onClick={exportCsv}>
        <FileSpreadsheet className="w-4 h-4"/> Download {drafts.length.toLocaleString()} as CSV
      </button>
      <button type="button" className={button} disabled={!drafts.length||loading} onClick={exportMbox}>
        <Archive className="w-4 h-4"/> Download MBOX archive
      </button>
    </div>
    <div className="rounded-xl bg-slate-50 p-4 space-y-3 border border-slate-100">
      <h3 className="font-semibold text-sm">Mac Mail drafts bridge</h3>
      <p className="text-xs text-slate-600">Open the generated script in macOS Script Editor, inspect it and run it locally. It creates draft messages but never sends them. Apple Mail may request automation permissions, and you must check the From account for every draft.</p>
      <label className="text-xs font-medium flex flex-wrap items-center gap-2">Script batch
        <select className="rounded-lg border px-3 py-2 bg-white text-sm" value={batchIndex} onChange={e=>setBatchIndex(Number(e.target.value))} disabled={!exportableDrafts.length}>
          {Array.from({length:numberOfBatches},(_,i)=><option key={i} value={i}>Drafts {i*50+1}–{Math.min(exportableDrafts.length,(i+1)*50)}</option>)}
        </select>
      </label>
      <button type="button" className={button} disabled={!exportableDrafts.length||loading} onClick={()=>exportScript(false)}>
        <Download className="w-4 h-4"/> Download unsent AppleScript pack (up to 50)
      </button>
      <div className="border-t border-slate-200 pt-3 space-y-2">
        <h4 className="text-sm font-semibold">Test before sending to prospects</h4>
        <label className="block text-xs font-medium">Your personal test email
          <input className="block mt-1 rounded-xl border w-full max-w-md px-3 py-2 text-sm" type="email" value={testAddress}
            onChange={e=>setTestAddress(e.target.value)} placeholder="your-own-inbox@example.co.uk"/>
        </label>
        <p className="text-xs text-slate-500">The test pack redirects 1 or 10 example emails to your own address, adds [TEST] and removes original CC/BCC recipients. Nothing goes to the real prospects.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={!exportableDrafts.length||loading} onClick={()=>exportScript(true,1)}><Mail className="w-4 h-4"/> One test draft</button>
          <button type="button" className={button} disabled={!exportableDrafts.length||loading} onClick={()=>exportScript(true,10)}><Mail className="w-4 h-4"/> 10-test batch pack</button>
        </div>
        <p className="text-xs text-amber-700">To receive the test emails, you still need to manually send the resulting drafts from Apple Mail. Direct automated test sends will require an authorised sender mailbox and independent send-function tests.</p>
      </div>
    </div>
    <div className="flex gap-2 bg-amber-50 rounded-xl p-3 text-xs text-amber-800">
      <ShieldCheck className="w-4 h-4 shrink-0"/>
      An MBOX archive imports into Apple Mail's imported mailbox, not automatically into Drafts. Neither a file download nor a scheduled hold is a send instruction.
    </div>
  </section>;
}
