import assert from "node:assert/strict";
import { campaignNextAction, todayNextAction } from "../src/lib/campaignNextAction.js";

{
  const next = campaignNextAction({ companies: 0, contacts: 0, canProspect: true, campaignId: "c1" });
  assert.equal(next.id, "add_companies");
  assert.match(next.href, /import=1/);
}

{
  const next = campaignNextAction({ companies: 12, contacts: 0, canProspect: true, campaignId: "c1" });
  assert.equal(next.id, "find_contacts");
}

{
  const next = campaignNextAction({
    companies: 12,
    contacts: 40,
    status: "draft",
    canProspect: true,
    isManager: true,
    campaignId: "c1",
  });
  assert.equal(next.id, "activate");
  assert.equal(next.action, "activate");
}

{
  const next = campaignNextAction({
    companies: 12,
    contacts: 40,
    status: "active",
    canProspect: true,
    isManager: true,
    campaignId: "c1",
  });
  assert.equal(next.id, "start_calling");
  assert.match(next.href, /dialer/);
}

{
  const next = todayNextAction({ dueNow: 3, overdue: 1 });
  assert.equal(next.kind, "call");
  assert.equal(next.id, "continue_calling");
}

{
  const next = todayNextAction({ canProspect: true, isAdmin: true });
  assert.equal(next.kind, "prospect");
  assert.match(next.href, /tab=prospect/);
}

{
  const next = todayNextAction({
    lastDialResume: {
      companyId: "co1",
      companyName: "Acme Ltd",
      listId: "camp1",
      campaignName: "Oxi-Tech",
    },
  });
  assert.equal(next.kind, "resume");
  assert.equal(next.id, "resume_dial");
  assert.match(next.href, /company=co1/);
  assert.match(next.href, /list=camp1/);
  assert.match(next.title, /Acme Ltd/);
}

console.log("campaign-next-action.test.mjs: ok");
