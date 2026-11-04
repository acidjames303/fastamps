import {useMemo,useState} from 'react';
import {PackageCheck,Truck,Download,RefreshCw} from 'lucide-react';
import {toast} from 'sonner';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import SheetSelect from '@/components/ui/sheet-select';

// Shipping allocation, physical dispatch and installer claims are different events.
// Do not imply that a supplied-to wholesaler row confirms a charger was installed.
const isTest=(c)=>Boolean(c.is_demo) || /(^|[ _-])(test|beta|demo|edd)([ _-]|$)/i.test(String(c.batch_reference||'')) ||
  /^(BETA|EDD|FA-BETA)/i.test(String(c.serial_number||''));
const used=(c)=>['submitted','approved'].includes(c.claim_status || 'available');
function saveCsv(chargers) {
  const fields=['serial_number','batch_reference','product_model','supplied_to_name_raw',
    'supplied_to_branch_raw','field_status','field_status_date','claim_status','created_date'];
  const data=[fields,...chargers.map(c=>fields.map(f=>c[f]||''))];
  const text=data.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='FastAmps-Unclaimed-Charger-Register.csv';
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function UnclaimedChargerTracking({chargers=[],onChanged}) {
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('dispatched_unclaimed');
  const [showTests,setShowTests]=useState(false);
  const [busy,setBusy]=useState('');
  const [batch,setBatch]=useState('');
  const live=useMemo(()=>chargers.filter(c=>showTests || !isTest(c)),[chargers,showTests]);
  const metrics=useMemo(()=>{
    const distributed=live.filter(c=>Boolean(c.supplied_to_name_raw));
    const dispatched=live.filter(c=>['dispatched','confirmed_on_site'].includes(c.field_status));
    const pending=live.filter(c=>c.claim_status==='submitted');
    const installed=live.filter(c=>c.claim_status==='approved');
    return {
      total:live.length,allocated:distributed.length,dispatched:dispatched.length,
      unclaimed:dispatched.filter(c=>!used(c)).length,submitted:pending.length,approved:installed.length,
      allocatedUnclaimed:distributed.filter(c=>!used(c)).length,
    };
  },[live]);
  const matches=useMemo(()=>live.filter(c=>{
    if(filter==='dispatched_unclaimed'&&(!['dispatched','confirmed_on_site'].includes(c.field_status)||used(c)))return false;
    if(filter==='allocated_unclaimed'&&(!c.supplied_to_name_raw||used(c)))return false;
    if(filter==='all_unclaimed'&&used(c))return false;
    if(filter==='pending'&&c.claim_status!=='submitted')return false;
    if(filter==='approved'&&c.claim_status!=='approved')return false;
    const value=[c.serial_number,c.batch_reference,c.supplied_to_name_raw,c.supplied_to_branch_raw].join(' ').toLowerCase();
    return value.includes(search.trim().toLowerCase());
  }),[live,filter,search]);
  const batches=useMemo(()=>[...new Set(live.filter(c=>!isTest(c) && c.claim_status==='available' && c.batch_reference)
    .map(c=>c.batch_reference))].sort(),[live]);
  const updateOne=async(charger,status)=>{
    setBusy(charger.id);
    try{
      await base44.entities.Charger.update(charger.id,{
        field_status:status,field_status_date:new Date().toISOString(),
      });
      await onChanged();
      toast.success(status==='dispatched'?'Recorded as dispatched':'Charger field record updated.');
    }catch(err){toast.error(err.message||'Unable to update field status.');}
    finally{setBusy('');}
  };
  const updateBatch=async()=>{
    if(!batch)return;
    setBusy('batch');
    try{
      const result=await base44.entities.Charger.updateMany(
        {batch_reference:batch,claim_status:'available'},{$set:{
          field_status:'dispatched',field_status_date:new Date().toISOString(),
        }});
      await onChanged();
      toast.success('Dispatched status recorded for this batch. Unclaimed chargers now appear in the field report.');
      setBatch('');
    }catch(err){toast.error(err.message||'Batch could not be updated.');}
    finally{setBusy('');}
  };
  return (
    <section className="space-y-4 rounded-3xl border border-border bg-muted/20 p-4 md:p-6">
      <header><h2 className="flex items-center gap-2 text-xl font-semibold"><Truck className="h-5 w-5 text-accent"/>Charger distribution and unclaimed register</h2>
        <p className="mt-1 text-sm text-muted-foreground">Track allocation, recorded dispatch and warranty claims separately. Wholesaler supply data is not proof of physical installation.</p></header>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={showTests} onChange={e=>setShowTests(e.target.checked)}/>
        Include test and demo batches in this report
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Charger records',metrics.total],['Supplied-to allocated',metrics.allocated],
          ['Recorded dispatched',metrics.dispatched],['Dispatched, unclaimed',metrics.unclaimed],
          ['Claim submitted',metrics.submitted],['Approved installs',metrics.approved],
        ].map(([name,value])=><div key={name} className="rounded-xl border border-border bg-background p-3">
          <div className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
          <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{name}</div>
        </div>)}
      </div>
      <p className="text-xs text-muted-foreground">Also awaiting claims: {metrics.allocatedUnclaimed.toLocaleString()} chargers with supplied-to information, whether dispatched or not. Test-labelled batches are {showTests?'included':'excluded'} by default. Only approved installations confirm a completed claim.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 text-xs font-medium">Search unclaimed register
          <Input className="mt-1 min-w-[170px] bg-background" value={search}
            onChange={e=>setSearch(e.target.value)} placeholder="Serial, batch, supplier or branch"/>
        </label>
        <SheetSelect
          className="min-w-[200px]"
          label="View"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'dispatched_unclaimed', label: 'Dispatched, unclaimed' },
            { value: 'allocated_unclaimed', label: 'Allocated, unclaimed' },
            { value: 'all_unclaimed', label: 'All unclaimed' },
            { value: 'pending', label: 'Claims awaiting approval' },
            { value: 'approved', label: 'Approved installations' },
          ]}
        />
        <Button variant="outline" size="sm" onClick={()=>saveCsv(matches)}><Download className="mr-2 h-4 w-4"/>Export {matches.length.toLocaleString()} rows</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="min-w-[850px] w-full text-left text-xs">
          <thead className="bg-muted/60"><tr>{['Serial','Batch','Supplied to','Branch','Dispatch status','Claim status','Action'].map(x=><th key={x} className="px-3 py-2 font-semibold">{x}</th>)}</tr></thead>
          <tbody>{matches.slice(0,80).map(c=><tr key={c.id} className="border-t border-border">
            <td className="px-3 py-2 font-mono">{c.serial_number}</td><td className="px-3 py-2">{c.batch_reference||'—'}</td>
            <td className="px-3 py-2">{c.supplied_to_name_raw||'Not recorded'}</td>
            <td className="px-3 py-2">{c.supplied_to_branch_raw||'—'}</td>
            <td className="px-3 py-2">{(c.field_status||'unconfirmed').replaceAll('_',' ')}</td>
            <td className="px-3 py-2">{c.claim_status||'available'}</td>
            <td className="px-3 py-2">
              {!used(c) && <Button size="sm" variant="outline" disabled={Boolean(busy)}
                onClick={()=>updateOne(c,c.field_status==='dispatched'?'unconfirmed':'dispatched')}>
                {busy===c.id?'Saving…':c.field_status==='dispatched'?'Undo dispatch':'Mark dispatched'}
              </Button>}
            </td>
          </tr>)}</tbody>
        </table>
        {matches.length===0&&<p className="p-4 text-sm text-muted-foreground">No chargers match these filters yet.</p>}
        {matches.length>80&&<p className="border-t border-border p-3 text-xs text-muted-foreground">Showing 80 of {matches.length.toLocaleString()} records. Export CSV to view the full list.</p>}
      </div>
      <div className="rounded-xl border border-border bg-background p-4">
        <h3 className="text-sm font-semibold">Mark an existing batch as dispatched</h3>
        <p className="mt-1 text-xs text-muted-foreground">Use only after confirming these units physically left FastAmps. Existing test-labelled batches are excluded. This marks unclaimed chargers in the selected batch, not approved installations.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <SheetSelect
            className="min-w-[200px] flex-1"
            value={batch}
            onChange={setBatch}
            placeholder="Choose a real batch"
            options={[
              { value: '', label: 'Choose a real batch' },
              ...batches.map((name) => ({ value: name, label: name })),
            ]}
          />
          <Button disabled={!batch||Boolean(busy)} onClick={updateBatch}>
            {busy==='batch'?<RefreshCw className="mr-2 h-4 w-4 animate-spin"/>:<PackageCheck className="mr-2 h-4 w-4"/>}Mark unclaimed units dispatched
          </Button>
        </div>
      </div>
    </section>
  );
}