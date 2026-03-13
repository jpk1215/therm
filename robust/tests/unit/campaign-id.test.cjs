const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeCampaignId } = require("../../lib/campaign-id");

test("normalizeCampaignId falls back to default when omitted", () => {
  assert.equal(normalizeCampaignId(), "default");
  assert.equal(normalizeCampaignId(""), "default");
});

test("normalizeCampaignId accepts safe campaign names", () => {
  assert.equal(normalizeCampaignId("ramadan-2026"), "ramadan-2026");
  assert.equal(normalizeCampaignId("main_stage"), "main_stage");
});

test("normalizeCampaignId rejects unsafe campaign names", () => {
  assert.throws(
    () => normalizeCampaignId("bad/name"),
    /Invalid campaign ID/
  );
});
