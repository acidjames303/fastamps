import assert from 'node:assert/strict';

/**
 * Mirrors submit-install-claim-v2 create-time demo/QA protection fields.
 * Live installers (non-demo) must keep reward_status pending and reporting inclusion.
 */
function claimCreateFields({ isDemoClaim, demoLabel = '' }) {
  return {
    reward_amount: 10,
    reward_status: isDemoClaim ? 'held' : 'pending',
    is_demo: isDemoClaim,
    demo_label: demoLabel,
    ...(isDemoClaim
      ? {
          excluded_from_reporting: true,
          exclusion_reason: `Demo/QA claim (${demoLabel || 'demo'}) — exclude from live rewards and commercial reporting.`,
        }
      : {}),
  };
}

{
  const live = claimCreateFields({ isDemoClaim: false });
  assert.equal(live.reward_status, 'pending');
  assert.equal(live.is_demo, false);
  assert.equal(live.excluded_from_reporting, undefined);
  assert.equal(live.reward_amount, 10);
}

{
  const demo = claimCreateFields({ isDemoClaim: true, demoLabel: 'QA-LAUNCH-2026' });
  assert.equal(demo.reward_status, 'held');
  assert.equal(demo.is_demo, true);
  assert.equal(demo.excluded_from_reporting, true);
  assert.match(demo.exclusion_reason, /QA-LAUNCH-2026/);
  assert.equal(demo.reward_amount, 10);
}

console.log('demoClaimProtections.test.mjs passed');
