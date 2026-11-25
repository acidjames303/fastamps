import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const code=await build({entryPoints:['base44/functions/manageOutreachSchedule/entry.ts'],bundle:true,
  platform:'node',format:'esm',write:false,plugins:[{name:'mock-tenant',setup(api){
    api.onResolve({filter:/tenantAuth\.ts$/},()=>({path:'test',namespace:'fake'}));
    api.onLoad({filter:/.*/,namespace:'fake'},()=>({loader:'js',contents:'export async function resolveTenant(){return globalThis.__scheduleTestAuth;}'}));
  }}]});
const handler=(await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'))).default;
const sha=async text=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex');
function fixture(){
  const tables={OutreachDraft:[],OutreachSignature:[],SuppressionEntry:[]};
  const match=(actual,wanted)=>wanted&&typeof wanted==='object'&&'$in' in wanted?wanted.$in.includes(actual):actual===wanted;
  const entities=Object.fromEntries(Object.entries(tables).map(([key,values])=>[key,{
    async filter(where){return values.filter(row=>Object.entries(where).every(([k,v])=>match(row[k],v)));},
    async update(id,changes){const row=values.find(r=>r.id===id);if(!row)throw Error('Not found');Object.assign(row,changes);return row;},
  }]));
  globalThis.__scheduleTestAuth={
    base44:{asServiceRole:{entities}},
    user:{id:'owner'},org:{id:'org'},profile:{app_role:'sales_manager'},
  };
  const message={id:'draft-1',organisation_id:'org',owner_user_id:'owner',brand_key:'fastamps',provider:'none',
    recipient_to:'sarah@example.co.uk',recipient_cc:'',recipient_bcc:'',subject:'EV chargers',
    body_text:'Hi Sarah',quoted_text:'',signature_id:'',status:'approved_hold',delivery_lock:'held'};
  tables.OutreachDraft.push(message);
  const call=async body=>{
    const response=await handler(new Request('https://fake.invalid',{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
    return {status:response.status,body:await response.json()};
  };
  const approvedFingerprint=async()=>{
    message.approval_hash=await sha(JSON.stringify({
      sender_user_id:message.owner_user_id,brand_key:message.brand_key,provider:message.provider||'none',
      to:['sarah@example.co.uk'],cc:[],bcc:[],subject:message.subject,body_text:message.body_text,
      quoted_text:message.quoted_text,signature_id:message.signature_id||'',signature_text:'',
    }));
  };
  return {tables,message,call,approvedFingerprint};
}
test('scheduled dates remain locked and cannot deliver anything',async()=>{
  const f=fixture();await f.approvedFingerprint();
  const date=new Date(Date.now()+2*86400000).toISOString();
  const result=await f.call({action:'plan',timezone:'Europe/London',drafts:[{id:'draft-1',scheduled_at:date}]});
  assert.equal(result.status,200);
  assert.equal(result.body.delivery_enabled,false);
  assert.equal(f.message.delivery_lock,'scheduled_hold');
  assert.equal(f.message.scheduled_at,date);
  assert.equal(f.message.status,'approved_hold');
  const held=await f.call({action:'hold',timezone:'Europe/London',drafts:[{id:'draft-1'}]});
  assert.equal(held.status,200);
  assert.equal(f.message.delivery_lock,'held');
  assert.equal(f.message.scheduled_at,'');
});
test('unapproved or changed content cannot be scheduled',async()=>{
  const f=fixture();
  const future=new Date(Date.now()+2*86400000).toISOString();
  f.message.status='draft';
  const notApproved=await f.call({action:'plan',timezone:'Europe/London',drafts:[{id:f.message.id,scheduled_at:future}]});
  assert.equal(notApproved.status,403);
  f.message.status='approved_hold';
  await f.approvedFingerprint();
  f.message.subject='Changed without reapproval';
  const changed=await f.call({action:'plan',timezone:'Europe/London',drafts:[{id:f.message.id,scheduled_at:future}]});
  assert.equal(changed.status,409);
  assert.equal(f.message.delivery_lock,'held');
});
test('different owner and suppression deny planning',async()=>{
  const f=fixture();await f.approvedFingerprint();
  const future=new Date(Date.now()+2*86400000).toISOString();
  globalThis.__scheduleTestAuth.user.id='other';
  const foreign=await f.call({action:'plan',timezone:'UTC',drafts:[{id:f.message.id,scheduled_at:future}]});
  assert.equal(foreign.status,403);
  globalThis.__scheduleTestAuth.user.id='owner';
  f.tables.SuppressionEntry.push({organisation_id:'org',normalised_email_hash:await sha('sarah@example.co.uk'),status:'active'});
  const suppressed=await f.call({action:'plan',timezone:'UTC',drafts:[{id:f.message.id,scheduled_at:future}]});
  assert.equal(suppressed.status,403);
});
