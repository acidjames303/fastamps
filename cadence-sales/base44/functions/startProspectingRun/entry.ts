import { resolveTenant } from '../../shared/tenantAuth.ts';
import { checkAllowance } from '../../shared/costControl.ts';
import { validatePublicUrl } from '../../shared/webhookSecurity.ts';

const ALLOWED_ROLES = ['platform_owner', 'organisation_admin', 'sales_manager'];
const SOURCE_TYPES = ['url', 'icp', 'brief'];

function cleanUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    // Only public destinations: a seed URL pointing at an internal host or the
    // cloud metadata service is refused before it is stored on the run.
    if (!validatePublicUrl(parsed.toString()).valid) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function runName({ source_type, seed_url, brief, icp }) {
  if (source_type === 'url') {
    try { return `Lookalikes of ${new URL(seed_url).hostname.replace(/^www\./, '')}`; } catch { return 'URL prospecting run'; }
  }
  const text = (source_type === 'brief' ? brief : icp) || '';
  const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean) || 'Prospecting run';
  return firstLine.slice(0, 70);
}

// Creates a prospecting run and returns immediately. Discovery, qualification
// and saving happen in runProspectingStep so no single request can time out.
export default async function (req) {
  try {
    const { base44, user, profile, org } = await resolveTenant(req);
    if (!ALLOWED_ROLES.includes(profile.app_role)) {
      return Response.json({ error: 'You do not have access to prospecting.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const source_type = SOURCE_TYPES.includes(body.source_type) ? body.source_type : 'icp';
    const seed_url = cleanUrl(body.seed_url);
    const brief = String(body.brief || '').slice(0, 8000).trim();
    const icp = String(body.icp || '').slice(0, 8000).trim();

    if (source_type === 'url' && !seed_url) {
      return Response.json({ error: 'Enter a valid public account URL (http or https).' }, { status: 400 });
    }
    if (source_type === 'brief' && !brief) {
      return Response.json({ error: 'Paste a campaign brief first.' }, { status: 400 });
    }
    if (source_type === 'icp' && !icp) {
      return Response.json({ error: 'Describe your ideal customer profile first.' }, { status: 400 });
    }

    const max_accounts = Math.min(Math.max(parseInt(body.max_accounts, 10) || 10, 5), 500);
    const permitted_countries = (Array.isArray(body.permitted_countries) ? body.permitted_countries : ['GB'])
      .map((c) => String(c).toUpperCase().slice(0, 2))
      .filter((c) => c.length === 2);
    const auto_enrich = body.auto_enrich !== false;

    await checkAllowance(base44, org, 'company_discovery', 1);

    // Target list: reuse one the user picked, otherwise create a dedicated list.
    let list = null;
    if (body.prospect_list_id) {
      list = await base44.asServiceRole.entities.ProspectList
        .get(body.prospect_list_id)
        .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!list || list.organisation_id !== org.id) {
        return Response.json({ error: 'That prospect list does not belong to your organisation.' }, { status: 404 });
      }
    } else {
      list = await base44.asServiceRole.entities.ProspectList.create({
        name: runName({ source_type, seed_url, brief, icp }),
        brief: brief || (source_type === 'url' ? `Prospecting run seeded from ${seed_url}` : ''),
        icp,
        campaign_id: body.campaign_id || '',
        permitted_countries: permitted_countries.length ? permitted_countries : ['GB'],
        status: 'draft',
        company_count: 0,
        organisation_id: org.id,
        owner_user_id: user.id,
      });
    }

    const run = await base44.asServiceRole.entities.ProspectingRun.create({
      organisation_id: org.id,
      created_by_user_id: user.id,
      run_name: runName({ source_type, seed_url, brief, icp }),
      source_type,
      seed_url,
      brief,
      icp,
      max_accounts,
      permitted_countries: permitted_countries.length ? permitted_countries : ['GB'],
      auto_enrich,
      prospect_list_id: list.id,
      status: 'queued',
      current_phase: 'context',
      candidates: [],
      accounts_found: 0,
      accounts_qualified: 0,
      accounts_rejected: 0,
      prospect_ids: [],
      smart_actions_used: 0,
      started_at: new Date().toISOString(),
    });

    return Response.json({ run, prospect_list: { id: list.id, name: list.name } });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not start the prospecting run.' }, { status: error.status || 500 });
  }
}