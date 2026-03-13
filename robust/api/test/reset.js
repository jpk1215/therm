const { DEFAULT_STATE } = require("../../lib/state-model");
const { canUseTestApi, resetState } = require("../../lib/state-store");

module.exports = async function handler(req, res) {
  if (!canUseTestApi()) {
    return res.status(403).json({ error: "Test reset API is disabled" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const campaign = String(req.query.campaign || "default");
  const state = await resetState(campaign, req.body || DEFAULT_STATE);
  return res.status(200).json({ ok: true, state });
};
