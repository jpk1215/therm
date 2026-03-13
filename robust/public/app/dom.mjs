export function getAppElements() {
  const controlsEl = document.getElementById("controls");
  const containerEl = document.getElementById("container");
  const subtitleEl = document.getElementById("subtitle");
  const statusTextEl = document.getElementById("statusText");
  const campaignBadgeEl = document.getElementById("campaignBadge");
  const tokenBadgeEl = document.getElementById("tokenBadge");
  const syncMetaEl = document.getElementById("syncMeta");
  const maxInput = document.getElementById("maxValue");
  const currentInput = document.getElementById("currentValue");
  const fillEl = document.getElementById("fill");
  const tickListEl = document.getElementById("tickList");
  const raisedTextEl = document.getElementById("raisedText");
  const goalTextEl = document.getElementById("goalText");
  const percentTextEl = document.getElementById("percentText");
  const displayCtaEl = document.querySelector("[data-testid='display-cta']");

  return {
    controlsEl,
    containerEl,
    subtitleEl,
    statusTextEl,
    campaignBadgeEl,
    tokenBadgeEl,
    syncMetaEl,
    maxInput,
    currentInput,
    fillEl,
    tickListEl,
    raisedTextEl,
    goalTextEl,
    percentTextEl,
    displayCtaEl,
    controlInputs: [maxInput, currentInput]
  };
}

export function configureLayout(elements, { mode, campaign }) {
  if (mode === "display") {
    document.body.classList.add("display-viewport");
    elements.controlsEl.classList.add("hidden");
    elements.containerEl.classList.add("display-mode");
    return;
  }

  elements.containerEl.classList.add("control-mode");
  elements.subtitleEl.textContent = "Control mode is active. Updates are synced to the live display.";
  elements.campaignBadgeEl.textContent = campaign ? `Campaign: ${campaign}` : "Campaign: invalid";

  if (!campaign) {
    elements.campaignBadgeEl.classList.add("badge-warning");
  }
}
