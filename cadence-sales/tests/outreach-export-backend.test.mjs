import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
const built=await build({entryPoints:["base44/functions/exportOutreachDrafts/entry.ts"],bundle:true,write:false,
  platform:"node",format:"esm",plugins:[{name:"mock-auth",setup(api){
    api.onResolve({filter:/tenantAuth\.ts$/},()=>({path:"fake",namespace:"mock"}));
    api.onLoad({filter:/.*/,namespace:"mock"},()=>({loader:"js",contents:"export async function resolveTenant(){return globalThis.__testExportTenant;}"}));
  }}]});
const handler=(await import("data:text/javascript;base64,"+Buffer.from(built.outputFiles[0].text).toString("base64"))).default;
const tables={OutreachDraft:[],OutreachSignature:[],OutreachWorkspace:[]};
const service=Object.fromEntries(Object.entries(tables).map(([name,values])=>[name,{
  async filter(where,_sort,limit=100,skip=0){
    return values.filter(r=>Object.entries(where).every(([k,v])=>r[k]===v)).slice(skip,skip+limit);
  }
}]));
const testApi=async(userId,brand,page)=>{
  globalThis.__testExportTenant={
    base44:{asServiceRole:{entities:service}},
    user:{id:userId},org:{id:"internal-cadence"},
    profile:{app_role:"organisation_admin"},
  };
  const response=await handler(new Request("https://localhost.invalid",{method:"POST",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({brand_key:brand,page})}));
  return {status:response.status,data:await response.json()};
};
test("same company users export only their own drafts, up to 3000",async()=>{
  for(const k of Object.keys(tables))tables[k].length=0;
  for(let i=0;i<3000;i++)tables.OutreachDraft.push({
    id:"jp-"+i,organisation_id:"internal-cadence",owner_user_id:"jp",
    brand_key:"fastamps",recipient_to:"contact"+i+"@example.com",subject:"Test "+i,body_text:"Body "+i,
  });
  tables.OutreachDraft.push({id:"malcolm-1",organisation_id:"internal-cadence",owner_user_id:"malcolm",brand_key:"fastamps",
    recipient_to:"private@agency.co.uk",subject:"Private",body_text:"Private message"});
  let seen=0;
  for(let page=0;page<31;page++){
    const result=await testApi("jp","fastamps",page);
    assert.equal(result.status,200);
    assert.ok(result.data.drafts.every(x=>x.owner_user_id==="jp"));
    seen+=result.data.drafts.length;
    if(!result.data.has_more)break;
  }
  assert.equal(seen,3000);
  const other=await testApi("malcolm","fastamps",0);
  assert.equal(other.status,200);
  assert.equal(other.data.drafts.length,1);
  assert.equal(other.data.drafts[0].subject,"Private");
});
test("foreign custom workspace is inaccessible even if key known",async()=>{
  tables.OutreachWorkspace.push({id:"custom-1",organisation_id:"internal-cadence",owner_user_id:"jp",brand_key:"custom_1234567890abcdef1234567890abcdef",name:"Private Agency",is_archived:false});
  const other=await testApi("malcolm","custom_1234567890abcdef1234567890abcdef",0);
  assert.equal(other.status,404);
});
