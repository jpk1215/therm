export const DEFAULT_CAMPAIGN = "default";

// This mirrors the server-side campaign rule in `lib/campaign-id.js`, but the
// browser returns an empty string instead of throwing so the UI can render a
// recoverable invalid-campaign state.
export const CAMPAIGN_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function normalizeCampaignId(value) {
  const candidate = String(value || "").trim() || DEFAULT_CAMPAIGN;
  return CAMPAIGN_ID_PATTERN.test(candidate) ? candidate : "";
}

export function getTokenStorageKey(campaign) {
  return `therm-admin-token:${campaign || DEFAULT_CAMPAIGN}`;
}

export function readTokenFromStorage(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function persistToken(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
