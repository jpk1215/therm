const admin = require("firebase-admin");
const { normalizeCampaignId } = require("./campaign-id");
const { DEFAULT_STATE, normalizeState } = require("./state-model");

let initialized = false;
const memoryStore = new Map();

function env(name, fallbackName) {
  const primary = process.env[name];
  if (primary) return primary;
  if (fallbackName) return process.env[fallbackName];
  return undefined;
}

function getPrivateKey() {
  return (env("FIREBASE_PRIVATE_KEY", "private_key") || "").replace(/\\n/g, "\n");
}

function isMemoryMode() {
  return process.env.THERM_STATE_MODE === "memory";
}

function canUseTestApi() {
  return process.env.ALLOW_TEST_API === "1" || isMemoryMode();
}

function initFirebase() {
  if (initialized || isMemoryMode()) return;

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

function getMemoryState(campaign) {
  if (!memoryStore.has(campaign)) {
    memoryStore.set(campaign, {
      ...DEFAULT_STATE,
      updatedAt: Date.now()
    });
  }

  return memoryStore.get(campaign);
}

async function getState(campaign) {
  const normalizedCampaign = normalizeCampaignId(campaign);

  if (isMemoryMode()) {
    return normalizeState(getMemoryState(normalizedCampaign));
  }

  initFirebase();
  const ref = admin.database().ref(`campaigns/${normalizedCampaign}`);
  const snapshot = await ref.get();
  const data = snapshot.val() || DEFAULT_STATE;
  return normalizeState(data);
}

async function setState(campaign, rawState) {
  const normalizedCampaign = normalizeCampaignId(campaign);
  const normalized = normalizeState(rawState);

  if (isMemoryMode()) {
    memoryStore.set(normalizedCampaign, {
      ...normalized,
      updatedAt: Date.now()
    });
    return normalized;
  }

  initFirebase();
  const ref = admin.database().ref(`campaigns/${normalizedCampaign}`);
  await ref.set({
    ...normalized,
    updatedAt: Date.now()
  });
  return normalized;
}

async function resetState(campaign, rawState) {
  const normalizedCampaign = normalizeCampaignId(campaign);
  const normalized = normalizeState(rawState || DEFAULT_STATE);

  if (isMemoryMode()) {
    memoryStore.set(normalizedCampaign, {
      ...normalized,
      updatedAt: Date.now()
    });
    return normalized;
  }

  if (!canUseTestApi()) {
    throw new Error("Test reset API is disabled");
  }

  initFirebase();
  const ref = admin.database().ref(`campaigns/${normalizedCampaign}`);
  await ref.set({
    ...normalized,
    updatedAt: Date.now()
  });
  return normalized;
}

module.exports = {
  canUseTestApi,
  getState,
  setState,
  resetState
};
