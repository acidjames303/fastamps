// Offline synthetic tests only: no production records, mailboxes or API calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const code = await build({
  entryPoints: ['base44/functions/manageOutreachLeads/entry.ts'],
  bundle: true, platform: 'node', format: 'esm', write: false, target: 'esnext',
  plugins: [{ name: 'mock-cadence-tenant', setup(api) {
    api.onResolve({ filter: /tenantAuth\.ts$/ }, () => ({ path: 'mockTenant', namespace: 'mock' }));
    api.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
      contents: 'export const resolveTenant = async () => globalThis.__mockTenant;',
      loader: 'js',
    }));
  }}],
});
const handler = (await import('data:text/javascript;base64,' + Buffer.from(code.outputFiles[0].text).toString('base64'))).default;

function fakeDatabase() {
  let sequence = 0;
  const records = Object.fromEntries(['OutreachLead', 'Contact', 'OutreachDraft', 'SuppressionEntry']
    .map((key) => [key, []]));
  const equal = (actual, required) => {
    if (required && typeof required === 'object' && '$in' in required) return required.$in.includes(actual);
    return actual === required;
  };
  const service = Object.fromEntries(Object.keys(records).map(name => [name, {
    async filter(where = {}, _sort, count = 500, skip = 0) {
      return records[name].filter(row => Object.entries(where).every(([k, v]) => equal(row[k], v))).slice(skip, skip + count);
    },
    async get(id) { return records[name].find(row => row.id === id) || null; },
    async create(record) { const data = { ...record, id: 'mock-' + ++sequence }; records[name].push(data); return data; },
    async bulkCreate(rows) { const created = rows.map(row => ({ ...row, id: 'mock-' + ++sequence })); records[name].push(...created); return created; },
    async update(id, changes) { const row = records[name].find(item => item.id === id); if (!row) throw new Error('Not found'); Object.assign(row, changes); return row; },
  }]));
  return { records, service };
}

async function fixture(role = 'platform_owner') {
  const db = fakeDatabase();
  globalThis.__mockTenant = {
    base44: { asServiceRole: { entities: db.service } },
    user: { id: 'tester-one' },
    profile: { app_role: role },
    org: { id: 'test-org' },
  };
  async function invoke(params) {
    const req = new Request('https://example.test/api', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    const res = await handler(req);
    return { status: res.status, body: await res.json() };
  }
  return { ...db, invoke };
}

test('role gate blocks reporting-only users', async () => {
  const { invoke } = await fixture('reporting_user');
  const out = await invoke({ action:'list', brand_key:'fastamps' });
  assert.equal(out.status, 403);
});

test('imports 3000 names in bounded batches, no sending, duplicate entries skipped', async () => {
  const { invoke, records } = await fixture();
  const batch = Array.from({ length: 3000 }, (_, i) => ({
    email:'person'+i+'@builder.co.uk', full_name:'Sarah '+i,
    company:'Example House Builders', job_title:'Procurement',
  }));
  let count = 0;
  for(let offset=0;offset<batch.length;offset+=40) {
    const resp = await invoke({ action:'import',brand_key:'fastamps',
      source_file:'synthetic.csv',import_batch_id:'synthetic_batch_123',
      rows:batch.slice(offset,offset+40) });
    assert.equal(resp.status,200);
    count += resp.body.created;
  }
  assert.equal(count,3000);
  assert.equal(records.OutreachLead.length,3000);
  assert.ok(records.OutreachLead.every(v => v.review_status==='needs_review'));
  assert.ok(records.OutreachDraft.length===0);
  const duplicate = await invoke({action:'import',brand_key:'fastamps',
    source_file:'synthetic.csv',import_batch_id:'synthetic_batch_123',rows:batch.slice(0,40)});
  assert.equal(duplicate.body.duplicate,40);
  const firstPage = await invoke({action:'list',brand_key:'fastamps',page:0});
  assert.equal(firstPage.body.leads.length,100);
  const lastPage = await invoke({action:'list',brand_key:'fastamps',page:29});
  assert.equal(lastPage.body.leads.length,100);
});

test('suppression and review gates block unsafe draft creation', async () => {
  const { invoke, records, service } = await fixture();
  const email='sarah@examplebuilders.co.uk';
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email));
  const hash = Buffer.from(digest).toString('hex');
  await service.SuppressionEntry.create({organisation_id:'test-org',normalised_email_hash:hash,status:'active'});
  const first = await invoke({action:'import',brand_key:'fastamps',source_file:'safe.csv',
    import_batch_id:'synthetic_batch_222',rows:[{email,full_name:'Sarah Smith',company:'Example Builders'}]});
  assert.equal(first.body.suppressed,1);
  assert.equal(records.OutreachLead[0].review_status,'suppressed');
  const approval = await invoke({action:'review',lead_id:records.OutreachLead[0].id,review_status:'approved'});
  assert.equal(approval.status,403);
  const generate = await invoke({action:'generate',brand_key:'fastamps',
    lead_ids:[records.OutreachLead[0].id],subject_template:'Hello {{first_name}}',body_template:'Hello {{company}}'});
  assert.equal(generate.status,403);
  assert.equal(records.OutreachDraft.length,0);
});

