import test from 'node:test';
import assert from 'node:assert/strict';

/** Mirrors submit-install-claim-v2 wholesaler/branch gate (freeze-safe data quality fix). */
function validateWholesalerFields(body) {
  const wholesalerName = String(body.wholesaler || '').trim();
  const wholesalerBranch = String(body.wholesaler_branch || '').trim();
  if (!wholesalerName || !wholesalerBranch) {
    return {
      ok: false,
      error: 'Enter the wholesaler company and the exact branch or town where this charger was purchased.',
    };
  }
  return { ok: true, wholesaler: wholesalerName, wholesaler_branch: wholesalerBranch };
}

test('rejects missing wholesaler company', () => {
  const result = validateWholesalerFields({ wholesaler: '  ', wholesaler_branch: 'Shrewsbury' });
  assert.equal(result.ok, false);
});

test('rejects missing wholesaler branch', () => {
  const result = validateWholesalerFields({ wholesaler: 'Links Electrical', wholesaler_branch: '' });
  assert.equal(result.ok, false);
});

test('accepts trimmed wholesaler company and branch', () => {
  const result = validateWholesalerFields({
    wholesaler: '  Links Electrical  ',
    wholesaler_branch: ' Shrewsbury ',
  });
  assert.equal(result.ok, true);
  assert.equal(result.wholesaler, 'Links Electrical');
  assert.equal(result.wholesaler_branch, 'Shrewsbury');
});
