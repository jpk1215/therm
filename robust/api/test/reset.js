const { DEFAULT_STATE } = require("../../lib/state-model");
const { normalizeCampaignId } = require("../../lib/campaign-id");
const { canUseTestApi, resetState } = require("../../lib/state-store");

module.exports = async function handler(req, res) {
  try {
    if (!canUseTestApi()) {
      return res.status(403).json({ error: "Test reset API is disabled" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const campaign = normalizeCampaignId(req.query.campaign);
    const state = await resetState(campaign, req.body || DEFAULT_STATE);
    return res.status(200).json({ ok: true, state });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Server error" });
  }
};
