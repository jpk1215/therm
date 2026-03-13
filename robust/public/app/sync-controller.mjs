import { DEFAULT_STATE, POLL_MS } from "./constants.mjs";
import { getStateKey, normalizeState } from "./state-utils.mjs";

const HIDDEN_POLL_MS = 5000;
const REQUEST_TIMEOUT_MS = 4000;
const MAX_BACKOFF_MS = 10000;

// This controller owns the app's live-sync state machine:
// - polling and backoff for both modes
// - serialized control-mode writes
// - optimistic preview updates with safe recovery to last known live state
export function createSyncController({ adminToken, campaign, elements, mode, renderer }) {
  let holdControlErrorUntilMs = 0;
  let isEditing = false;
  let lastLiveState = normalizeState(DEFAULT_STATE);
  let lastSuccessfulPushStateKey = "";
  let pushInFlight = false;
  let pushQueued = false;
  let refreshDelayMs = POLL_MS;
  let refreshInFlight = false;
  let refreshTimerId = null;
  let suppressRemoteUntilMs = 0;

  function getPollDelay() {
    return document.hidden ? HIDDEN_POLL_MS : POLL_MS;
  }

  function getTimestampLabel(prefix) {
    const formatted = new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });
    return `${prefix} ${formatted}`;
  }

  function scheduleRefresh(delayMs = getPollDelay()) {
    clearTimeout(refreshTimerId);
    refreshTimerId = window.setTimeout(() => {
      refreshLoop();
    }, delayMs);
  }

  function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    return fetch(url, {
      ...options,
      signal: controller.signal
    }).finally(() => {
      window.clearTimeout(timeoutId);
    });
  }

  function markQueuedPush() {
    pushQueued = true;
    renderer.setStatus("Syncing latest update...");
    renderer.setSyncMeta("Finishing the latest queued change...");
  }

  // Control mode deliberately keeps one write in flight at a time so a slower
  // earlier response cannot overwrite a newer edit from the same session.
  async function pushState() {
    if (mode !== "control") return;

    if (!campaign) {
      renderer.showCampaignError();
      return;
    }

    if (!adminToken) {
      renderer.setStatus("Missing token. Open control URL with ?token=YOUR_ADMIN_WRITE_TOKEN", "error");
      renderer.setSyncMeta("Add a valid admin token to enable live updates.");
      return;
    }

    const state = renderer.readStateFromInputs();
    const stateKey = getStateKey(state);

    if (stateKey === lastSuccessfulPushStateKey) {
      renderer.setStatus("Live and synced.");
      renderer.setSyncMeta("No unsynced changes.");
      return;
    }

    if (pushInFlight) {
      markQueuedPush();
      return;
    }

    pushInFlight = true;
    suppressRemoteUntilMs = Date.now() + (POLL_MS * 2);
    renderer.renderThermometer(state, { syncInputs: false });
    renderer.setStatus("Syncing update...");
    renderer.setSyncMeta("Sending update to the live display...");

    try {
      const response = await fetchJson(`/api/state?campaign=${encodeURIComponent(campaign)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken
        },
        body: JSON.stringify(state)
      });

      if (!response.ok) {
        throw new Error("Write failed");
      }

      lastLiveState = normalizeState(state);
      holdControlErrorUntilMs = 0;
      lastSuccessfulPushStateKey = stateKey;

      if (getStateKey(renderer.readStateFromInputs()) === stateKey && !pushQueued) {
        renderer.setStatus("Live and synced.");
        renderer.setSyncMeta(getTimestampLabel("Last control sync:"));
      } else {
        markQueuedPush();
      }
    } finally {
      pushInFlight = false;
    }

    if (pushQueued) {
      pushQueued = false;
      return pushState();
    }
  }

  function recoverFromFailedPush() {
    pushQueued = false;
    holdControlErrorUntilMs = Date.now() + 3000;
    renderer.renderThermometer(lastLiveState, { syncInputs: false });
    renderer.setStatus("Could not sync update. Showing last live state.", "error");
    renderer.setSyncMeta("Update failed. Inputs are unsynced; showing the last live state.");
    refreshDelayMs = POLL_MS;
  }

  function debounce(callback, delayMs) {
    let timerId;
    const debounced = (...args) => {
      clearTimeout(timerId);
      timerId = setTimeout(() => callback(...args), delayMs);
    };

    debounced.cancel = () => {
      clearTimeout(timerId);
    };

    return debounced;
  }

  const debouncedPush = debounce(() => {
    pushState().catch(() => {
      recoverFromFailedPush();
    });
  }, 220);

  async function fetchState() {
    const response = await fetchJson(`/api/state?campaign=${encodeURIComponent(campaign)}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Failed to fetch");
    }

    return response.json();
  }

  async function refreshLoop() {
    if (refreshInFlight) {
      return;
    }

    if (!campaign) {
      renderer.showCampaignError();
      return;
    }

    refreshInFlight = true;

    try {
      const latest = await fetchState();
      const shouldSyncInputs = !(mode === "control" && (isEditing || Date.now() < suppressRemoteUntilMs));
      lastLiveState = normalizeState(latest);
      renderer.renderThermometer(latest, { syncInputs: shouldSyncInputs });
      lastSuccessfulPushStateKey = getStateKey(latest);
      refreshDelayMs = getPollDelay();

      if (mode === "display") {
        renderer.setStatus(`Display mode live. Campaign: ${campaign}`);
      } else if (adminToken) {
        if (Date.now() >= holdControlErrorUntilMs) {
          renderer.setStatus(`Control mode live. Campaign: ${campaign}`);
          renderer.setSyncMeta(getTimestampLabel("Last live refresh:"));
        }
      } else {
        renderer.setStatus("Control mode loaded, but token is missing.", "error");
        renderer.setSyncMeta("Add a valid admin token to enable live updates.");
      }
    } catch (_error) {
      refreshDelayMs = Math.min(MAX_BACKOFF_MS, Math.max(getPollDelay(), refreshDelayMs * 2));
      renderer.setStatus("Unable to reach live state. Retrying...", "error");
      if (mode === "control") {
        renderer.setSyncMeta("Connection issue. Retrying automatically...");
      }
    } finally {
      refreshInFlight = false;
      scheduleRefresh(refreshDelayMs);
    }
  }

  function attachControlListeners() {
    renderer.setTokenBadge(Boolean(adminToken));

    for (const input of elements.controlInputs) {
      input.addEventListener("focus", () => {
        isEditing = true;
      });

      input.addEventListener("blur", () => {
        isEditing = false;
      });

      input.addEventListener("input", () => {
        suppressRemoteUntilMs = Date.now() + (POLL_MS * 2);
      });

      input.addEventListener("input", debouncedPush);
      input.addEventListener("change", () => {
        debouncedPush.cancel();
        pushState().catch(() => {
          recoverFromFailedPush();
        });
      });
    }
  }

  function start() {
    renderer.renderThermometer(DEFAULT_STATE);

    if (mode === "control") {
      attachControlListeners();
    }

    refreshLoop();

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        refreshDelayMs = POLL_MS;
        refreshLoop();
      }
    });
  }

  return {
    start
  };
}
