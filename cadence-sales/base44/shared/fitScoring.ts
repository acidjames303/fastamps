// Target-List-specific fit scoring. Deterministic rules first; AI only
// interprets unstructured evidence or generates the fit reason for borderline
// cases. A hard exclusion is NEVER overridden silently by an AI score.

const RANGE_ORDER = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

function normList(arr) {
  return (arr || []).map((s) => (s || '').toLowerCase().trim()).filter(Boolean);
}

function overlaps(a, b) {
  const aa = normList(a), bb = normList(b);
  if (!aa.length || !bb.length) return false;
  return aa.some((x) => bb.some((y) => y.includes(x) || x.includes(y)));
}

// Deterministic score. Returns { score, band, reason, positives, negatives, exclusion_reason }.
// `exclusionReason` (from caller) enforces a hard exclusion that AI cannot override.
export function deterministicScore(company, intel, targetList, exclusionReason) {
  const positives = [];
  const negatives = [];

  if (exclusionReason) {
    return {
      score: 0, band: 'excluded', reason: exclusionReason,
      positives: [], negatives: ['Hard exclusion'], exclusion_reason: exclusionReason,
    };
  }

  let score = 40;

  // Industry match
  const industry = (company?.industry || intel?.industry_industry || '').toLowerCase();
  const industries = normList(targetList?.target_industries);
  if (industries.length) {
    if (industries.some((i) => industry.includes(i) || i.includes(industry))) {
      score += 20; positives.push('Industry matches target');
    } else {
      score -= 10; negatives.push('Industry outside target');
    }
  }

  // Geography
  const location = (company?.location || intel?.location || '').toLowerCase();
  const locs = normList(targetList?.target_locations);
  if (locs.length) {
    if (locs.some((l) => location.includes(l) || l.includes(location))) {
      score += 15; positives.push('Location matches target');
    } else {
      negatives.push('Location outside target');
    }
  }

  // Company size
  const size = company?.employee_range;
  const sizes = normList(targetList?.target_company_sizes);
  if (sizes.length && size) {
    if (sizes.some((s) => s.includes(size) || size.includes(s))) {
      score += 15; positives.push('Headcount in target range');
    } else {
      score -= 5; negatives.push('Headcount outside target range');
    }
  }

  // Target roles present in researched roles
  const roles = normList(intel?.target_roles || []);
  const wantRoles = normList(targetList?.target_roles);
  if (wantRoles.length && roles.length) {
    if (wantRoles.some((r) => roles.some((x) => x.includes(r) || r.includes(x)))) {
      score += 10; positives.push('Target senior roles identified');
    }
  }

  // Buyer signals
  if (intel?.buyer_signals) {
    score += 10; positives.push('Buyer signals present');
  }

  score = Math.max(0, Math.min(100, score));
  let band = 'low';
  if (score >= 70) band = 'high';
  else if (score >= 40) band = 'medium';

  const reason = [positives[0], negatives[0]].filter(Boolean).join('; ') || 'Limited evidence';
  return { score, band, reason, positives, negatives, exclusion_reason: '' };
}

// AI refinement of the fit REASON only (never the score/band/exclusion).
// Used when deterministic evidence is borderline, to interpret unstructured
// company intelligence (news, buyer signals, what_they_do).
export async function aiInterpretReason(base44, company, intel, targetList, deterministic) {
  if (deterministic.band === 'excluded') return deterministic.reason;
  try {
    const summary = typeof intel?.ai_summary === 'string'
      ? (() => { try { return JSON.parse(intel.ai_summary); } catch { return { summary: intel.ai_summary }; } })()
      : (intel?.ai_summary || {});
    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `A sales rep is scoring company fit for a target list.
Company: ${company?.name || ''} — ${company?.industry || ''}, ${company?.employee_range || ''}, ${company?.location || ''}.
Company intelligence summary: ${summary.summary || intel?.buyer_signals || 'none'}.
Target list ICP: industries ${(targetList?.target_industries || []).join(', ')}, sizes ${(targetList?.target_company_sizes || []).join(', ')}, locations ${(targetList?.target_locations || []).join(', ')}, roles ${(targetList?.target_roles || []).join(', ')}.
Deterministic score: ${deterministic.score}/100 (${deterministic.band}).
Write ONE short sentence (max 25 words) explaining why this company is or isn't a good fit, based only on the evidence. Do not invent facts.`,
      model: 'gemini_3_flash',
    });
    return (typeof res === 'string' ? res : res?.text || '').trim().slice(0, 300) || deterministic.reason;
  } catch {
    return deterministic.reason;
  }
}