import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { classifyUkPhone, evaluateProviderPhone } from '../../shared/ukPhone.ts';

// Admin-only diagnostic: runs the deterministic UK phone classifier over a
// fixed table of real-world numbers and prints the promotion decision for each.
// Used to prove that a geographic landline can never be classified as a mobile.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const cases: Array<[string, string, boolean]> = [
      ['+44 247 663 1400', 'the John Palmer 024 number', false],
      ['+44 7877 554492', '07877 mobile', true],
      ['08005610074', '0800 freephone', false],
      ['+44 1727 857536', '01727 geographic', false],
      ['01455 255900', '01455 geographic', false],
      ['07714101709', '07714 mobile', true],
      ['+44 300 123 6000', '0300 non-geographic', false],
      ['020 8772 6222', '020 geographic', false],
      ['0700 123 4567', '070 personal numbering', false],
      ['0845 123 4567', '0845 business rate', false],
      ['0901 123 4567', '09 premium rate', false],
      ['07700 90012', 'short mobile, invalid length', false],
      ['not-a-number', 'malformed', false],
      ['', 'blank', false],
    ];

    const results = cases.map(([raw, note, expectMobile]) => {
      const uk = classifyUkPhone(raw);
      return {
        raw: raw || '(blank)', note,
        type: uk.type, is_mobile: uk.isMobile,
        expect_mobile: expectMobile, pass: uk.isMobile === expectMobile,
      };
    });

    const decisions = [
      {
        case: 'John Palmer 024 number, employer confirmed',
        result: evaluateProviderPhone({
          rawNumber: '+44 24 7663 1400', providerType: 'direct',
          companyLandline: '01455 238141', employment: 'confirmed',
          employerName: 'Hinckley and Bosworth Borough Council',
          returnedCompany: 'Hinckley and Bosworth Borough Council',
        }),
      },
      {
        case: 'Same 024 number labelled mobile by the provider',
        result: evaluateProviderPhone({
          rawNumber: '+44 24 7663 1400', providerType: 'mobile',
          companyLandline: '', employment: 'confirmed',
        }),
      },
      {
        case: 'Real mobile, wrong employer',
        result: evaluateProviderPhone({
          rawNumber: '+44 7700 900123', providerType: 'mobile',
          companyLandline: '', employment: 'mismatch',
          returnedCompany: 'Coventry City Council',
        }),
      },
      {
        case: 'Real mobile, employer unconfirmed',
        result: evaluateProviderPhone({
          rawNumber: '07700 900123', providerType: 'mobile', employment: 'unconfirmed',
        }),
      },
      {
        case: 'Real mobile, employer confirmed',
        result: evaluateProviderPhone({
          rawNumber: '07877 554492', providerType: 'mobile',
          companyLandline: '01455 238141', employment: 'confirmed',
        }),
      },
    ].map(({ case: label, result }) => ({
      case: label,
      classified_as: result.type,
      status: result.status,
      promote_to_dialler: result.promote,
      sent_to_review: result.review,
      provider_type_conflict: result.providerTypeConflict,
    }));

    const failed = results.filter((r) => !r.pass).length;
    return Response.json({
      promotion_decisions: decisions,
      summary: `${results.length - failed}/${results.length} classification cases passed.`,
      failed_cases: results.filter((r) => !r.pass),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}