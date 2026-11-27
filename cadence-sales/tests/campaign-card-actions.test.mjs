import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { campaignCardActionSlots } from "../src/lib/campaignCardActions.js";

describe("campaignCardActionSlots", () => {
  it("keeps Pause, Contacts, Push on the face for managers", () => {
    const slots = campaignCardActionSlots({
      isManager: true,
      isAdmin: false,
      canProspect: true,
      status: "active",
    });
    assert.equal(slots.showPauseActivate, true);
    assert.equal(slots.showContacts, true);
    assert.equal(slots.showPush, true);
    assert.ok(slots.more.includes("split"));
    assert.ok(slots.more.includes("data_quality"));
    assert.ok(slots.more.includes("accounts_notes"));
    assert.ok(slots.more.includes("find_prospects"));
    assert.ok(slots.more.includes("delete"));
    assert.ok(!slots.more.includes("email_drafts"));
  });

  it("hides Pause/Push for callers; still shows Contacts", () => {
    const slots = campaignCardActionSlots({
      isManager: false,
      canProspect: false,
      status: "active",
    });
    assert.equal(slots.showPauseActivate, false);
    assert.equal(slots.showPush, false);
    assert.equal(slots.showContacts, true);
    assert.deepEqual(slots.more, ["open", "data_quality", "accounts_notes"]);
  });

  it("adds admin email-drafts toggle under More", () => {
    const slots = campaignCardActionSlots({
      isManager: true,
      isAdmin: true,
      canProspect: true,
      status: "draft",
    });
    assert.ok(slots.more.includes("email_drafts"));
  });
});
