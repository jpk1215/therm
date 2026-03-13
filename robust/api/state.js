const admin = require("firebase-admin");

let initialized = false;

function env(name, fallbackName) {
  const primary = process.env[name];
  if (primary) return primary;
  if (fallbackName) return process.env[fallbackName];
  return undefined;
}

function getPrivateKey() {
  return (env("FIREBASE_PRIVATE_KEY", "private_key") || "").replace(/\\n/g, "\n");
}

function initFirebase() {
  if (initialized) return;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env("FIREBASE_PROJECT_ID", "project_id"),
      clientEmail: env("FIREBASE_CLIENT_EMAIL", "client_email"),
      privateKey: getPrivateKey()
    }),
    databaseURL: env("FIREBASE_DATABASE_URL")
  });

  initialized = true;
}

function normalizeNumber(value, fallback, min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n < min ? fallback : n;
}

function normalizeState(raw) {
  const maxValue = normalizeNumber(raw?.maxValue, 100000, 1);
  const incrementValue = normalizeNumber(raw?.incrementValue, 10000, 1);
  const currentRaw = normalizeNumber(raw?.currentValue, 0, 0);
  const currentValue = Math.min(currentRaw, maxValue);
  return { maxValue, incrementValue, currentValue };
}

module.exports = async function handler(req, res) {
  initFirebase();

  const campaign = String(req.query.campaign || "default");
  const path = `campaigns/${campaign}`;
  const ref = admin.database().ref(path);

  if (req.method === "GET") {
    const snapshot = await ref.get();
    const data = snapshot.val() || { maxValue: 100000, incrementValue: 10000, currentValue: 1250 };
    return res.status(200).json(normalizeState(data));
  }

  if (req.method === "POST") {
    const sentToken = req.headers["x-admin-token"];
    if (!process.env.ADMIN_WRITE_TOKEN || sentToken !== process.env.ADMIN_WRITE_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const normalized = normalizeState(req.body || {});
    await ref.set({
      ...normalized,
      updatedAt: Date.now()
    });
    return res.status(200).json({ ok: true, state: normalized });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
