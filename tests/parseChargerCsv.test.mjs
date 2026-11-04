import assert from 'node:assert/strict';
import { parseChargerCsv } from '../src/lib/distributionCsv.js';

{
  const rows = parseChargerCsv(`serial_number,pin_code,product_model
TEST-1,123456,Alpha 7
TEST-2,654321,Alpha 7
`);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].serial_number, 'TEST-1');
}

{
  // Trailing empty columns (Excel quirk) should not fail the import.
  const rows = parseChargerCsv(`serial_number,pin_code,product_model
TEST-1,123456,Alpha 7,,
TEST-2,654321,Alpha 7
`);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].pin_code, '123456');
}

{
  assert.throws(
    () => parseChargerCsv(`serial_number,pin_code,product_model
TEST-1,123456,Alpha 7,EXTRA
`),
    /CSV row 2 has 4 columns/,
  );
}

console.log('parseChargerCsv.test.mjs passed');
