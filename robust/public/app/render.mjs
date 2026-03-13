import { formatMoney } from "./format.mjs";
import { getScaleValues } from "./scale.mjs";
import { getStateKey, normalizeState } from "./state-utils.mjs";

export function createRenderer(elements, { mode }) {
  let lastRenderedStateKey = "";
  let lastRenderedTickMaxValue = null;
  let lastStatusSignature = "";
  let lastSyncMetaText = "";

  function setTokenBadge(isReady) {
    elements.tokenBadgeEl.classList.remove("badge-success", "badge-warning");

    if (isReady) {
      elements.tokenBadgeEl.classList.add("badge-success");
      elements.tokenBadgeEl.textContent = "Token ready";
      return;
    }

    elements.tokenBadgeEl.classList.add("badge-warning");
    elements.tokenBadgeEl.textContent = "Token required";
  }

  function setSyncMeta(message) {
    if (message === lastSyncMetaText) {
      return;
    }

    lastSyncMetaText = message;
    elements.syncMetaEl.textContent = message;
  }

  function setStatus(message, type = "ok") {
    const signature = `${type}:${message}`;
    if (signature === lastStatusSignature) {
      return;
    }

    lastStatusSignature = signature;
    const label = document.createElement("strong");
    label.textContent = "Status:";
    elements.statusTextEl.replaceChildren(label, document.createTextNode(` ${message}`));

    if (type === "error") {
      elements.statusTextEl.style.background = "#fff4f4";
      elements.statusTextEl.style.borderColor = "#f3cccc";
      return;
    }

    elements.statusTextEl.style.background = "#f3faf5";
    elements.statusTextEl.style.borderColor = "#d7e9dc";
  }

  function applyStateToInputs(state) {
    elements.maxInput.value = String(state.maxValue);
    elements.currentInput.value = String(state.currentValue);
  }

  function readStateFromInputs() {
    return normalizeState({
      maxValue: elements.maxInput.value,
      currentValue: elements.currentInput.value
    });
  }

  function createTicks(maxValue) {
    const tickSignature = String(maxValue);
    if (lastRenderedTickMaxValue === tickSignature) {
      return;
    }

    elements.tickListEl.innerHTML = "";
    const scaleValues = getScaleValues(maxValue);
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

    elements.tickListEl.appendChild(fragment);
    lastRenderedTickMaxValue = tickSignature;
  }

  function renderThermometer(state, options = {}) {
    const shouldSyncInputs = options.syncInputs !== false;
    const normalized = normalizeState(state);
    const stateKey = getStateKey(normalized);
    const percent = (normalized.currentValue / normalized.maxValue) * 100;

    if (lastRenderedStateKey !== stateKey) {
      elements.fillEl.style.height = `${percent}%`;
      elements.fillEl.setAttribute("aria-valuenow", String(Math.round(percent)));
      elements.raisedTextEl.textContent = formatMoney(normalized.currentValue);
      elements.goalTextEl.textContent = formatMoney(normalized.maxValue);
      elements.percentTextEl.textContent = `${Math.round(percent)}%`;
      lastRenderedStateKey = stateKey;
    }

    createTicks(normalized.maxValue);

    if (mode === "control" && shouldSyncInputs) {
      applyStateToInputs(normalized);
    }
  }

  function showCampaignError() {
    setStatus("Invalid campaign ID. Use letters, numbers, hyphens, or underscores.", "error");

    if (mode === "control") {
      setSyncMeta("Update the URL to use a valid campaign name.");
      return;
    }

    elements.raisedTextEl.textContent = "--";
    elements.goalTextEl.textContent = "--";
    elements.percentTextEl.textContent = "--";
    elements.fillEl.style.height = "0%";
    elements.fillEl.setAttribute("aria-valuenow", "0");
    elements.tickListEl.innerHTML = "";
    elements.displayCtaEl.textContent = "Invalid campaign ID";
  }

  return {
    applyStateToInputs,
    readStateFromInputs,
    renderThermometer,
    setStatus,
    setSyncMeta,
    setTokenBadge,
    showCampaignError
  };
}
