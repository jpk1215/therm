"use strict";

const { randomUUID } = require("node:crypto");
const { expect } = require("@playwright/test");

function buildCampaignId(testInfo, prefix = "campaign") {
  const normalizedPrefix = String(prefix)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 16) || "campaign";

  const titleSlug = String(testInfo.title || "spec")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "spec";

  const uniqueSuffix = `${testInfo.workerIndex || 0}${testInfo.retry || 0}-${randomUUID().slice(0, 8)}`;
  return `${normalizedPrefix}-${titleSlug}-${uniqueSuffix}`.slice(0, 64);
}

async function seedCampaign(request, campaign, state) {
  const response = await request.post(`/api/test/reset?campaign=${campaign}`, {
    data: state
  });
  expect(response.ok()).toBeTruthy();
}

async function injectFault(request, target, count = 1) {
  const response = await request.post("/api/test/fault", {
    data: { target, count }
  });
  expect(response.ok()).toBeTruthy();
}

module.exports = {
  buildCampaignId,
  injectFault,
  seedCampaign
};
