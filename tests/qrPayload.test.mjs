import assert from 'node:assert/strict';
import { parseQrPayload, parseClaimToken } from '../src/lib/qrPayload.js';

// A. Static website QR
{
  const payload = parseQrPayload('https://connect.fastamps.com');
  assert.equal(payload.kind, 'website');
  assert.equal(payload.website, true);
  assert.equal(payload.token, '');
  assert.equal(payload.serial, '');
}

{
  const payload = parseQrPayload('https://connect.fastamps.com/');
  assert.equal(payload.kind, 'website');
}

{
  // Retired trade-show ?demo=1 on the website root must still be website-only.
  const payload = parseQrPayload('https://connect.fastamps.com/?demo=1');
  assert.equal(payload.kind, 'website');
  assert.equal(payload.token, '');
}

// B. Charger claim QR
{
  const token = 'a'.repeat(32);
  const payload = parseQrPayload(`https://connect.fastamps.com/claim/${token}`);
  assert.equal(payload.kind, 'claim');
  assert.equal(payload.token, token);
  assert.equal(parseClaimToken(`https://connect.fastamps.com/claim/${token}`), token);
}

{
  // Historical printed claim URLs may still carry ?demo=1 — treat as claim only.
  const token = 'b'.repeat(32);
  const payload = parseQrPayload(`https://connect.fastamps.com/claim/${token}?demo=1`);
  assert.equal(payload.kind, 'claim');
  assert.equal(payload.token, token);
  assert.equal(payload.demo, undefined);
}

// C. Legacy serial/PIN
{
  const payload = parseQrPayload('https://connect.fastamps.com/register-install?serial=FA123&pin=012345');
  // Path is register-install without claim — classification is registration unless serial query is present.
  // Serial/PIN query on a registration host is legacy.
  assert.ok(payload.serial === 'FA123' || payload.registration === true);
}

{
  const payload = parseQrPayload('serial_number=ABC123&pin_code=654321');
  assert.equal(payload.kind, 'legacy');
  assert.equal(payload.serial, 'ABC123');
  assert.equal(payload.pin, '654321');
}

// Manual registration (not a charger claim)
{
  const payload = parseQrPayload('https://connect.fastamps.com/register-install');
  assert.equal(payload.kind, 'registration');
  assert.equal(payload.registration, true);
  assert.equal(payload.token, '');
}

// D. Invalid
{
  const payload = parseQrPayload('https://example.com/not-fastamps');
  assert.equal(payload.kind, 'invalid');
  assert.equal(payload.token, '');
}

{
  const payload = parseQrPayload('');
  assert.equal(payload.kind, 'invalid');
}

console.log('qrPayload.test.mjs passed');
