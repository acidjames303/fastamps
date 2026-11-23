import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafeMode } from './env-guard.mjs';

assertSafeMode('dry-run');

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '..', 'fixtures');

const plan = JSON.parse(await readFile(join(fixtures, 'plan.json'), 'utf8'));
const installers = JSON.parse(await readFile(join(fixtures, 'installers.json'), 'utf8'));
const chargers = JSON.parse(await readFile(join(fixtures, 'chargers.json'), 'utf8'));

const serials = new Set(chargers.chargers.map((c) => c.serial_number));
const pins = new Set(chargers.chargers.map((c) => c.pin_code));
const badPrefix = [...serials].some((s) => !String(s).includes('QA-LAUNCH-2026'));
const pinOk = [...pins].every((p) => /^\d{6}$/.test(p));

const ok =
  installers.installers.length === 20
  && chargers.count >= 400
  && serials.size === chargers.count
  && pins.size === chargers.count
  && pinOk
  && !badPrefix
  && plan.featureFreeze === true;

console.log(
  JSON.stringify(
    {
      ok,
      plan,
      installerCount: installers.installers.length,
      chargerCount: chargers.count,
      uniqueSerials: serials.size,
      uniquePins: pins.size,
      pinsSixDigit: pinOk,
      qaPrefixOk: !badPrefix,
    },
    null,
    2,
  ),
);

if (!ok) process.exit(1);
