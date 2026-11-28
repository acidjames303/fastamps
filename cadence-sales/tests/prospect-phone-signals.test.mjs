import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  distinctPhoneSignals,
  phoneDigitKey,
  shouldExpandPhoneCandidates,
} from "../src/lib/prospectPhoneSignals.js";

describe("prospectPhoneSignals", () => {
  it("normalises digit keys and ignores short fragments", () => {
    assert.equal(phoneDigitKey("+44 7700 900123"), "447700900123");
    assert.equal(phoneDigitKey("123"), "");
  });

  it("counts import + Lusha as two signals for the same person", () => {
    const prospect = {
      contacts: [{
        name: "Ada",
        mobile: "07700 900111",
        lusha_mobile: "07700 900222",
      }],
    };
    assert.equal(distinctPhoneSignals(prospect).size, 2);
    assert.equal(shouldExpandPhoneCandidates(prospect), true);
  });

  it("does not expand a single mobile", () => {
    const prospect = {
      phone: "07700900111",
      contacts: [{ name: "Ada", mobile: "07700 900111" }],
    };
    assert.equal(distinctPhoneSignals(prospect).size, 1);
    assert.equal(shouldExpandPhoneCandidates(prospect), false);
  });

  it("counts company landline plus contact mobile", () => {
    const prospect = {
      landline: "020 7946 0958",
      contacts: [{ name: "Ada", mobile: "07700 900111" }],
    };
    assert.equal(shouldExpandPhoneCandidates(prospect), true);
  });
});
