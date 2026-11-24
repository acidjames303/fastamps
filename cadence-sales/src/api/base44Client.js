import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// requiresAuth must stay false: true schedules an SDK redirectToLogin on every
// anonymous boot (before React mounts), which blanked the page and bounced local
// / Landing /login to the hosted Base44 login. Route guards + backend enforce auth.
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});