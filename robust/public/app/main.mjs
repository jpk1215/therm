import {
  getTokenStorageKey,
  normalizeCampaignId,
  persistToken,
  readTokenFromStorage
} from "./campaign.mjs";
import { getAppElements, configureLayout } from "./dom.mjs";
import { createRenderer } from "./render.mjs";
import { createSyncController } from "./sync-controller.mjs";

// The entrypoint stays intentionally thin so the shipped browser app reads as:
// parse URL state -> configure the shell -> start the sync controller.
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") === "control" ? "control" : "display";
const rawCampaign = params.get("campaign");
const campaign = normalizeCampaignId(rawCampaign);
const tokenParam = params.get("token");
const tokenStorageKey = getTokenStorageKey(campaign);

if (tokenParam) {
  persistToken(tokenStorageKey, tokenParam);
  params.delete("token");
  const cleanQuery = params.toString();
  history.replaceState(null, "", window.location.pathname + (cleanQuery ? `?${cleanQuery}` : ""));
}

const adminToken = tokenParam || readTokenFromStorage(tokenStorageKey);
const elements = getAppElements();
configureLayout(elements, { mode, campaign });

const renderer = createRenderer(elements, { mode });
const syncController = createSyncController({
  adminToken,
  campaign,
  elements,
  mode,
  renderer
});

syncController.start();
