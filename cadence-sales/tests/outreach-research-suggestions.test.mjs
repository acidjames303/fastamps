// No real research provider or credits are used. Synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const scripts={
  tenant:"export async function resolveTenant(){return globalThis.__companyResearchTenant;}",
  provider:"export function assertProviderAccess(){globalThis.__providerChecked++;}",
  allowance:"export async function checkAllowance(){globalThis.__allowanceChecked++;};export async function recordUsage(){globalThis.__usageRecorded++;return {recorded:true};}",
};
const built=await build({entryPoints:['base44/functions/suggestOutreachCompanyResearch/entry.ts'],
  bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'fake-external',setup(api){
    api.onResolve({filter:/tenantAuth\.ts$/},()=>({path:'tenant',namespace:'mock'}));
    api.onResolve({filter:/providerAccess\.ts$/},()=>({path:'provider',namespace:'mock'}));
    api.onResolve({filter:/costControl\.ts$/},()=>({path:'allowance',namespace:'mock'}));
    api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:scripts[args.path],loader:'js'}));
  }}]});
const handler=(await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'))).default;

function fixture(response){
  const lead={id:'contact-1',organisation_id:'org',owner_user_id:'user-1',
    company_name:'Oakwood Homes',company_domain:'oakwoodhomes.co.uk',
    company_match_candidate_name:'Oakwood Developments',company_match_candidate_domain:'oakwooddevelopments.co.uk'};
  let writes=0;
  globalThis.__allowanceChecked=0;globalThis.__usageRecorded=0;globalThis.__providerChecked=0;
  globalThis.__companyResearchTenant={
    org:{id:'org'},user:{id:'user-1'},profile:{app_role:'platform_owner'},
    base44:{asServiceRole:{
      entities:{OutreachLead:{async get(id){return id===lead.id?lead:null},async update(){writes++;throw Error('unexpected write');}}},
      integrations:{Core:{async InvokeLLM(){return response}}},
    }},
  };
  const call=async input=>{
    const result=await handler(new Request('https://mock.invalid/research',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)
    }));
    return {status:result.status,data:await result.json()};
  };
  return {call,writes:()=>writes};
}
test('refuses AI research without deliberate consent and does not debit a credit',async()=>{
  const f=fixture({identity_status:'clear',findings:[]});
  const resp=await f.call({action:'suggest',lead_id:'contact-1'});
  assert.equal(resp.status,400);
  assert.equal(globalThis.__allowanceChecked,0);
  assert.equal(globalThis.__usageRecorded,0);
  assert.equal(f.writes(),0);
});
test('cannot research another account owner company',async()=>{
  const f=fixture({identity_status:'clear',findings:[]});
  globalThis.__companyResearchTenant.user.id='other';
  const resp=await f.call({action:'suggest',lead_id:'contact-1',consent_research:true});
  assert.equal(resp.status,404);
  assert.equal(globalThis.__allowanceChecked,0);
});
test('clear research returns unverified, source-linked suggestions but never writes a fact',async()=>{
  const f=fixture({
    identity_status:'clear',suggested_company_name:'Oakwood Homes',suggested_website:'https://oakwoodhomes.co.uk',
    findings:[{fact:'A particular new construction project was announced',source_url:'https://oakwoodhomes.co.uk/news/project'},
      {fact:'Not backed by a URL',source_url:'javascript:alert(1)'}],
  });
  const resp=await f.call({action:'suggest',lead_id:'contact-1',consent_research:true});
  assert.equal(resp.status,200);
  assert.equal(resp.data.verified,false);
  assert.equal(resp.data.human_review_required,true);
  assert.equal(resp.data.findings.length,1);
  assert.equal(resp.data.findings[0].source_url,'https://oakwoodhomes.co.uk/news/project');
  assert.equal(globalThis.__allowanceChecked,1);
  assert.equal(globalThis.__usageRecorded,1);
  assert.equal(f.writes(),0);
});
test('ambiguous company receives no purported research findings',async()=>{
  const f=fixture({
    identity_status:'ambiguous',identity_warning:'Two companies have similar names',
    findings:[{fact:'Unsupported project',source_url:'https://oakwoodhomes.co.uk/news'}],
  });
  const resp=await f.call({action:'suggest',lead_id:'contact-1',consent_research:true});
  assert.equal(resp.status,200);
  assert.equal(resp.data.identity_status,'ambiguous');
  assert.equal(resp.data.findings.length,0);
  assert.equal(f.writes(),0);
});
