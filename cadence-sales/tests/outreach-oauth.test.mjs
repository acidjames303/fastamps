// Offline OAuth tests. Mocked providers, no credentials or external requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const mocks = {
  tenant: "export async function resolveTenant(){return globalThis.__fakeAuth}",
  credentials: "export async function saveOrgCredentials(){};export async function getConnectionStatus(){return {connected:true}}",
  mail: [
    "export const createPkceVerifier=()=> 'synthetic_pkce_secret';",
    "export const pkceChallenge=async()=> 'synthetic_challenge';",
    "export const buildAuthorizeUrl=({state,codeChallenge})=> 'https://accounts.google.com/o/oauth2/v2/auth?state='+state+'&code_challenge='+codeChallenge;",
    "export const encryptTokens=async v=>JSON.stringify(v);",
    "export const decryptTokens=async v=>JSON.parse(v);",
    "export const exchangeCodeForTokens=async p=>{globalThis.__exchangeCalls++;return {access_token:'synthetic',refresh_token:'ref',expires_in:3600,scope:'synthetic_scope'}};",
    "export const fetchMailboxAddress=async()=> 'owner@example.co.uk';",
    "export const getFreshAccessToken=async()=>({accessToken:'synthetic'});",
    "export const getOAuthClient=async()=>({configured:true,clientId:'synthetic',clientSecret:'synthetic'});",
    "export const scopesFor=()=> 'synthetic_scope';",
    "export const createGmailDraft=async()=>({id:'fake'});",
    "export const createOutlookDraft=async()=>({id:'fake'});",
  ].join('\n'),
};
const bundled=await build({
  entryPoints:['base44/functions/manageEmailMailbox/entry.ts'],
  bundle:true,write:false,platform:'node',format:'esm',
  plugins:[{name:'fake-base44-services',setup(api){
    api.onResolve({filter:/tenantAuth\.ts$/},()=>({path:'tenant',namespace:'mock'}));
    api.onResolve({filter:/providerCredentials\.ts$/},()=>({path:'credentials',namespace:'mock'}));
    api.onResolve({filter:/emailMailbox\.ts$/},()=>({path:'mail',namespace:'mock'}));
    api.onLoad({filter:/.*/,namespace:'mock'},(args)=>({contents:mocks[args.path],loader:'js'}));
  }}],
});
const handler=(await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'))).default;
function fixture(){
  const records=[];let n=0;
  const connection={
    async create(v){const r={...v,id:'conn-'+ ++n};records.push(r);return r;},
    async update(id,v){const r=records.find(x=>x.id===id);Object.assign(r,v);return r;},
    async delete(id){const index=records.findIndex(x=>x.id===id);if(index>=0)records.splice(index,1);},
    async filter(q,_s,limit=10){return records.filter(x=>Object.entries(q).every(([k,v])=>x[k]===v)).slice().reverse().slice(0,limit);}
  };
  globalThis.__exchangeCalls=0;
  globalThis.__fakeAuth={base44:{asServiceRole:{entities:{EmailMailboxConnection:connection}}},
    user:{id:'test-user'},profile:{app_role:'platform_owner'},org:{id:'test-org'}};
  const uri='https://preview.example.base44.app/email-connect/callback';
  const call=async (body,origin='https://preview.example.base44.app')=>{
    const res=await handler(new Request('https://function.example/api',{method:'POST',
      headers:{'Content-Type':'application/json','Origin':origin},body:JSON.stringify(body)}));
    return {status:res.status,result:await res.json()};
  };
  return {call,uri,records};
}
test('OAuth state creation rejects wrong origin and wrong redirect path',async()=>{
  const f=fixture();
  assert.equal((await f.call({action:'start_connect',provider:'gmail',redirect_uri:'https://evil.com/cb'})).status,400);
  assert.equal((await f.call({action:'start_connect',provider:'gmail',redirect_uri:'https://preview.example.base44.app/wrong'})).status,400);
  const ok=await f.call({action:'start_connect',provider:'gmail',redirect_uri:f.uri});
  assert.equal(ok.status,200);
  assert.match(ok.result.authorize_url,/code_challenge=synthetic_challenge/);
});
test('incorrect and expired states never exchange tokens',async()=>{
  const f=fixture();
  const start=await f.call({action:'start_connect',provider:'gmail',redirect_uri:f.uri});
  const wrong=await f.call({action:'complete_connect',provider:'gmail',code:'token-code',
    state:'wrong-state',redirect_uri:f.uri});
  assert.equal(wrong.status,400);
  f.records[0].connected_at=new Date(Date.now()-11*60*1000).toISOString();
  const expired=await f.call({action:'complete_connect',provider:'gmail',code:'token-code',
    state:start.result.state,redirect_uri:f.uri});
  assert.equal(expired.status,400);
  assert.equal(globalThis.__exchangeCalls,0);
});
test('valid OAuth session is consumed once and granted scopes are stored',async()=>{
  const f=fixture();
  const start=await f.call({action:'start_connect',provider:'gmail',redirect_uri:f.uri});
  const once=await f.call({action:'complete_connect',provider:'gmail',code:'token-code',
    state:start.result.state,redirect_uri:f.uri});
  assert.equal(once.status,200);
  assert.equal(f.records[0].status,'active');
  assert.equal(f.records[0].scopes,'synthetic_scope');
  const again=await f.call({action:'complete_connect',provider:'gmail',code:'token-code',
    state:start.result.state,redirect_uri:f.uri});
  assert.equal(again.status,400);
  assert.equal(globalThis.__exchangeCalls,1);
});
