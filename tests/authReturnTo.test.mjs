import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, '../src/lib/authReturnTo.js'), 'utf8');

const store = new Map();
const sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};

function loadWithSearch(search) {
  store.clear();
  const sandbox = {
    window: {
      location: {
        origin: 'https://connect.fastamps.com',
        search,
      },
    },
    sessionStorage,
    URL,
    URLSearchParams,
    console,
    crypto: webcrypto,
  };
  // Convert ESM exports into assignments the sandbox can read.
  const transformed = source
    .replace(/export function (\w+)/g, 'function $1')
    .replace(/export \{[^}]+\};?/g, '')
    + '\n;module.exports = { safeReturnTo, rememberPendingClaimPath, readPendingClaimPath, clearPendingClaimPath };';
  sandbox.module = { exports: {} };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transformed, sandbox, { filename: 'authReturnTo.js' });
  return sandbox.module.exports;
}

{
  const api = loadWithSearch('?returnTo=%2Fclaim%2Fabc123');
  assert.equal(api.safeReturnTo(), '/claim/abc123');
}

{
  const api = loadWithSearch('?returnTo=%2Fclaim%2Fabc123%3Fdemo%3D1');
  assert.equal(api.safeReturnTo(), '/claim/abc123');
}

{
  const api = loadWithSearch('');
  api.rememberPendingClaimPath('/claim/deadbeef');
  assert.equal(api.readPendingClaimPath(), '/claim/deadbeef');
  assert.equal(api.safeReturnTo(), '/claim/deadbeef');
  api.clearPendingClaimPath();
  assert.equal(api.safeReturnTo(), '/');
}

{
  const api = loadWithSearch('?returnTo=https%3A%2F%2Fevil.com%2Fphish');
  assert.equal(api.safeReturnTo(), '/');
}

console.log('authReturnTo.test.mjs passed');
