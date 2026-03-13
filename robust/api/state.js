const { getState, setState } = require("../lib/state-store");

module.exports = async function handler(req, res) {
  const campaign = String(req.query.campaign || "default");

  if (req.method === "GET") {
    const state = await getState(campaign);
    return res.status(200).json(state);
  }

  if (req.method === "POST") {
    const sentToken = req.headers["x-admin-token"];
    if (!process.env.ADMIN_WRITE_TOKEN || sentToken !== process.env.ADMIN_WRITE_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const normalized = await setState(campaign, req.body || {});
    return res.status(200).json({ ok: true, state: normalized });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
