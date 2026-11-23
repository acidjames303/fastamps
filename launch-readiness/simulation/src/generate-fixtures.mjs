import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'fixtures');
const PREFIX = 'QA-LAUNCH-2026';
const INSTALLERS = 20;
const PINS_NEEDED = 420; // 400 + buffer

function pin(i) {
  return String(600000 + i).padStart(6, '0');
}

function serial(i) {
  return `${PREFIX}-S${String(i).padStart(5, '0')}`;
}

const installers = Array.from({ length: INSTALLERS }, (_, i) => {
  const n = i + 1;
  return {
    id: `${PREFIX}-INSTALLER-${String(n).padStart(2, '0')}`,
    email: `${PREFIX.toLowerCase()}.installer${String(n).padStart(2, '0')}@example.invalid`,
    full_name: `${PREFIX} Installer ${n}`,
    business_name: `${PREFIX} Electrical Ltd ${n}`,
    mobile: `07${String(700000000 + n).slice(0, 9)}`,
    region: n % 2 === 0 ? 'North West' : 'South East',
    nominated_wholesaler: `${PREFIX} Northbridge Electrical Supplies`,
    nominated_branch: n % 3 === 0 ? 'Manchester' : 'Leeds',
    target_installs: 20,
  };
});

const chargers = Array.from({ length: PINS_NEEDED }, (_, i) => ({
  serial_number: serial(i + 1),
  pin_code: pin(i),
  product_model: 'Alpha 7',
  supplied_to_type: 'wholesaler',
  supplied_to_name_raw: `${PREFIX} Northbridge Electrical Supplies`,
  supplied_to_branch_raw: 'Pilot Branch',
  source_batch_identifier: `${PREFIX}-BATCH-001`,
}));

const csvHeader = 'serial_number,pin_code,product_model,supplied_to_type,supplied_to_name_raw,supplied_to_branch_raw,source_batch_identifier';
const csvBody = chargers
  .map((row) =>
    [
      row.serial_number,
      row.pin_code,
      row.product_model,
      row.supplied_to_type,
      `"${row.supplied_to_name_raw}"`,
      `"${row.supplied_to_branch_raw}"`,
      row.source_batch_identifier,
    ].join(','),
  )
  .join('\n');

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'installers.json'), JSON.stringify({ prefix: PREFIX, installers }, null, 2));
await writeFile(join(outDir, 'chargers.json'), JSON.stringify({ prefix: PREFIX, count: chargers.length, chargers }, null, 2));
await writeFile(join(outDir, 'chargers.csv'), `${csvHeader}\n${csvBody}\n`);
await writeFile(
  join(outDir, 'plan.json'),
  JSON.stringify(
    {
      prefix: PREFIX,
      base44AppId: '6adf6de7ebdb4cb382e8779f',
      base44AppName: 'FastAmps Connect',
      baseUrl: 'https://connect.fastamps.com',
      installers: INSTALLERS,
      installsPerInstaller: 20,
      minimumTotalInstalls: 400,
      chargerBuffer: PINS_NEEDED,
      concurrencyStages: [1, 5, 10, 20],
      featureFreeze: true,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      outDir,
      installers: INSTALLERS,
      chargers: chargers.length,
      uniqueSerials: new Set(chargers.map((c) => c.serial_number)).size,
      uniquePins: new Set(chargers.map((c) => c.pin_code)).size,
    },
    null,
    2,
  ),
);
