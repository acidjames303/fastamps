import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['base44/functions/resolve-charger-claim/entry.ts'],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'neutral',
  external: ['npm:@base44/sdk'],
  logLevel: 'silent',
});

const source = result.outputFiles[0].text;
const module = { exports: {} };
const sandbox = {
  require: (id) => {
    assert.equal(id, 'npm:@base44/sdk');
    return { createClientFromRequest: (req) => req._db };
  },
  module,
  exports: module.exports,
  console,
  Response,
  crypto: webcrypto,
  URL,
  Promise,
};
vm.runInNewContext(source, sandbox, { filename: 'resolve-charger-claim.cjs' });
const handler = module.exports.default || module.exports;
assert.equal(typeof handler, 'function');

const available = {
  id: 'chg-1',
  claim_token: 'a'.repeat(32),
  serial_number: 'SN-100',
  pin_code: '123456',
  product_model: 'Alpha 7',
  claim_status: 'available',
  install_claim_id: '',
  qr_generated: true,
  is_demo: false,
  batch_reference: 'BATCH-1',
};

function makeDb({ user = null, chargers = [available], claims = [] } = {}) {
  return {
    auth: {
      isAuthenticated: async () => Boolean(user),
      me: async () => user,
    },
    asServiceRole: {
      entities: {
        Charger: {
          filter: async (lookup) => chargers.filter((c) => Object.entries(lookup).every(([k, v]) => c[k] === v)),
        },
        InstallClaim: {
          filter: async (lookup) => claims.filter((c) => Object.entries(lookup).every(([k, v]) => c[k] === v)),
        },
      },
    },
  };
}

async function invoke(body, db) {
  const req = {
    method: 'POST',
    json: async () => body,
    _db: db,
  };
  return handler(req);
}

{
  const res = await invoke({ trade_show: true }, makeDb({ user: { email: 'a@b.com' } }));
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /website only/i);
}

{
  const res = await invoke({ claim_token: available.claim_token }, makeDb());
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.charger.serial_number, 'SN-100');
  assert.equal(data.charger.pin_code, undefined, 'anonymous resolve must not expose PIN');
}

{
  const res = await invoke(
    { claim_token: available.claim_token },
    makeDb({ user: { email: 'installer@example.com' } }),
  );
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.charger.pin_code, '123456');
}

{
  const claimed = { ...available, claim_status: 'submitted', install_claim_id: 'claim-1' };
  const res = await invoke(
    { claim_token: claimed.claim_token },
    makeDb({ user: { email: 'installer@example.com' }, chargers: [claimed], claims: [{ serial_number: 'SN-100' }] }),
  );
  assert.equal(res.status, 409);
}

{
  const res = await invoke(
    { serial_number: 'SN-100', pin_code: '123456' },
    makeDb({ user: { email: 'installer@example.com' } }),
  );
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.charger.claim_token, available.claim_token);
}

console.log('resolveChargerClaim.test.mjs passed');
