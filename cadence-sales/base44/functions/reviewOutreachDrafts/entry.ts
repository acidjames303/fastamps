import { resolveTenant } from '../../shared/tenantAuth.ts';
import {companyMatchToken,hasUnresolvedCompanyFlag} from '../../shared/outreachIdentity.ts';

// Human content approval only. This function never schedules or sends mail.
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const clean = (value: unknown, max = 120) => String(value || '').trim().slice(0, max);
function recipients(text: string): string[] {
  return String(text || '').split(/[\s,;]+/).map(s => s.toLowerCase().trim()).filter(Boolean);
}
function snapshot(draft: any, signatureText = '') {
  return JSON.stringify({
    sender_user_id: draft.owner_user_id,
    brand_key: draft.brand_key,
    provider: draft.provider || 'none',
    to: recipients(draft.recipient_to),
    cc: recipients(draft.recipient_cc),
    bcc: recipients(draft.recipient_bcc),
    subject: draft.subject || '',
    body_text: draft.body_text || '',
    quoted_text: draft.quoted_text || '',
    signature_id: draft.signature_id || '',
    signature_text: signatureText,
  });
}
async function sha(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.toLowerCase()));
  return [...new Uint8Array(digest)].map(c => c.toString(16).padStart(2, '0')).join('');
}
function hex(bytes: Uint8Array) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function approvalHash(d: any, signatureText = '') {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(snapshot(d, signatureText)))));
}

export default async function(req: Request) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!['platform_owner','organisation_admin','sales_manager','internal_bd','bdm'].includes(profile.app_role)) return Response.json({
      error:'Outreach review is restricted to the private pilot.'
    }, {status:403});
    const input: any = await req.json().catch(() => ({}));
    const action = clean(input.action);
    if (!['approve','return'].includes(action)) {
      return Response.json({error:'Unsupported action.'}, {status:400});
    }
    const ids: string[] = Array.isArray(input.draft_ids)
      ? [...new Set(input.draft_ids.map((v: unknown) => clean(v, 100)))] : [];
    if (ids.length < 1 || ids.length > 50) return Response.json({
      error: 'Select between 1 and 50 drafts per review batch.',
    }, {status:400});
    const svc = base44.asServiceRole.entities;
    const all = await svc.OutreachDraft.filter({
      organisation_id: org.id, owner_user_id: user.id, id: { $in: ids },
    }, '-updated_at', 50);
    if ((all||[]).length !== ids.length) return Response.json({
      error: 'At least one draft was not found or did not belong to you.',
    }, {status:403});

    // Validate all selected drafts before mutating any. Never partially approve invalid batches.
    if(action==='approve'){
      if(all.some((d:any)=>d.identity_warning))return Response.json({
        error:'A company was flagged after its draft was created. Resolve the company and regenerate the draft before approval.'
      },{status:403});
      const leadIds=[...new Set(all.map((d:any)=>d.source_lead_id).filter(Boolean))];
      if(leadIds.length){
        const linked=await svc.OutreachLead.filter({organisation_id:org.id,owner_user_id:user.id,
          id:{$in:leadIds}},'-created_at',50);
        if(linked.length!==leadIds.length||linked.some((l:any)=>
          l.review_status!=='approved'||l.company_match_status==='ambiguous')){
          return Response.json({error:'A linked prospect has unresolved company identity or contact review.'},{status:403});
        }
        const tokens=[...new Set(linked.map((l:any)=>l.company_match_token||companyMatchToken(l.company_name)).filter(Boolean))];
        const flagged=tokens.length?await svc.OutreachLead.filter({
          organisation_id:org.id,owner_user_id:user.id,company_match_token:{$in:tokens},
          review_status:'flagged_company'
        },'-updated_at',500):[];
        if(linked.some((l:any)=>hasUnresolvedCompanyFlag(l,flagged,flagged.length===500))){
          return Response.json({error:'Company research identity is disputed by another record. Regenerate after checking the business.'},{status:403});
        }
      }
    }
    const signatureIds = [...new Set(all.map((d: any) => d.signature_id).filter(Boolean))];
    const signatures = signatureIds.length ? await svc.OutreachSignature.filter({
      organisation_id: org.id, owner_user_id: user.id, id: { $in: signatureIds },
    }, '-updated_at', 100) : [];
    const bySignatureId = new Map(signatures.map((s: any) => [s.id, s]));
    if (action === 'approve' && all.some((d: any) =>
      d.signature_id && (!bySignatureId.has(d.signature_id) ||
      bySignatureId.get(d.signature_id)?.brand_key !== d.brand_key))) {
      return Response.json({ error: 'A selected draft has a missing or unrelated signature.' }, {status:403});
    }
    if (action === 'approve') {
      const allRecipients = [];
      for (const d of all) {
        const to = recipients(d.recipient_to);
        const cc = recipients(d.recipient_cc);
        const bcc = recipients(d.recipient_bcc);
        if (!to.length || ![...to,...cc,...bcc].every(r=>EMAIL.test(r)) ||
            !String(d.subject||'').trim() || !String(d.body_text||'').trim()) {
          return Response.json({error:'Every selected draft needs a valid recipient, subject and message.'},{status:400});
        }
        allRecipients.push(...to,...cc,...bcc);
      }
      const hashes = await Promise.all([...new Set(allRecipients)].map(sha));
      const stops = await svc.SuppressionEntry.filter({
        organisation_id:org.id, normalised_email_hash:{$in:hashes}, status:'active',
      }, '-recorded_at', 200);
      if (stops?.length) return Response.json({
        error:'Selected drafts include at least one suppressed contact. No draft was approved.',
      }, {status:403});
    }
    let changed=0;
    const now = new Date().toISOString();
    for(const d of all) {
      const isApproved = action === 'approve';
      const sigText = d.signature_id ? String(bySignatureId.get(d.signature_id)?.signature_text || '') : '';
      if (isApproved && d.status === 'approved_hold' && d.approval_hash === await approvalHash(d, sigText)) continue;
      await svc.OutreachDraft.update(d.id, {
        status:isApproved?'approved_hold':'draft',
        approval_hash:isApproved?await approvalHash(d, sigText):'',
        approved_by_user_id:isApproved?user.id:'',
        approved_at:isApproved?now:'',
        updated_at:now,
      });
      changed++;
    }
    // Keep a durable audit with no message contents or addresses.
    await svc.AuditLog.create({
      organisation_id:org.id, actor_user_id:user.id, action:'elevated_action',
      entity_type:'OutreachDraft', entity_id:ids.join(',').slice(0,300),
      previous_value:'outreach_content_review',
      new_value: action==='approve'?'approved_hold_no_send':'returned_to_draft',
      timestamp:now,
    });
    return Response.json({
      ok:true, changed, status:action==='approve'?'approved_hold':'draft',
      message: action==='approve'
        ? 'Content approved and held. No sending or scheduling is enabled.'
        : 'Drafts returned to editing. No sending or scheduling is enabled.',
    });
  } catch(error: any) {
    return Response.json({error:clean(error?.message || 'Review failed.',400)},{status:error?.status||500});
  }
}
