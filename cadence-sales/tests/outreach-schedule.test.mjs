import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHeldPlan} from '../src/lib/outreachSchedule.js';

test('3000 held dates respect 40/day and UK working hours',()=>{
  const drafts=Array.from({length:3000},(_,i)=>({id:'draft-'+i}));
  const plan=buildHeldPlan(drafts,'2026-11-25T09:30',40,'Europe/London');
  assert.equal(plan.length,3000);
  const byDay=new Map();
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'short',
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  for(const slot of plan){
    const parts=Object.fromEntries(formatter.formatToParts(new Date(slot.scheduled_at)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
    assert.ok(!['Sat','Sun'].includes(parts.weekday));
    const time=Number(parts.hour)*60+Number(parts.minute);
    assert.ok(time>=9*60+30&&time<=16*60+30);
    const key=parts.year+'-'+parts.month+'-'+parts.day;
    byDay.set(key,(byDay.get(key)||0)+1);
  }
  assert.equal(byDay.size,75);
  assert.ok([...byDay.values()].every(n=>n<=40));
  assert.ok(new Date(plan[0].scheduled_at)<new Date(plan[2999].scheduled_at));
});
test('winter UK time is UTC and summer UK time converts via DST',()=>{
  const d=[{id:'one'}];
  const winter=buildHeldPlan(d,'2026-11-25T10:34',40,'Europe/London');
  assert.equal(winter[0].scheduled_at,'2026-11-25T10:34:00.000Z');
  const summer=buildHeldPlan(d,'2027-06-07T10:34',40,'Europe/London');
  assert.equal(summer[0].scheduled_at,'2027-06-07T09:34:00.000Z');
});
test('bad schedule constraints are rejected',()=>{
  assert.throws(()=>buildHeldPlan([{id:'one'}],'2026-11-25T20:30',40,'Europe/London'));
  assert.throws(()=>buildHeldPlan([{id:'one'}],'2026-11-25T09:30',200,'Europe/London'));
});
