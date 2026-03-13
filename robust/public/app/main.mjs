import { DEFAULT_STATE, POLL_MS } from "./constants.mjs";
import { formatMoney } from "./format.mjs";
import { getScaleValues } from "./scale.mjs";
import { getStateKey, normalizeState } from "./state-utils.mjs";

const HIDDEN_POLL_MS = 5000;
const REQUEST_TIMEOUT_MS = 4000;
const MAX_BACKOFF_MS = 10000;
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") === "control" ? "control" : "display";
const campaign = params.get("campaign") || "default";
const tokenParam = params.get("token");
const tokenStorageKey = `therm-admin-token:${campaign}`;

if (tokenParam) {
  localStorage.setItem(tokenStorageKey, tokenParam);
  params.delete("token");
  const cleanQuery = params.toString();
  history.replaceState(null, "", window.location.pathname + (cleanQuery ? `?${cleanQuery}` : ""));
}

const adminToken = localStorage.getItem(tokenStorageKey) || "";

const containerEl = document.getElementById("container");
const controlsEl = document.getElementById("controls");
const subtitleEl = document.getElementById("subtitle");
const statusTextEl = document.getElementById("statusText");
const campaignBadgeEl = document.getElementById("campaignBadge");
const tokenBadgeEl = document.getElementById("tokenBadge");
const syncMetaEl = document.getElementById("syncMeta");
const maxInput = document.getElementById("maxValue");
const currentInput = document.getElementById("currentValue");
const incrementInput = document.getElementById("incrementValue");
const fillEl = document.getElementById("fill");
const tickListEl = document.getElementById("tickList");
const raisedTextEl = document.getElementById("raisedText");
const goalTextEl = document.getElementById("goalText");
const stepTextEl = document.getElementById("stepText");
const percentTextEl = document.getElementById("percentText");
const controlInputs = [maxInput, currentInput, incrementInput];

let isEditing = false;
let suppressRemoteUntilMs = 0;
let refreshInFlight = false;
let lastRenderedStateKey = "";
let lastSuccessfulPushStateKey = "";
let lastRenderedTickMaxValue = null;
let lastStatusSignature = "";
let lastSyncMetaText = "";
let refreshTimerId = null;
let refreshDelayMs = POLL_MS;

if (mode === "display") {
  document.body.classList.add("display-viewport");
  controlsEl.classList.add("hidden");
  containerEl.classList.add("display-mode");
} else {
  containerEl.classList.add("control-mode");
  subtitleEl.textContent = "Control mode is active. Updates are synced to the live display.";
  campaignBadgeEl.textContent = `Campaign: ${campaign}`;
}

function applyStateToInputs(state) {
  maxInput.value = String(state.maxValue);
  currentInput.value = String(state.currentValue);
  incrementInput.value = String(state.incrementValue);
}

function readStateFromInputs() {
  return normalizeState({
    maxValue: maxInput.value,
    currentValue: currentInput.value,
    incrementValue: incrementInput.value
  });
}

function debounce(callback, delayMs) {
  let timerId;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => callback(...args), delayMs);
  };
}

function getPollDelay() {
  return document.hidden ? HIDDEN_POLL_MS : POLL_MS;
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

function setTokenBadge(isReady) {
  tokenBadgeEl.classList.remove("badge-success", "badge-warning");

  if (isReady) {
    tokenBadgeEl.classList.add("badge-success");
    tokenBadgeEl.textContent = "Token ready";
    return;
  }

  tokenBadgeEl.classList.add("badge-warning");
  tokenBadgeEl.textContent = "Token required";
}

function setSyncMeta(message) {
  if (message === lastSyncMetaText) {
    return;
  }

  lastSyncMetaText = message;
  syncMetaEl.textContent = message;
}

function getTimestampLabel(prefix) {
  const formatted = new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  });
  return `${prefix} ${formatted}`;
}

function setStatus(message, type = "ok") {
  const signature = `${type}:${message}`;
  if (signature === lastStatusSignature) {
    return;
  }

  lastStatusSignature = signature;
  statusTextEl.innerHTML = `<strong>Status:</strong> ${message}`;
  if (type === "error") {
    statusTextEl.style.background = "#fff4f4";
    statusTextEl.style.borderColor = "#f3cccc";
  } else {
    statusTextEl.style.background = "#f3faf5";
    statusTextEl.style.borderColor = "#d7e9dc";
  }
}

function createTicks(maxValue, incrementValue) {
  const tickSignature = `${maxValue}:${incrementValue}`;
  if (lastRenderedTickMaxValue === tickSignature) {
    return;
  }

  tickListEl.innerHTML = "";
  const scaleValues = getScaleValues(maxValue, incrementValue);
  const fragment = document.createDocumentFragment();

  for (const tickValue of scaleValues) {
    const positionPercent = (tickValue / maxValue) * 100;

    const item = document.createElement("li");
    item.style.bottom = `${positionPercent}%`;

    const mark = document.createElement("span");
    mark.className = "tick-mark";

    const label = document.createElement("span");
    label.textContent = formatMoney(tickValue);

    item.appendChild(mark);
    item.appendChild(label);
    fragment.appendChild(item);
  }

  tickListEl.appendChild(fragment);
  lastRenderedTickMaxValue = tickSignature;
}