test('manual review allows merge-field drafts, never sending', async () => {
  const { invoke, records } = await fixture();
  const first = await invoke({action:'import',brand_key:'fastamps',source_file:'fresh.csv',
    import_batch_id:'synthetic_batch_333',rows:[{email:'sarah@examplebuilders.co.uk',full_name:'Sarah Smith',company:'Example Builders'}]});
  assert.equal(first.body.created,1);
  const leadId=records.OutreachLead[0].id;
  const blocked=await invoke({action:'generate',brand_key:'fastamps',lead_ids:[leadId],
    subject_template:'EV charging for {{company_name}}',body_template:'Hi {{first_name}},'});
  assert.equal(blocked.status,403);
  const review=await invoke({action:'review',lead_id:leadId,review_status:'approved'});
  assert.equal(review.status,200);
  const created=await invoke({action:'generate',brand_key:'fastamps',lead_ids:[leadId],
    subject_template:'EV charging for {{company_name}}',body_template:'Hi {{first_name}}, can we talk?'});
  assert.equal(created.body.drafted,1);
  assert.equal(records.OutreachDraft[0].recipient_to,'sarah@examplebuilders.co.uk');
  assert.equal(records.OutreachDraft[0].subject,'EV charging for Example Builders');
  assert.equal(records.OutreachDraft[0].body_text,'Hi Sarah, can we talk?');
  assert.equal(records.OutreachDraft[0].status,'draft');
  const again=await invoke({action:'generate',brand_key:'fastamps',lead_ids:[leadId],
    subject_template:'EV charging for {{company_name}}',body_template:'Hi {{first_name}}'});
  assert.equal(again.body.drafted,0);
  assert.equal(records.OutreachDraft.length,1);
});

test('one user cannot review another user record', async () => {
  const { invoke, records } = await fixture();
  await invoke({action:'import',brand_key:'fastamps',source_file:'fresh.csv',
    import_batch_id:'synthetic_batch_444',
    rows:[{email:'sarah@examplebuilders.co.uk',full_name:'Sarah Smith',company:'Example Builders'}]});
  globalThis.__mockTenant.user.id='tester-two';
  const changed=await invoke({action:'review',lead_id:records.OutreachLead[0].id,review_status:'approved'});
  assert.equal(changed.status,404);
});

