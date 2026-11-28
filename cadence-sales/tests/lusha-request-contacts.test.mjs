import assert from "node:assert/strict";
import {
  buildRequestContacts,
  lushaPhonesMatchKnownMobile,
  phoneMatchDigits,
  pickPersonNumber,
} from "../base44/shared/lusha.ts";

{
  const { body, missing } = buildRequestContacts(
    [{
      name: "Jane Marie Doe",
      linkedin: "https://www.linkedin.com/in/jane-doe/?trk=x",
      email: "jane@acme.com",
      mobile: "07700 900123",
    }],
    { name: "Acme Ltd", domain: "https://www.acme.com/about" },
  );
  assert.equal(missing.length, 0);
  assert.equal(body.length, 1);
  // Stack LinkedIn + email + name/company — not exclusive pick-one.
  assert.equal(body[0].linkedinUrl, "https://www.linkedin.com/in/jane-doe");
  assert.equal(body[0].email, "jane@acme.com");
  assert.equal(body[0].firstName, "Jane");
  assert.equal(body[0].lastName, "Doe");
  assert.equal(body[0].companyDomain, "acme.com");
  assert.equal(body[0].companyName, "Acme Ltd");
}

{
  const { missing } = buildRequestContacts([{ name: "Reception" }], { name: "" });
  assert.deepEqual(missing, [0]);
}

{
  assert.equal(phoneMatchDigits("+44 7700 900123"), "447700900123");
  assert.equal(
    lushaPhonesMatchKnownMobile(
      [{ normalised: "+447700900123", number: "+44 7700 900123", valid: true }],
      "07700 900123",
    ),
    true,
  );
  assert.equal(
    lushaPhonesMatchKnownMobile(
      [{ normalised: "+447700900999", number: "07700 900999", valid: true }],
      "07700 900123",
    ),
    false,
  );
}

{
  const phones = [
    { normalised: "+447700900123", number: "07700 900123", valid: true, isMobile: true, isDirect: false, doNotCall: false },
    { normalised: "+447700900999", number: "07700 900999", valid: true, isMobile: true, isDirect: false, doNotCall: false },
  ];
  const extra = pickPersonNumber(phones, { excludeDigits: "447700900123" });
  assert.equal(extra.normalised, "+447700900999");
  const any = pickPersonNumber(phones);
  assert.equal(any.normalised, "+447700900123");
}

console.log("lusha-request-contacts.test.mjs: ok");