function renderThermometer(state, options = {}) {
  const shouldSyncInputs = options.syncInputs !== false;
  const normalized = normalizeState(state);
  const stateKey = getStateKey(normalized);
  const percent = (normalized.currentValue / normalized.maxValue) * 100;

  if (lastRenderedStateKey !== stateKey) {
    fillEl.style.height = `${percent}%`;
    fillEl.setAttribute("aria-valuenow", String(Math.round(percent)));
    raisedTextEl.textContent = formatMoney(normalized.currentValue);
    goalTextEl.textContent = formatMoney(normalized.maxValue);
    stepTextEl.textContent = formatMoney(normalized.incrementValue);
    percentTextEl.textContent = `${Math.round(percent)}%`;
    lastRenderedStateKey = stateKey;
  }

  createTicks(normalized.maxValue, normalized.incrementValue);

  if (mode === "control" && shouldSyncInputs) {
    applyStateToInputs(normalized);
  }
}

async function fetchState() {
  const response = await fetchJson(`/api/state?campaign=${encodeURIComponent(campaign)}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch");
  }

  return response.json();
}

async function pushState() {
  if (mode !== "control") return;

  if (!adminToken) {
    setStatus("Missing token. Open control URL with ?token=YOUR_ADMIN_WRITE_TOKEN", "error");
    setSyncMeta("Add a valid admin token to enable live updates.");
    return;
  }

  const state = readStateFromInputs();
  const stateKey = getStateKey(state);

  if (stateKey === lastSuccessfulPushStateKey) {
    setStatus("Live and synced.");
    setSyncMeta("No unsynced changes.");
    return;
  }

  suppressRemoteUntilMs = Date.now() + (POLL_MS * 2);
  renderThermometer(state, { syncInputs: false });
  setStatus("Syncing update...");
  setSyncMeta("Sending update to the live display...");

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

  lastSuccessfulPushStateKey = stateKey;
  setStatus("Live and synced.");
  setSyncMeta(getTimestampLabel("Last control sync:"));
}

const debouncedPush = debounce(() => {
  pushState().catch(() => {
    setStatus("Could not sync update. Check token/connection.", "error");
  });
}, 220);

if (mode === "control") {
  setTokenBadge(Boolean(adminToken));

  for (const input of controlInputs) {
    input.addEventListener("focus", () => {
      isEditing = true;
    });

    input.addEventListener("blur", () => {
      isEditing = false;
    });
  }

  maxInput.addEventListener("input", debouncedPush);
  currentInput.addEventListener("input", debouncedPush);
  incrementInput.addEventListener("input", debouncedPush);

  maxInput.addEventListener("input", () => {
    suppressRemoteUntilMs = Date.now() + (POLL_MS * 2);
  });

  currentInput.addEventListener("input", () => {
    suppressRemoteUntilMs = Date.now() + (POLL_MS * 2);
  });

  incrementInput.addEventListener("input", () => {
    suppressRemoteUntilMs = Date.now() + (POLL_MS * 2);
  });

  maxInput.addEventListener("change", () => {
    pushState().catch(() => {
      setStatus("Could not sync update. Check token/connection.", "error");
    });
  });

  currentInput.addEventListener("change", () => {
    pushState().catch(() => {
      setStatus("Could not sync update. Check token/connection.", "error");
    });
  });

  incrementInput.addEventListener("change", () => {
    pushState().catch(() => {
      setStatus("Could not sync update. Check token/connection.", "error");
    });
  });
}

async function refreshLoop() {
  if (refreshInFlight) {
    return;
  }

  refreshInFlight = true;

  try {
    const latest = await fetchState();
    const shouldSyncInputs = !(mode === "control" && (isEditing || Date.now() < suppressRemoteUntilMs));
    renderThermometer(latest, { syncInputs: shouldSyncInputs });
    lastSuccessfulPushStateKey = getStateKey(latest);
    refreshDelayMs = getPollDelay();

    if (mode === "display") {
      setStatus(`Display mode live. Campaign: ${campaign}`);
    } else if (adminToken) {
      setStatus(`Control mode live. Campaign: ${campaign}`);
      setSyncMeta(getTimestampLabel("Last live refresh:"));
    } else {
      setStatus("Control mode loaded, but token is missing.", "error");
      setSyncMeta("Add a valid admin token to enable live updates.");
    }
  } catch (_error) {
    refreshDelayMs = Math.min(MAX_BACKOFF_MS, Math.max(getPollDelay(), refreshDelayMs * 2));
    setStatus("Unable to reach live state. Retrying...", "error");
    if (mode === "control") {
      setSyncMeta("Connection issue. Retrying automatically...");
    }
  } finally {
    refreshInFlight = false;
    scheduleRefresh(refreshDelayMs);
  }
}

renderThermometer(DEFAULT_STATE);
refreshLoop();

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshDelayMs = POLL_MS;
    refreshLoop();
  }
});
