import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'base44/shared/campaignExport.ts'), 'utf8');

test('campaign export headers lead with person, company, phone and email', () => {
  const match = source.match(/export const CAMPAIGN_EXPORT_HEADERS = \[([\s\S]*?)\];/);
  assert.ok(match, 'headers export missing');
  const headers = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(headers.slice(0, 5), [
    'First name',
    'Last name',
    'Company',
    'Phone',
    'Personal email',
  ]);
  assert.doesNotMatch(source, /'Contact name'/);
});

test('campaign export builds one row per person, not joined contact lists', () => {
  assert.match(source, /rowForPerson/);
  assert.match(source, /buildPeopleForAccount/);
  assert.doesNotMatch(source, /join\(allPeople\.map/);
  assert.match(source, /const targets = people\.length \? people : \[null\]/);
});
