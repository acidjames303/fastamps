import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'base44/shared/campaignExport.ts'), 'utf8');

test('campaign export headers split first and last name', () => {
  assert.match(source, /'First name'/);
  assert.match(source, /'Last name'/);
  assert.match(source, /'Phone'/);
  assert.doesNotMatch(source, /'Contact name'/);
});

test('campaign export builds one row per person, not joined contact lists', () => {
  assert.match(source, /rowForPerson/);
  assert.match(source, /buildPeopleForAccount/);
  assert.doesNotMatch(source, /join\(allPeople\.map/);
  assert.match(source, /const targets = people\.length \? people : \[null\]/);
});
