import assert from "node:assert/strict";
import {
  attentionForCampaign,
  buildCampaignAttentionRollup,
  countIrsByCampaign,
} from "../src/lib/campaignAttention.js";

{
  const item = attentionForCampaign({
    campaign: { id: "c1", name: "Zenitech", status: "draft" },
    companies: 0,
    contacts: 0,
    canProspect: true,
    isManager: true,
  });
  assert.equal(item.id, "add_companies");
}

{
  const item = attentionForCampaign({
    campaign: { id: "c1", name: "Zenitech", status: "draft", assigned_user_ids: [] },
    companies: 10,
    contacts: 40,
    canProspect: true,
    isManager: true,
  });
  assert.equal(item.id, "activate");
}

{
  const item = attentionForCampaign({
    campaign: { id: "c1", name: "Zenitech", status: "active", assigned_user_ids: [] },
    companies: 10,
    contacts: 40,
    canProspect: true,
    isManager: true,
  });
  assert.equal(item.id, "no_callers");
}

{
  const item = attentionForCampaign({
    campaign: { id: "c1", name: "Zenitech", status: "active", assigned_user_ids: ["u1"] },
    companies: 10,
    contacts: 40,
    canProspect: true,
    isManager: true,
    pendingIrCount: 2,
  });
  assert.equal(item.id, "info_requests");
  assert.match(item.label, /2 info requests/);
}

{
  const item = attentionForCampaign({
    campaign: { id: "c1", name: "Done", status: "completed" },
    companies: 0,
    contacts: 0,
    canProspect: true,
    isManager: true,
  });
  assert.equal(item, null);
}

{
  const map = countIrsByCampaign([
    { campaign_id: "a" },
    { campaign_id: "a" },
    { campaign_id: "b" },
    { campaign_id: "" },
  ]);
  assert.equal(map.a, 2);
  assert.equal(map.b, 1);
}

{
  const rollup = buildCampaignAttentionRollup({
    campaigns: [
      { id: "c1", name: "Needs companies", status: "draft" },
      { id: "c2", name: "Active with callers", status: "active", assigned_user_ids: ["u1"] },
      { id: "c3", name: "Needs contacts", status: "draft" },
    ],
    companyCounts: { c1: 0, c2: 5, c3: 8 },
    contactCounts: { c1: 0, c2: 20, c3: 0 },
    canProspect: true,
    isManager: true,
  });
  assert.equal(rollup.total, 2);
  assert.equal(rollup.items[0].id, "add_companies");
  assert.equal(rollup.items[1].id, "find_contacts");
}

console.log("campaign-attention.test.mjs: ok");