test('similar businesses in same import are both quarantined in a company flags folder', async () => {
  const {invoke,records}=await fixture();
  const imported=await invoke({action:'import',brand_key:'fastamps',source_file:'similar-company.csv',
    import_batch_id:'collision_batch_2026',rows:[
      {email:'james.smith@oakwoodhomes.co.uk',first_name:'James',last_name:'Smith',company:'Oakwood Homes',website:'https://oakwoodhomes.co.uk'},
      {email:'jamie.brown@oakwooddevelopments.co.uk',first_name:'Jamie',last_name:'Brown',company:'Oakwood Developments',website:'https://oakwooddevelopments.co.uk'}
    ]});
  assert.equal(imported.status,200);
  assert.equal(imported.body.created,2);
  assert.equal(imported.body.flagged_company,2);
  assert.ok(records.OutreachLead.every(x=>x.review_status==='flagged_company'));
  const folder=await invoke({action:'list',brand_key:'fastamps',page:0,review_status:'flagged_company'});
  assert.equal(folder.body.leads.length,2);
  const noApproval=await invoke({action:'review',lead_id:records.OutreachLead[0].id,review_status:'approved'});
  assert.equal(noApproval.status,403);
  const noDraft=await invoke({action:'generate',brand_key:'fastamps',
    lead_ids:[records.OutreachLead[0].id],
    subject_template:'EV charging {{company_name}}',body_template:'{{greeting}},'});
  assert.equal(noDraft.status,403);
  assert.equal(records.OutreachDraft.length,0);
});

test('conflicting business in later batch reflags previously approved company', async()=>{
  const {invoke,records}=await fixture();
  const a=await invoke({action:'import',brand_key:'fastamps',source_file:'first.csv',
    import_batch_id:'first_batch_2026',rows:[{email:'sarah@thornhillhomes.co.uk',first_name:'Sarah',last_name:'Jones',company:'Thornhill Homes',website:'https://thornhillhomes.co.uk'}]});
  assert.equal(a.body.created,1);
  const approved=await invoke({action:'review',lead_id:records.OutreachLead[0].id,review_status:'approved'});
  assert.equal(approved.status,200);
  const drafted=await invoke({action:'generate',brand_key:'fastamps',
    lead_ids:[records.OutreachLead[0].id],subject_template:'{{company_name}}',
    body_template:'{{greeting}}, are you the right person to speak to?'});
  assert.equal(drafted.body.drafted,1);
  records.OutreachDraft[0].status='approved_hold';
  records.OutreachDraft[0].approval_hash='fakeoldapproval';
  records.OutreachDraft[0].delivery_lock='scheduled_hold';
  records.OutreachDraft[0].scheduled_at='2027-01-01T10:00:00Z';
  const b=await invoke({action:'import',brand_key:'fastamps',source_file:'second.csv',
    import_batch_id:'second_batch_2026',rows:[{email:'henry@thornhilldevelopments.co.uk',first_name:'Henry',last_name:'Smith',company:'Thornhill Developments',website:'https://thornhilldevelopments.co.uk'}]});
  assert.equal(b.body.flagged_company,1);
  assert.equal(records.OutreachLead[0].review_status,'flagged_company');
  assert.equal(records.OutreachLead[1].review_status,'flagged_company');
  assert.equal(records.OutreachDraft[0].status,'draft');
  assert.equal(records.OutreachDraft[0].approval_hash,'');
  assert.equal(records.OutreachDraft[0].scheduled_at,'');
  assert.equal(records.OutreachDraft[0].delivery_lock,'held');
  assert.match(records.OutreachDraft[0].identity_warning,/Company mismatch/);
});

