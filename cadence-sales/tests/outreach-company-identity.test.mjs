// Safe offline reference cases. Companies and people below are synthetic test cases.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const built=await build({entryPoints:['base44/shared/outreachIdentity.ts'],bundle:true,platform:'node',format:'esm',write:false});
const id=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));

test('legal suffix and website normalisation preserve trading identity',()=>{
  assert.equal(id.companyKey('Mulberry Homes Ltd'),'mulberry homes');
  assert.equal(id.companyKey('Mulberry Homes Limited'),'mulberry homes');
  assert.equal(id.companyDomain('https://www.mulberry-homes.example/about'),'mulberry-homes.example');
  assert.equal(id.companyNumber('00123456'),'00123456');
  assert.equal(id.companyDomain('https://www.linkedin.com/company/one'),'');
  assert.equal(id.emailDomain('sarah@gmail.com'),'');
});
test('same corporate identity with same name and domain is not falsely quarantined',()=>{
  assert.equal(id.compareCompany(
    {company_name:'Mulberry Homes Ltd',company_domain:'mulberry.example'},
    {company_name:'Mulberry Homes Limited',company_domain:'mulberry.example'}
  ).flag,false);
});
test('similar names but different domains are flagged rather than merged',()=>{
  const match=id.compareCompany(
    {company_name:'Mulberry Homes Ltd',company_domain:'mulberryhomes.example'},
    {company_name:'Mulberry Homes Developments',company_domain:'mulberrydevelopments.example'}
  );
  assert.equal(match.flag,true);
  assert.match(match.reason,/Similar trading names|company name/i);
});
test('same website and different company names are flagged',()=>{
  assert.equal(id.compareCompany(
    {company_name:'Acme Property Group',company_domain:'acme.example'},
    {company_name:'Acme Housebuilding',company_domain:'acme.example'}
  ).flag,true);
});
test('same company name but conflicting UK company numbers is flagged',()=>{
  const result=id.compareCompany(
    {company_name:'Acme Homes Ltd',company_domain:'acme.example',company_registration_number:'01234567'},
    {company_name:'Acme Homes',company_domain:'acme.example',company_registration_number:'07654321'}
  );
  assert.equal(result.flag,true);
  assert.match(result.reason,/registration number/);
});
test('first.last email creates only an unverified suggestion, never first name',()=>{
  const person=id.personFromRow({email:'james.smith@builder.example',company:'Housebuilder'});
  assert.equal(person.first_name,'');
  assert.equal(person.name_suggestion,'James Smith');
  assert.equal(person.name_source,'email_pattern_unverified');
  const content=id.renderPersonalised('{{greeting}}, can we discuss EV chargers at {{company_name}}?',{
    ...person,company_name:'Housebuilder'
  });
  assert.equal(content.text,'Hello, can we discuss EV chargers at Housebuilder?');
  assert.equal(id.renderPersonalised('Hi {{first_name}},',person).ok,false);
});
test('explicit supplied first and last names create accurate greeting without gender inference',()=>{
  const person=id.personFromRow({first_name:'James',last_name:'Smith',email:'james.smith@example.co.uk'});
  assert.equal(person.first_name,'James');
  assert.equal(person.last_name,'Smith');
  assert.equal(person.name_source,'supplied_first_name');
  const res=id.renderPersonalised('{{greeting}}, are you responsible for projects at {{company_name}}?',{
    ...person,company_name:'The Actual Homes'
  });
  assert.equal(res.text,'Hi James, are you responsible for projects at The Actual Homes?');
});
test('company research cannot enter an email without source AND human approval',()=>{
  const lead={first_name:'Jamie',company_name:'Example Builders',
    research_fact:'Has launched a major housing project',research_source_url:'https://example.com/source'};
  assert.equal(id.renderPersonalised('{{verified_company_fact}}',lead).ok,false);
  assert.equal(id.renderPersonalised('{{verified_company_fact}}',{...lead,research_review_status:'approved'}).ok,false);
  const done=id.renderPersonalised('{{verified_company_fact}}',{...lead,research_review_status:'approved',research_reviewed_by_user_id:'owner-1'});
  assert.equal(done.text,lead.research_fact);
  assert.equal(id.renderPersonalised('{{totally_invented_fact}}',lead).ok,false);
});

test('late conflicting company flag blocks earlier approval and exports until reviewed',()=>{
  const original={
    id:'original',company_name:'Oakwood Homes',company_match_token:'oakwood',
    company_domain:'oakwoodhomes.example',company_match_status:'unverified',
    review_status:'approved'
  };
  const conflicting={
    id:'new-conflict',company_name:'Oakwood Developments',
    company_domain:'oakwooddevelopments.example',review_status:'flagged_company',
    created_at:'2026-11-24T16:00:00Z',updated_at:'2026-11-24T16:00:00Z'
  };
  assert.equal(id.hasUnresolvedCompanyFlag(original,[conflicting]),true);
  assert.equal(id.hasUnresolvedCompanyFlag({...original,company_match_status:'manually_confirmed',
    company_review_source_url:'https://example.com/checked',company_reviewed_at:'2026-11-24T17:00:00Z'},[conflicting]),false);
  assert.equal(id.hasUnresolvedCompanyFlag({...original,company_match_status:'manually_confirmed',
    company_review_source_url:'https://example.com/checked',company_reviewed_at:'2026-11-24T15:00:00Z'},[conflicting]),true);
  assert.equal(id.hasUnresolvedCompanyFlag(original,[conflicting],true),true);
});
test('a confirmed business with matching official domain and no competing flag is not blocked',()=>{
  const original={
    id:'one',company_name:'Exact Builders Ltd',
    company_domain:'exactbuilders.example',review_status:'approved'
  };
  assert.equal(id.hasUnresolvedCompanyFlag(original,[]),false);
  assert.equal(id.hasUnresolvedCompanyFlag(original,[{...original,id:'two',
    company_name:'Exact Builders Limited',review_status:'flagged_company'}]),true);
});
