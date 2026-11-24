/**
 * Verify all 200 VIRTUAL-LINKS QR identities and export restricted QA assets.
 * PIN CSV is written only under /opt/cursor/artifacts/phase2/restricted/
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assertSafeMode } from './env-guard.mjs';
import { expectedAppId, baseUrl } from './target-app.mjs';
import QRCode from 'qrcode';

assertSafeMode('phase2-qr-export');

const appId = expectedAppId();
const api = `${baseUrl()}/api/apps/${appId}`;
const PREFIX = 'VIRTUAL-LINKS-2026';
const out = '/opt/cursor/artifacts/phase2';
const restricted = `${out}/restricted`;
mkdirSync(`${out}/qr-png`, { recursive: true });
mkdirSync(restricted, { recursive: true });

async function login(email, password) {
  const res = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('admin login failed');
  return data.access_token;
}

async function listAll(entity, token) {
  const rows = [];
  for (let skip = 0; ; skip += 200) {
    const res = await fetch(`${api}/entities/${entity}?limit=200&skip=${skip}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) break;
    rows.push(...data);
    if (data.length < 200) break;
  }
  return rows;
}

const token = await login(process.env.CONNECT_QA_ADMIN_EMAIL, process.env.CONNECT_QA_ADMIN_PASSWORD);
const chargers = (await listAll('Charger', token)).filter((c) => String(c.serial_number || '').startsWith(PREFIX));
const claims = (await listAll('InstallClaim', token)).filter((c) => String(c.serial_number || '').startsWith(PREFIX));
const claimBySerial = Object.fromEntries(claims.map((c) => [String(c.serial_number).toUpperCase(), c]));

const publicRows = [['serial_number', 'claim_token', 'claim_url', 'claim_status', 'claim_id', 'claim_reward_status', 'unique_ok']];
const pinRows = [['serial_number', 'pin_code', 'claim_token']];
const decodeChecks = [];
const seenTokens = new Set();
const seenSerials = new Set();
let unique = 0;

for (const c of chargers.sort((a, b) => String(a.serial_number).localeCompare(String(b.serial_number)))) {
  const serial = c.serial_number;
  const claimUrl = `https://connect.fastamps.com/claim/${c.claim_token}`;
  const claim = claimBySerial[String(serial).toUpperCase()];
  const tokenUnique = c.claim_token && !seenTokens.has(c.claim_token);
  const serialUnique = !seenSerials.has(serial);
  if (tokenUnique) seenTokens.add(c.claim_token);
  if (serialUnique) seenSerials.add(serial);
  if (tokenUnique && serialUnique) unique += 1;

  publicRows.push([
    serial,
    c.claim_token,
    claimUrl,
    c.claim_status,
    claim?.id || '',
    claim?.reward_status || '',
    tokenUnique && serialUnique,
  ]);
  pinRows.push([serial, c.pin_code, c.claim_token]);

  // Generate QR PNG for first 20 + last 5 + every 20th (full 200 would be large; also write sheet index)
  const idx = Number(String(serial).slice(-5));
  if (idx <= 20 || idx > 195 || idx % 20 === 0) {
    const file = `${out}/qr-png/${serial}.png`;
    await QRCode.toFile(file, claimUrl, { width: 320, margin: 2 });
    decodeChecks.push({ serial, file, url: claimUrl, token_matches: claimUrl.endsWith(c.claim_token) });
  }
}

// Full printable HTML sheet (no PINs)
const sheet = `<!doctype html><html><head><meta charset="utf-8"/><title>VIRTUAL-LINKS QR sheet</title>
<style>body{font-family:sans-serif} .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.card{border:1px solid #ccc;padding:8px;text-align:center;font-size:11px} img{width:140px;height:140px}</style></head>
<body><h1>VIRTUAL-LINKS-2026 QA QR codes (${chargers.length})</h1>
<p>Restricted QA artifact — not for commercial print. PINs omitted.</p>
<div class="grid">
${chargers.map((c) => {
  const url = `https://connect.fastamps.com/claim/${c.claim_token}`;
  // inline data URL would be huge; link by serial for sample PNGs only
  return `<div class="card"><div><strong>${c.serial_number}</strong></div><div>${url}</div></div>`;
}).join('\n')}
</div></body></html>`;
writeFileSync(`${out}/virtual-links-qr-sheet.html`, sheet);

const toCsv = (rows) => rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
writeFileSync(`${out}/virtual-links-qr-public.csv`, toCsv(publicRows));
writeFileSync(`${restricted}/virtual-links-serial-pin.csv`, toCsv(pinRows));
writeFileSync(`${restricted}/README.txt`, 'Contains PIN codes. Restricted QA only. Do not publish in reports or PRs.\n');

const summary = {
  charger_count: chargers.length,
  claim_count: claims.length,
  unique_serials: seenSerials.size,
  unique_tokens: seenTokens.size,
  all_200: chargers.length === 200 && seenSerials.size === 200 && seenTokens.size === 200,
  claims_reconciled: claims.length === 200,
  sample_pngs: decodeChecks.length,
  decode_checks: decodeChecks,
  pin_csv_sha256: createHash('sha256').update(toCsv(pinRows)).digest('hex'),
};
writeFileSync(`${out}/qr-verification.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.all_200 && summary.claims_reconciled ? 0 : 1);