test('manual evidence resolves a flag and only reviewed research fact enters an email',async()=>{
  const {invoke,records}=await fixture();
  await invoke({action:'import',brand_key:'fastamps',source_file:'ambiguous.csv',
    import_batch_id:'research_batch_2026',rows:[
      {email:'james@oakwoodhomes.co.uk',first_name:'James',last_name:'Smith',company:'Oakwood Homes',website:'https://oakwoodhomes.co.uk',
        research_fact:'Has a new 400-home development',research_source_url:'https://oakwoodhomes.co.uk/news'},
      {email:'jamie@oakwooddevelopments.co.uk',first_name:'Jamie',last_name:'Brown',company:'Oakwood Developments',website:'https://oakwooddevelopments.co.uk'},
    ]});
  const lead=records.OutreachLead[0];
  const noResearch=await invoke({action:'generate',brand_key:'fastamps',lead_ids:[lead.id],
    subject_template:'Hi {{first_name}}',body_template:'{{verified_company_fact}}'});
  assert.equal(noResearch.status,403);
  const resolution=await invoke({action:'resolve_company',lead_id:lead.id,
    company_name:'Oakwood Homes',website:'https://oakwoodhomes.co.uk',
    company_registration_number:'01234567',
    company_source_url:'https://find-and-update.company-information.service.gov.uk/company/01234567',
    review_note:'Manually checked the registered company against its domain.',
    research_fact:'Has a new 400-home development',
    research_source_url:'https://oakwoodhomes.co.uk/news'});
  assert.equal(resolution.status,200);
  assert.equal(lead.review_status,'needs_review');
  assert.equal(lead.research_review_status,'approved');
  const review=await invoke({action:'review',lead_id:lead.id,review_status:'approved'});
  assert.equal(review.status,200);
  const drafted=await invoke({action:'generate',brand_key:'fastamps',lead_ids:[lead.id],
    subject_template:'EV charging at {{company_name}}',
    body_template:'{{greeting}}, I saw {{verified_company_fact}}. Are you the right person to discuss charging?'});
  assert.equal(drafted.body.drafted,1);
  assert.match(records.OutreachDraft[0].body_text,/Hi James, I saw Has a new 400-home development/);
  assert.equal(records.OutreachDraft[0].research_source_url,'https://oakwoodhomes.co.uk/news');
  assert.equal(records.OutreachDraft[0].status,'draft');
  assert.equal(records.OutreachLead[1].review_status,'flagged_company');
});

test('first.last address never invents a first name and cannot silently fill template', async()=>{
  const {invoke,records}=await fixture();
  const imported=await invoke({action:'import',brand_key:'fastamps',source_file:'names.csv',
    import_batch_id:'email_name_batch_2026',rows:[{
      email:'james.smith@forgebuilders.co.uk',company:'Forge Builders',website:'https://forgebuilders.co.uk'
    }]});
  assert.equal(imported.body.created,1);
  const lead=records.OutreachLead[0];
  assert.equal(lead.first_name,'');
  assert.equal(lead.name_suggestion,'James Smith');
  const requiresConfirmation=await invoke({action:'review',lead_id:lead.id,review_status:'approved'});
  assert.equal(requiresConfirmation.status,400);
  const allowGeneric=await invoke({action:'review',lead_id:lead.id,review_status:'approved',allow_unknown_name:true});
  assert.equal(allowGeneric.status,200);
  const blocked=await invoke({action:'generate',brand_key:'fastamps',lead_ids:[lead.id],
    subject_template:'Hi {{first_name}}',body_template:'Hi {{first_name}}'});
  assert.equal(blocked.body.drafted,0);
  assert.equal(blocked.body.skipped_missing_data,1);
  const safe=await invoke({action:'generate',brand_key:'fastamps',lead_ids:[lead.id],
    subject_template:'A question for {{company_name}}',
    body_template:'{{greeting}}, can I discuss EV charging at {{company_name}}?'});
  assert.equal(safe.body.drafted,1);
  assert.equal(records.OutreachDraft[0].body_text,'Hello, can I discuss EV charging at Forge Builders?');
});

test('human-confirmed first name is used only after verification and fresh contact review',async()=>{
  const {invoke,records}=await fixture();
  await invoke({action:'import',brand_key:'fastamps',source_file:'namehint.csv',
    import_batch_id:'human_name_batch_2026',rows:[{email:'jamie.brown@hillsidebuilders.co.uk',company:'Hillside Builders',
      website:'https://hillsidebuilders.co.uk'}]});
  const lead=records.OutreachLead[0];
  const confirmed=await invoke({action:'confirm_contact_name',lead_id:lead.id,first_name:'Jamie',last_name:'Brown'});
  assert.equal(confirmed.status,200);
  assert.equal(lead.first_name,'Jamie');
  assert.equal(lead.name_source,'user_confirmed');
  const review=await invoke({action:'review',lead_id:lead.id,review_status:'approved'});
  assert.equal(review.status,200);
  const generated=await invoke({action:'generate',brand_key:'fastamps',lead_ids:[lead.id],
    subject_template:'{{company_name}}',body_template:'{{greeting}}, are you responsible for this?'});
  assert.equal(generated.body.drafted,1);
  assert.equal(records.OutreachDraft[0].body_text,'Hi Jamie, are you responsible for this?');
});
