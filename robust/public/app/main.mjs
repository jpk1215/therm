import { DEFAULT_STATE, POLL_MS } from "./constants.mjs";
import { formatMoney } from "./format.mjs";
import { getScaleValues } from "./scale.mjs";
import { normalizeState } from "./state-utils.mjs";

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
const maxInput = document.getElementById("maxValue");
const currentInput = document.getElementById("currentValue");
const fillEl = document.getElementById("fill");
const tickListEl = document.getElementById("tickList");
const raisedTextEl = document.getElementById("raisedText");
const goalTextEl = document.getElementById("goalText");
const percentTextEl = document.getElementById("percentText");
const controlInputs = [maxInput, currentInput];

let isEditing = false;
let suppressRemoteUntilMs = 0;

if (mode === "display") {
  document.body.classList.add("display-viewport");
  controlsEl.classList.add("hidden");
  containerEl.classList.add("display-mode");
} else {
  containerEl.classList.add("control-mode");
  subtitleEl.textContent = "Control mode is active. Updates are synced to the live display.";
}

function applyStateToInputs(state) {
  maxInput.value = String(state.maxValue);
  currentInput.value = String(state.currentValue);
}

function readStateFromInputs() {
  return normalizeState({
    maxValue: maxInput.value,
    currentValue: currentInput.value
  });
}

function debounce(callback, delayMs) {
  let timerId;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => callback(...args), delayMs);
  };
}

function setStatus(message, type = "ok") {
  statusTextEl.innerHTML = `<strong>Status:</strong> ${message}`;
  if (type === "error") {
    statusTextEl.style.background = "#fff4f4";
    statusTextEl.style.borderColor = "#f3cccc";
  } else {
    statusTextEl.style.background = "#f3faf5";
    statusTextEl.style.borderColor = "#d7e9dc";
  }
}

function createTicks(maxValue) {
  tickListEl.innerHTML = "";
  const scaleValues = getScaleValues(maxValue);

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
    tickListEl.appendChild(item);
  }
}

function renderThermometer(state, options = {}) {
  const shouldSyncInputs = options.syncInputs !== false;
  const normalized = normalizeState(state);
  const percent = (normalized.currentValue / normalized.maxValue) * 100;

  fillEl.style.height = `${percent}%`;
  fillEl.setAttribute("aria-valuenow", String(Math.round(percent)));
  raisedTextEl.textContent = formatMoney(normalized.currentValue);
  goalTextEl.textContent = formatMoney(normalized.maxValue);
  percentTextEl.textContent = `${Math.round(percent)}%`;
  createTicks(normalized.maxValue);

  if (mode === "control" && shouldSyncInputs) {
    applyStateToInputs(normalized);
  }
}

async function fetchState() {
  const response = await fetch(`/api/state?campaign=${encodeURIComponent(campaign)}`, {
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
    return;
  }

  const state = readStateFromInputs();
  suppressRemoteUntilMs = Date.now() + (POLL_MS * 2);
  renderThermometer(state, { syncInputs: false });
  setStatus("Syncing update...");

  const response = await fetch(`/api/state?campaign=${encodeURIComponent(campaign)}`, {
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

  setStatus("Live and synced.");
}

const debouncedPush = debounce(() => {
  pushState().catch(() => {
    setStatus("Could not sync update. Check token/connection.", "error");
  });
}, 220);

if (mode === "control") {
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

  maxInput.addEventListener("input", () => {
    suppressRemoteUntilMs = Date.now() + (POLL_MS * 2);
  });

  currentInput.addEventListener("input", () => {
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
}

async function refreshLoop() {
  try {
    const latest = await fetchState();
    const shouldSyncInputs = !(mode === "control" && (isEditing || Date.now() < suppressRemoteUntilMs));
    renderThermometer(latest, { syncInputs: shouldSyncInputs });

    if (mode === "display") {
      setStatus(`Display mode live. Campaign: ${campaign}`);
    } else if (adminToken) {
      setStatus(`Control mode live. Campaign: ${campaign}`);
    } else {
      setStatus("Control mode loaded, but token is missing.", "error");
    }
  } catch (_error) {
    setStatus("Unable to reach live state. Retrying...", "error");
  }
}

renderThermometer(DEFAULT_STATE);
refreshLoop();
setInterval(refreshLoop, POLL_MS);
