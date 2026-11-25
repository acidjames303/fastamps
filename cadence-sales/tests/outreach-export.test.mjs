import test from 'node:test';
import assert from 'node:assert/strict';
import { draftsToCsv,draftsToMbox,draftsToAppleScript } from '../src/lib/outreachExport.js';

const example=(i)=>({
  id:'draft-'+i,brand_key:'fastamps',recipient_to:'person'+i+'@example.co.uk',
  recipient_cc:'',recipient_bcc:'',subject:'Question '+i,
  body_text:'Hi Sarah,\n\nWould you be available to talk?',quoted_text:'',
  signature_text:'Regards,\nJP',status:'approved_hold',scheduled_at:'',
});
test('CSV exports 3000 full drafts with safe escaping',()=>{
  const items=Array.from({length:3000},(_,i)=>example(i));
  const csv=draftsToCsv(items);
  assert.ok(csv.startsWith('\ufeff'));
  assert.equal(csv.match(/person\d+@example\.co\.uk/g).length,3000);
  assert.ok(csv.includes('person2999@example.co.uk'));
  const malicious=draftsToCsv([{...example(0),subject:'=SUM(A1:A2)'}]);
  assert.ok(malicious.includes("'=SUM(A1:A2)"));
});
test('MBOX archive includes all subjects and is not a send script',()=>{
  const mbox=draftsToMbox([example(1),example(2)]);
  assert.equal((mbox.match(/^From /gm)||[]).length,2);
  assert.match(mbox,/X-Unsent: 1/);
  assert.match(mbox,/Subject: Question 2/);
});
test('AppleScript test batch redirects exactly 10 messages to personal address',()=>{
  const items=Array.from({length:10},(_,i)=>example(i));
  const script=draftsToAppleScript(items,{testMode:true,testAddress:'jp+qa@personal.co.uk'});
  assert.equal((script.match(/make new outgoing message/g)||[]).length,10);
  assert.equal((script.match(/jp\+qa@personal\.co\.uk/g)||[]).length,10);
  assert.ok(!script.includes('make new to recipient at end of to recipients with properties {address:"person'));
  assert.ok(!/\bsend\s+(?:draftMessage|the|message)\b/i.test(script));
  assert.match(script,/default button "Cancel"/);
  assert.match(script,/save draftMessage/);
});
test('AppleScript escapes quote and backslash and limits batches',()=>{
  const bad={...example(1),body_text:'Hello "friend" \\\\ path\nnext line'};
  const script=draftsToAppleScript([bad]);
  assert.match(script,/\\"friend\\"/);
  assert.match(script,/ & return & /);
  assert.throws(()=>draftsToAppleScript(Array.from({length:51},(_,i)=>example(i))),/1–50/);
  assert.throws(()=>draftsToAppleScript([bad],{testMode:true,testAddress:'not-an-address'}),/test address/);
});
