const DEFAULT_CAMPAIGN = "default";
const CAMPAIGN_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function normalizeCampaignId(value) {
  const candidate = String(value || "").trim() || DEFAULT_CAMPAIGN;

  if (!CAMPAIGN_ID_PATTERN.test(candidate)) {
    const error = new Error("Invalid campaign ID. Use letters, numbers, hyphens, or underscores.");
    error.statusCode = 400;
    throw error;
  }

  return candidate;
}

module.exports = {
  DEFAULT_CAMPAIGN,
  CAMPAIGN_ID_PATTERN,
  normalizeCampaignId
};
