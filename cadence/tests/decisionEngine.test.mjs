import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyze,
  estimateTimeSavedMinutes,
  sanitizePromptText,
  validateIntake,
} from '../src/lib/decisionEngine.js';

test('critical decide with high emotional risk recommends meeting', () => {
  const result = analyze({
    urgency: 'critical',
    complexity: 'complex',
    decision_type: ['decide'],
    stakeholder_count: '6-10',
    emotional_risk: 'high',
    change_impact: 'high',
    cross_team_dependencies: true,
  });
  assert.equal(result.recommendation, 'meeting');
  assert.ok(result.confidence >= 65);
  assert.match(result.rationale, /urgency|Sensitive|Critical|Cross-functional/i);
});

test('simple inform to 1-2 people prefers email', () => {
  const result = analyze({
    urgency: 'low',
    complexity: 'simple',
    decision_type: ['inform'],
    stakeholder_count: '1-2',
    emotional_risk: 'low',
    change_impact: 'low',
  });
  assert.equal(result.recommendation, 'email');
});

test('low urgency update prefers async', () => {
  const result = analyze({
    urgency: 'low',
    complexity: 'simple',
    decision_type: ['update'],
    stakeholder_count: '3-5',
    emotional_risk: 'low',
    change_impact: 'low',
  });
  assert.equal(result.recommendation, 'async_message');
});

test('validateIntake requires title purpose and decision_type', () => {
  const bad = validateIntake({});
  assert.ok(bad.errors.includes('title is required'));
  assert.ok(bad.errors.includes('purpose is required'));
  assert.ok(bad.errors.includes('decision_type is required'));

  const good = validateIntake({
    title: 'Q3 plan',
    purpose: 'Align leads',
    decision_type: ['align'],
    urgency: 'high',
    complexity: 'moderate',
  });
  assert.deepEqual(good.errors, []);
  assert.equal(good.input.title, 'Q3 plan');
});

test('sanitizePromptText strips control chars and truncates', () => {
  assert.equal(sanitizePromptText('hello\u0000world', { max: 20 }), 'hello world');
  assert.equal(sanitizePromptText('x'.repeat(100), { max: 10 }).length, 10);
});

test('estimateTimeSavedMinutes rewards async over meetings', () => {
  assert.ok(
    estimateTimeSavedMinutes('async_message', { urgency: 'low', complexity: 'simple' }) >
      estimateTimeSavedMinutes('meeting', { stakeholder_count: '10+', urgency: 'high', complexity: 'complex' }),
  );
});
