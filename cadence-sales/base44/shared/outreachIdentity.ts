// Deterministic identity checks. Untrusted web research never becomes a verified fact here.
// Fields from CSV are "supplied", NOT independently checked.
const EMPTY = '';
const PERSONAL = new Set(['gmail.com','googlemail.com','outlook.com','hotmail.com','live.com','yahoo.com','yahoo.co.uk','icloud.com','me.com','aol.com','proton.me','protonmail.com','mail.com']);
const NOT_COMPANY = new Set(['linkedin.com','facebook.com','instagram.com','x.com','twitter.com','tiktok.com','companieshouse.gov.uk','gov.uk']);
const HONORIFICS = new Set(['mr','mrs','ms','miss','dr','prof','sir','madam','mx']);
const VAGUE = new Set(['team','staff','office','sales','support','customer','enquiries','unknown','contact','info','admin','there']);
const LEGAL = new Set(['ltd','limited','plc','llp','inc','incorporated','co','company']);
const STOP = new Set(['the','a','an','uk','gb','england']);
export function safeText(value:unknown,max=200) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}
export function companyKey(value:unknown) {
  const words=safeText(value,250).toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ')
    .replace(/[^\p{L}\p{N}]+/gu,' ').split(/\s+/).filter(Boolean);
  while(words.length>1 && LEGAL.has(words[words.length-1])) words.pop();
  return words.filter(w=>!STOP.has(w)).join(' ');
}
export function companyMatchToken(value:unknown) {
  const words=companyKey(value).split(/\s+/).filter(Boolean);
  return words[0] || EMPTY;
}
export function companyNumber(value:unknown) {
  const id=safeText(value,30).replace(/[\s-]+/g,'').toUpperCase();
  return /^[A-Z]{0,2}\d{6,8}$/.test(id) ? id : '';
}
export function companyDomain(value:unknown) {
  let raw=safeText(value,300).toLowerCase();
  if(!raw)return '';
  if(raw.includes('@')&&!raw.includes('/'))raw=raw.split('@').pop()||'';
  try {
    const url=new URL(/^[a-z]+:\/\//.test(raw)?raw:'https://'+raw);
    if(url.username||url.password||!['http:','https:'].includes(url.protocol))return '';
    const hostname=url.hostname.replace(/\.$/,'').replace(/^www\d?\./,'');
    if(!hostname.includes('.')||hostname==='localhost'||PERSONAL.has(hostname)||NOT_COMPANY.has(hostname))return '';
    return hostname;
  }catch { return ''; }
}
export function emailDomain(address:unknown) {
  const mail=safeText(address,320).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))return '';
  return companyDomain(mail.slice(mail.lastIndexOf('@')+1));
}
function namePiece(value:unknown) {
  const s=safeText(value,100);
  if(!s||/\d|@/.test(s)||VAGUE.has(s.toLowerCase()))return '';
  if(!/^[\p{L}][\p{L}\p{M}\p{Pd}'’.\s]*$/u.test(s))return '';
  return s;
}
export function personFromRow(row:any) {
  const firstField=namePiece(row.first_name);
  const lastField=namePiece(row.last_name);
  let first=firstField, last=lastField;
  let nameSource=firstField?'supplied_first_name':'missing';
  const full=namePiece(row.full_name||row.name);
  if(!first&&full) {
    const parts=full.split(/\s+/).filter(Boolean);
    while(parts.length>1&&HONORIFICS.has(parts[0].replace(/\.$/,'').toLowerCase()))parts.shift();
    if(parts.length && !VAGUE.has(parts[0].toLowerCase())) {
      first=parts[0];last=last||parts.slice(1).join(' ');
      nameSource='supplied_full_name';
    }
  }
  if(!last&&full&&first) {
    const parts=full.split(/\s+/);
    if(parts.length>1 && parts[0].toLowerCase()===first.toLowerCase())last=parts.slice(1).join(' ');
  }
  let suggested='';
  if(!first){
    const local=safeText(row.email||row.work_email,320).split('@')[0]||'';
    const match=local.match(/^([\p{L}]{2,24})[._-]([\p{L}]{2,34})$/u);
    if(match && !VAGUE.has(match[1].toLowerCase())){
      suggested=match[1][0].toUpperCase()+match[1].slice(1)+' '+match[2][0].toUpperCase()+match[2].slice(1);
      nameSource='email_pattern_unverified';
    }
  }
  const fullName=first? [first,last].filter(Boolean).join(' '):'';
  return {first_name:first,last_name:last,full_name:fullName,
    name_source:nameSource,name_suggestion:suggested};
}
function tokens(key:string) {return new Set(key.split(/\s+/).filter(Boolean));}
function tokenOverlap(a:string,b:string) {
  const aa=tokens(a),bb=tokens(b);
  const shared=[...aa].filter(t=>bb.has(t)).length;
  return shared/Math.max(aa.size,bb.size,1);
}
// Flag on uncertainty; never merge just because a name looks similar.
export function compareCompany(a:any,b:any) {
  const nameA=companyKey(a.company_name||a.company_name_normalized);
  const nameB=companyKey(b.company_name||b.company_name_normalized);
  const domainA=companyDomain(a.company_domain||a.website||'');
  const domainB=companyDomain(b.company_domain||b.website||'');
  const numberA=companyNumber(a.company_registration_number);
  const numberB=companyNumber(b.company_registration_number);
  if(!nameA||!nameB)return {flag:false,reason:''};
  if(numberA&&numberB&&numberA!==numberB && (nameA===nameB||domainA&&domainA===domainB)) {
    return {flag:true,reason:'Similar name or website, but different company registration numbers'};
  }
  if(domainA&&domainB&&domainA===domainB && nameA!==nameB){
    return {flag:true,reason:'Different company names share the same website/domain; parent company or subsidiary may be involved'};
  }
  if(numberA&&numberB&&numberA===numberB && domainA&&domainB&&domainA!==domainB) {
    return {flag:true,reason:'Same registration number but conflicting websites/domains'};
  }
  if(nameA===nameB){
    if(numberA&&numberB&&numberA===numberB)return {flag:false,reason:''};
    if(domainA&&domainB&&domainA===domainB)return {flag:false,reason:''};
    return {flag:true,reason:'Same or near-identical company name without matching verified identity details'};
  }
  if(numberA&&numberB&&numberA===numberB)return {flag:false,reason:''};
  if(domainA&&domainB&&domainA===domainB)return {flag:true,reason:'Potential trading name or group company at the same domain'};
  const firstA=companyMatchToken(nameA), firstB=companyMatchToken(nameB);
  if(firstA && firstA.length>=4 && firstA===firstB &&
    (tokenOverlap(nameA,nameB)>=0.35 || Math.min(nameA.length,nameB.length)>=6)) {
    return {flag:true,reason:'Similar trading names; confirm the exact legal entity and website'};
  }
  return {flag:false,reason:''};
}
const MERGES = new Set(['greeting','first_name','last_name','full_name','company_name','company','job_title','verified_company_fact']);
export function renderPersonalised(template:string,lead:any) {
  const first=safeText(lead.first_name,100);
  const company=safeText(lead.company_name,180);
  const approvedFact=lead.research_review_status==='approved'&&lead.research_source_url &&
    lead.research_reviewed_by_user_id ? safeText(lead.research_fact,900) : '';
  const variables:Record<string,string>={
    greeting:first?'Hi '+first:'Hello',first_name:first,
    last_name:safeText(lead.last_name,100),
    full_name:safeText(lead.full_name,180),company_name:company,company,
    job_title:safeText(lead.job_title,120),verified_company_fact:approvedFact,
  };
  const used=[...String(template||'').matchAll(/{{\s*([^{}]+?)\s*}}/g)].map(m=>m[1].trim());
  for(const name of used){
    if(!MERGES.has(name))return {ok:false,error:'Unknown merge field: '+name};
    if(!variables[name])return {ok:false,error:'Missing reviewed data for {{'+name+'}}'};
  }
  const text=String(template||'').replace(/{{\s*([^{}]+?)\s*}}/g,(_,name)=>variables[name.trim()]||'');
  return {ok:true,text};
}

// A separate later import may reveal a conflict with a much older, previously
// approved contact. Re-check these flags at each approval, draft generation,
// held scheduling and external export, not only at import time.
export function hasUnresolvedCompanyFlag(lead:any, flags:any[], candidateOverflow=false) {
  if (lead?.company_match_status==='ambiguous'||lead?.review_status==='flagged_company')return true;
  if (candidateOverflow)return true; // Incomplete identity scan must fail closed.
  const name=companyKey(lead?.company_name);
  const domain=companyDomain(lead?.company_domain||lead?.website);
  const number=companyNumber(lead?.company_registration_number);
  const isReviewed=lead?.company_match_status==='manually_confirmed'&&!!lead?.company_review_source_url;
  const checkedAt=Date.parse(lead?.company_reviewed_at||'');
  for(const candidate of flags||[]){
    if(candidate.id===lead.id)return true;
    const candidateName=companyKey(candidate.company_name);
    const candidateDomain=companyDomain(candidate.company_domain||candidate.website);
    const candidateNumber=companyNumber(candidate.company_registration_number);
    const sameCorporateIdentity=!!name&&!!candidateName&&name===candidateName&&
      ((domain&&candidateDomain&&domain===candidateDomain)||
      (number&&candidateNumber&&number===candidateNumber));
    const mismatch=compareCompany(lead,candidate).flag;
    if(!sameCorporateIdentity&&!mismatch)continue;
    const conflictDate=Math.max(Date.parse(candidate.created_at||'')||0,Date.parse(candidate.updated_at||'')||0);
    if(isReviewed&&Number.isFinite(checkedAt)&&checkedAt>=conflictDate&&conflictDate>0)continue;
    return true;
  }
  return false;
}
