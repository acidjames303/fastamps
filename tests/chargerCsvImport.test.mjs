import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {build} from 'esbuild';

// Harness calls the actual Base44 server function with a fake in-memory SDK,
// exercising >1000 records and both preflight and rollback without touching users.
const result=await build({
  entryPoints:['base44/functions/import-charger-batch/entry.ts'],
  bundle:true,write:false,format:'cjs',platform:'neutral',
  external:['npm:@base44/sdk'],logLevel:'silent'
});
let handler=null;
const source=result.outputFiles[0].text;
const sandbox={
  require:(id)=>{assert.equal(id,'npm:@base44/sdk');return {createClientFromRequest:req=>req._db};},
  Deno:{serve:callback=>{handler=callback}},
  console,Response,crypto:webcrypto,URL,Promise,
};
vm.runInNewContext(source,sandbox,{filename:'import-charger-batch.cjs'});
assert.equal(typeof handler,'function');
const existing=Array.from({length:1550},(_,i)=>({
  id:'old-'+i,serial_number:String(100001000+i),pin_code:String(100000+i),
  batch_reference:'PREVIOUS-REGISTER',source_import_id:'past',
}));
let count=2000,failAt=-1,chunkCount=0;
const state={chargers:existing.map(x=>({...x})),history:[]};
const entities={
  list:async(_sort,limit,skip)=>state.chargers.slice(skip,skip+limit),
  bulkCreate:async(data)=>{
    chunkCount++;
    if(chunkCount===failAt)throw Error('Simulated database write failure');
    return data.map(x=>{const obj={...x,id:'new-'+count++};state.chargers.push(obj);return obj});
  },
  deleteMany:async(q)=>{
    const before=state.chargers.length;
    state.chargers=state.chargers.filter(c=>c.source_import_id!==q.source_import_id);
    return {deleted:before-state.chargers.length};
  },
};
const history={
  list:async(_sort,limit,skip)=>state.history.slice(skip,skip+limit),
  bulkCreate:async(data)=>data.map(x=>{const obj={...x,id:'history-'+count++};state.history.push(obj);return obj}),
  deleteMany:async(q)=>{const count=state.history.length;state.history=state.history.filter(x=>x.source_import_id!==q.source_import_id);return {deleted:count-state.history.length}},
};
const db={auth:{me:async()=>({email:'admin@fastamps.com',role:'admin'})},
  asServiceRole:{entities:{Charger:entities,ChargerCodeHistory:history}}};
const run=async(body)=>{
  const reply=await handler({method:'POST',_db:db,json:async()=>body});
  return {status:reply.status,data:await reply.json()};
};
const clean=Array.from({length:1200},(_,i)=>({
  serial_number:String(101000000+i),pin_code:String(300000+i).padStart(6,'0'),product_model:'Alpha 7',
}));
const preflight=await run({action:'validate',rows:clean,batch_reference:'OCT-2026-1200'});
assert.equal(preflight.status,200);
assert.equal(preflight.data.valid,true);
assert.equal(preflight.data.register_checked,1550);
assert.equal(state.chargers.length,1550);
const bad=clean.map(x=>({...x}));
bad[3].pin_code=bad[1].pin_code;
bad[5].serial_number=state.chargers[0].serial_number;
bad[6].pin_code=state.chargers[0].pin_code;
bad[7].pin_code='123';
const conflict=await run({action:'import',rows:bad,batch_reference:'BAD-1200'});
assert.equal(conflict.status,409);
assert(conflict.data.issues.some(x=>x.code==='pin_duplicate_in_file'));
assert(conflict.data.issues.some(x=>x.code==='pin_registered'));
assert(conflict.data.issues.some(x=>x.code==='serial_registered'));
assert(conflict.data.issues.some(x=>x.code==='invalid_pin'));
assert.equal(state.chargers.length,1550);
const importOk=await run({action:'import',rows:clean,batch_reference:'OCT-2026-1200'});
assert.equal(importOk.status,200,JSON.stringify(importOk.data).slice(0,200));
assert.equal(importOk.data.created_count,1200);
assert.equal(state.chargers.length,2750);
assert.equal(state.history.length,1200);
assert.equal(new Set(state.chargers.slice(1550).map(x=>x.pin_code)).size,1200);
const replay=await run({action:'import',rows:clean,batch_reference:'OCT-2026-1200'});
assert.equal(replay.status,409);
assert.equal(state.chargers.length,2750);
const next=Array.from({length:340},(_,i)=>({serial_number:String(102000000+i),
  pin_code:String(400000+i).padStart(6,'0')}));
failAt=3;chunkCount=0;
const rollback=await run({action:'import',rows:next,batch_reference:'ROLLBACK-340'});
assert.equal(rollback.status,409);
assert.equal(rollback.data.rolled_back,true);
assert.equal(state.chargers.length,2750);
assert.equal(state.history.length,1200,'Rollback also cleans incomplete PIN history');
const previouslyUsed={...state.chargers[1550]};
state.chargers=state.chargers.filter(x=>x.id!==previouslyUsed.id);
const deletedPin=await run({action:'validate',rows:[{
  serial_number:'155000000',pin_code:previouslyUsed.pin_code,
}],batch_reference:'PIN-HISTORY-TEST'});
assert.equal(deletedPin.status,409,'Historical deleted pins must not be reused');
assert(deletedPin.data.issues.some(x=>x.code==='pin_registered'));
const single=await run({action:'import',single:true,rows:[{serial_number:'104000000',pin_code:'000017'}],
  batch_reference:'Single charger test'});
assert.equal(single.status,200);
assert.equal(single.data.created_count,1);
console.log(JSON.stringify({
  passed:true,existing_register:1550,large_csv:1200,conflict_codes:[...new Set(conflict.data.issues.map(x=>x.code))],
  duplicate_retry_rejected:true,partial_failure_rolled_back:true,leading_zero_pin_saved:true,
}));
