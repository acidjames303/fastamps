/**
 * Documents and validates the staged concurrency plan for the 20-installer stress run.
 * Does not hit production APIs — use after CONNECT_QA_MODE is authorised.
 */
import { assertSafeMode, getMode } from './env-guard.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

assertSafeMode('concurrency-plan');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const plan = JSON.parse(readFileSync(join(root, 'fixtures/plan.json'), 'utf8'));
const installersDoc = JSON.parse(readFileSync(join(root, 'fixtures/installers.json'), 'utf8'));
const chargersDoc = JSON.parse(readFileSync(join(root, 'fixtures/chargers.json'), 'utf8'));
const installers = Array.isArray(installersDoc) ? installersDoc : installersDoc.installers || [];
const chargers = Array.isArray(chargersDoc) ? chargersDoc : chargersDoc.chargers || [];

const stages = (plan.concurrencyStages || [1, 5, 10, 20]).map((n) => ({
  simultaneousInstallers: n,
  claimedInstallers: installers.slice(0, n).map((i) => i.id),
  estimatedInstallBurst: n * 2,
  note:
    n === 1
      ? 'Single full journey smoke'
      : n < 20
        ? `Staged concurrency burst (${n})`
        : 'Full 20-session overlap — registrations, uploads, wallet reads, admin poll',
}));

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: getMode(),
      featureFreeze: plan.featureFreeze === true,
      prefix: plan.prefix,
      base44AppId: plan.base44AppId || '6adf6de7ebdb4cb382e8779f',
      baseUrl: plan.baseUrl || 'https://connect.fastamps.com',
      installerPool: installers.length,
      chargerPool: chargers.length,
      minimumTotalInstalls: plan.minimumTotalInstalls,
      stages,
      gatedExecution: {
        requires: ['CONNECT_QA_MODE=isolated|production-authorised', 'admin + installer credentials'],
        nextScript: 'playwright E2E (pending credentials) or Base44 API runner',
      },
    },
    null,
    2,
  ),
);
