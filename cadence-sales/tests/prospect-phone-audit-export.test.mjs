import assert from "node:assert/strict";
import { buildProspectPhoneAuditRows, PHONE_AUDIT_HEADERS } from "../src/lib/prospectPhoneAuditExport.js";

{
  const rows = buildProspectPhoneAuditRows([
    {
      company_name: "Acme",
      enrichment_status: "complete",
      phone_source: "import",
      contacts: [
        {
          name: "Jane Doe",
          title: "MD",
          mobile: "+44 7700 900123",
          lusha_mobile: "07700 900999",
          phone_source: "import",
          phone_status: "manually_confirmed",
        },
      ],
    },
  ]);
  assert.equal(PHONE_AUDIT_HEADERS.includes("Lusha mobile"), true);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][3], "+44 7700 900123"); // Import mobile
  assert.equal(rows[0][5], "07700 900999"); // Lusha mobile
  assert.equal(rows[0][11], "Yes"); // Has additive Lusha
}

{
  const rows = buildProspectPhoneAuditRows([
    {
      company_name: "Beta",
      full_name: "Sam Smith",
      mobile: "07700900111",
      phone_source: "lusha",
      enrichment_status: "complete",
      contacts: [],
    },
  ]);
  assert.equal(rows[0][3], ""); // no import
  assert.equal(rows[0][5], "07700900111"); // lusha as primary
  assert.equal(rows[0][11], "No");
}

console.log("prospect-phone-audit-export.test.mjs: ok");
