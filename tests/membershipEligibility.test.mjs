import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('Installer schema includes membership lifecycle and deferred welcome bonus', () => {
  const schema = read('base44/entities/Installer.jsonc');
  assert.match(schema, /"membership_status"/);
  assert.match(schema, /pre_registered/);
  assert.match(schema, /"deferred"/);
  assert.match(schema, /notify_programme_availability/);
});

test('IncentiveProgramme entity exists as draft-capable controlled beta', () => {
  const schema = read('base44/entities/IncentiveProgramme.jsonc');
  assert.match(schema, /controlled_commercial_beta/);
  assert.match(schema, /held_pending_authorisation/);
  assert.match(schema, /"draft"/);
});

test('claim submitters enforce membership eligibility', () => {
  const v2 = read('base44/functions/submit-install-claim-v2/entry.ts');
  const v1 = read('base44/functions/submit-install-claim/entry.ts');
  assert.match(v2, /membership_status/);
  assert.match(v2, /status: 403/);
  assert.match(v2, /links-electrical-shrewsbury/);
  assert.match(v1, /membership_status/);
});

test('public gateway and pre-registration routes are wired', () => {
  const app = read('src/App.jsx');
  assert.match(app, /path="\/welcome"/);
  assert.match(app, /path="\/pre-register"/);
  assert.match(app, /path="\/invite\/:programmeCode"/);
  assert.match(app, /path="\/admin\/programmes"/);
});

test('wholesaler fallback directory includes Links Shrewsbury and nationwide examples', () => {
  const fallback = read('src/lib/wholesalerDirectoryFallback.js');
  assert.match(fallback, /Links Electrical/);
  assert.match(fallback, /CEF/);
  assert.match(fallback, /Edmundson Electrical/);
  assert.match(fallback, /YESSS Electrical/);
});
