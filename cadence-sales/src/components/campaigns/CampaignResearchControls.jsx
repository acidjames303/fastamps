import React,{useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import SelectiveEnrichDialog from '@/components/prospecting/SelectiveEnrichDialog';
import EnrichmentSessionBanner from '@/components/prospecting/EnrichmentSessionBanner';
export default function CampaignResearchControls({listId,prospects=[],intent='general',label='Enrich selected fields',onChanged,initiallyOpen=false}) {
  const [open,setOpen]=useState(initiallyOpen),[connected,setConnected]=useState({}),[session,setSession]=useState(null),[error,setError]=useState('');
  useEffect(()=>{if(!listId)return;let alive=true;
    base44.functions.invoke('getOrgConnectionStatus',{}).then(({data})=>{if(alive)setConnected(data.connected || {});}).catch(e=>setError(e.message));
    base44.entities.EnrichmentSession.filter({prospect_list_id:listId},'-created_date',1).then(rows=>{if(alive)setSession(rows[0]||null);});
    const off=base44.entities.EnrichmentSession.subscribe(event=>{if(event.data?.prospect_list_id!==listId)return;setSession({...event.data,id:event.id});if(['completed','partially_completed','failed'].includes(event.data.status))onChanged?.();});
    return()=>{alive=false;off();};
  },[listId]);
  return <div className="space-y-2"><Button size="sm" variant="outline" onClick={()=>setOpen(true)} disabled={!listId || !prospects.length}>{label}{prospects.length>1?` (${prospects.length})`:''}</Button>{error&&<p className="text-xs text-destructive">{error}</p>}<SelectiveEnrichDialog key={`${intent}-${open}`} open={open} onClose={()=>setOpen(false)} selectedProspects={prospects} allProspects={prospects} listId={listId} connectedProviders={connected} intent={intent} onStarted={data=>setSession({...data,id:data.session_id})}/>{session&&<EnrichmentSessionBanner session={session} onDismiss={()=>setSession(null)} onCancelled={()=>setSession(null)}/>}</div>;
}