import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Synthetic-only tests. Intercepts tenancy: never calls live Base44 or sends mail.
const result = await build({
  entryPoints:['base44/functions/reviewOutreachDrafts/entry.ts'],
  bundle:true,platform:'node',format:'esm',write:false,
  plugins:[{name:'isolate',setup(api){
    api.onResolve({filter:/tenantAuth\.ts$/},()=>({path:'mock',namespace:'test'}));
    api.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function resolveTenant(){return globalThis.__outreachReviewTenant}',loader:'js'}));
  }}],
});
const handler=(await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))).default;
const db=Object.fromEntries(['OutreachDraft','SuppressionEntry','OutreachSignature','AuditLog'].map(n=>[n,[]]));
let seq=0;
const svc=Object.fromEntries(Object.keys(db).map(name=>[name,{
  async filter(q){return db[name].filter(r=>Object.entries(q).every(([k,v])=>v&&typeof v==='object'&&'$in' in v?v.$in.includes(r[k]):r[k]===v));},
  async get(id){return db[name].find(r=>r.id===id)||null;},
  async create(v){const o={...v,id:'id-'+ ++seq};db[name].push(o);return o;},
  async update(id,v){const r=db[name].find(x=>x.id===id); if(!r)throw Error('missing');Object.assign(r,v);return r;},
}]));
const owner={id:'owner'},org={id:'org'},profile={app_role:'platform_owner'};
async function call(body){
  const res=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}}));
  return {status:res.status,value:await res.json()};
}
async function setup(){
  for(const name of Object.keys(db))db[name]=[];
  seq=0;
  globalThis.__outreachReviewTenant={base44:{asServiceRole:{entities:svc}},user:owner,org,profile};
  const signature=await svc.OutreachSignature.create({organisation_id:'org',owner_user_id:'owner',brand_key:'fastamps',signature_text:'Best,\nJP'});
  const d=await svc.OutreachDraft.create({organisation_id:'org',owner_user_id:'owner',brand_key:'fastamps',recipient_to:'sarah@example.co.uk',recipient_cc:'',recipient_bcc:'',subject:'EV chargers',body_text:'Hi Sarah, can I visit?',quoted_text:'',signature_id:signature.id,status:'draft'});
  return {d,signature};
}
test('owner explicitly approves exact body with signature and content hold',async()=>{
  const {d,signature}=await setup();
  const a=await call({action:'approve',draft_ids:[d.id]});
  assert.equal(a.status,200);
  assert.equal(d.status,'approved_hold');
  assert.ok(/^[0-9a-f]{64}$/.test(d.approval_hash));
  assert.equal(d.approved_by_user_id,'owner');
  const old=d.approval_hash;
  signature.signature_text='Changed signature';
  await call({action:'approve',draft_ids:[d.id]});
  assert.notEqual(d.approval_hash,old);
  assert.equal(db.AuditLog.length,2);
});
test('a suppressed recipient blocks approval for whole batch',async()=>{
  const {d}=await setup();
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('sarah@example.co.uk'));
  await svc.SuppressionEntry.create({organisation_id:'org',normalised_email_hash:Buffer.from(digest).toString('hex'),status:'active'});
  const result=await call({action:'approve',draft_ids:[d.id]});
  assert.equal(result.status,403);
  assert.equal(d.status,'draft');
  assert.equal(db.AuditLog.length,0);
});
test('foreign records are inaccessible',async()=>{
  const {d}=await setup();
  globalThis.__outreachReviewTenant.user={id:'other-user'};
  const result=await call({action:'approve',draft_ids:[d.id]});
  assert.equal(result.status,403);
  assert.equal(d.status,'draft');
});
test('returning to draft invalidates the approval fingerprint',async()=>{
  const {d}=await setup();
  await call({action:'approve',draft_ids:[d.id]});
  const returned=await call({action:'return',draft_ids:[d.id]});
  assert.equal(returned.status,200);
  assert.equal(d.status,'draft');
  assert.equal(d.approval_hash,'');
  assert.equal(d.approved_at,'');
});
