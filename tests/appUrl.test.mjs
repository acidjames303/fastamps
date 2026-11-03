import assert from 'node:assert/strict';
import { createClaimUrl, FASTAMPS_CONNECT_URL, STATIC_WEBSITE_URL, getClaimBaseUrl } from '../src/lib/appUrl.js';

assert.equal(STATIC_WEBSITE_URL, 'https://connect.fastamps.com');
assert.equal(FASTAMPS_CONNECT_URL, 'https://connect.fastamps.com');
assert.equal(STATIC_WEBSITE_URL.includes('/claim/'), false);
assert.equal(STATIC_WEBSITE_URL.includes('demo='), false);

const token = 'abcdef0123456789abcdef0123456789';
const url = createClaimUrl(token);
assert.equal(url, `${getClaimBaseUrl()}/claim/${token}`);
assert.equal(url.includes('?demo='), false);
assert.equal(url.includes(token), true);

console.log('appUrl.test.mjs passed');
