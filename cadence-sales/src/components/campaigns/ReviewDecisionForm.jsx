import React,{useState} from 'react';
import {Button} from '@/components/ui/button';
const OPTIONS=[['accept_org_supplied','Accept as organisation supplied'],['correct','Correct'],['reject','Reject'],['attach_source','Attach source (does not verify)'],['request_research','Request caller research'],['leave_unresolved','Skip for now']];
export default function ReviewDecisionForm({item,onSave,saving}) {
  const [form,setForm]=useState({decision:'leave_unresolved',notes:'',source_url:item.evidence_url || '',corrected_value:'',classification:item.field==='switchboard'?'switchboard':'unknown'});
  const update=(field,value)=>setForm(old=>({...old,[field]:value}));
  return <div className="mt-3 space-y-2 rounded-xl border border-border bg-muted p-3">
    <p className="text-xs text-muted-foreground">Recommended: {item.suggested_action}</p>
    <select aria-label="Review decision" className="w-full rounded-md border border-input bg-background p-2 text-sm" value={form.decision} onChange={e=>update('decision',e.target.value)}>{OPTIONS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
    {form.decision==='correct'&&<input aria-label="Corrected value" placeholder="Corrected value" className="w-full rounded-md border border-input bg-background p-2 text-sm" value={form.corrected_value} onChange={e=>update('corrected_value',e.target.value)}/>}
    {['phone','switchboard'].includes(item.field)&&<select aria-label="Number classification" className="w-full rounded-md border border-input bg-background p-2 text-sm" value={form.classification} onChange={e=>update('classification',e.target.value)}>{['unknown','mobile','direct_dial','switchboard'].map(x=><option key={x} value={x}>{x.replace(/_/g,' ')}</option>)}</select>}
    <input aria-label="Supporting source" placeholder="Supporting source URL" type="url" className="w-full rounded-md border border-input bg-background p-2 text-sm" value={form.source_url} onChange={e=>update('source_url',e.target.value)}/>
    <input aria-label="Review reason" placeholder="Reason (required for acceptance or correction)" className="w-full rounded-md border border-input bg-background p-2 text-sm" value={form.notes} onChange={e=>update('notes',e.target.value)}/>
    <Button size="sm" disabled={saving} onClick={()=>onSave(form)}>{saving?'Saving…':'Record decision'}</Button>
  </div>;
}