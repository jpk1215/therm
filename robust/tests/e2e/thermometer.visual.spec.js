const { test, expect } = require("@playwright/test");
const { buildCampaignId, seedCampaign } = require("./helpers");

test.describe("thermometer visual regressions", () => {
  test("@visual display panel matches the approved presentation", async ({ page, request }, testInfo) => {
    const campaign = buildCampaignId(testInfo, "display-visual");

    await seedCampaign(request, campaign, {
      maxValue: 125000,
      currentValue: 62500
    });

    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.goto(`/?mode=display&campaign=${campaign}`);

    await expect(page.getByTestId("display-panel")).toHaveScreenshot("display-panel.png", {
      animations: "disabled",
      scale: "css",
      maxDiffPixelRatio: 0.01
    });
  });
});
