import assert from "node:assert/strict";
import {
  enrichmentNextAction,
  enrichmentSessionNextAction,
} from "../src/lib/enrichmentNextAction.js";

{
  const next = enrichmentNextAction({
    listId: "list1",
    phonesFound: 8,
    emailsFound: 3,
    completed: 10,
  });
  assert.equal(next.id, "start_calling");
  assert.match(next.href, /\/dialer\?list=list1/);
  assert.equal(next.secondary.href, "/outreach");
}

{
  const next = enrichmentNextAction({
    listId: "list1",
    emailsFound: 5,
    contactsFound: 5,
    phonesFound: 0,
    completed: 5,
  });
  assert.equal(next.id, "outreach_ready");
  assert.equal(next.href, "/outreach");
}

{
  const next = enrichmentNextAction({
    listId: "list1",
    failed: 4,
    completed: 1,
    phonesFound: 0,
    emailsFound: 0,
    onProspectingPage: true,
  });
  assert.equal(next.id, "review_failures");
  assert.equal(next.action, "filter_attention");
  assert.equal(next.href, null);
}

{
  const next = enrichmentSessionNextAction({
    prospect_list_id: "pl1",
    completed_count: 6,
    partial_count: 1,
    failed_count: 0,
    cached_count: 2,
  });
  assert.equal(next.id, "start_calling");
  assert.match(next.href, /list=pl1/);
}

{
  const next = enrichmentSessionNextAction(
    { prospect_list_id: "pl1", completed_count: 0, failed_count: 3 },
    { onProspectingPage: true },
  );
  assert.equal(next.id, "review_failures");
  assert.equal(next.action, "filter_attention");
}

console.log("enrichment-next-action.test.mjs: ok");
