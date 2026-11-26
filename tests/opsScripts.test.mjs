import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

test('ops health and verify scripts exist', () => {
  assert.equal(existsSync(join(root, 'ops/scripts/production-health-check.mjs')), true);
  assert.equal(existsSync(join(root, 'ops/scripts/verify-release.mjs')), true);
  assert.equal(existsSync(join(root, 'ops/scripts/security-smoke.mjs')), true);
});

test('production monitor workflow is scheduled without AI steps', () => {
  const yml = readFileSync(join(root, '.github/workflows/production-monitor.yml'), 'utf8');
  assert.match(yml, /cron:/);
  assert.match(yml, /production-health-check\.mjs/);
  assert.doesNotMatch(yml, /openai|anthropic|cursor agent/i);
});

test('package.json exposes ops scripts', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['ops:health'], 'node ops/scripts/production-health-check.mjs');
  assert.equal(pkg.scripts['ops:verify-release'], 'node ops/scripts/verify-release.mjs');
});
