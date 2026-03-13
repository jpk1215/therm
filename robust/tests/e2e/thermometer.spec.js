const { test, expect } = require("@playwright/test");
const { buildCampaignId, injectFault, seedCampaign } = require("./helpers");

test.describe("thermometer smoke flows", () => {
  test("display mode renders expected values from seeded state", async ({ page, request }, testInfo) => {
    const campaign = buildCampaignId(testInfo, "display");

    await seedCampaign(request, campaign, {
      maxValue: 75000,
      currentValue: 8000
    });

    await page.goto(`/?mode=display&campaign=${campaign}`);

    await expect(page.getByTestId("display-title")).toHaveText("Ramadan Fundraiser");
    await expect(page.getByTestId("raised-text")).toHaveText("$8,000");
    await expect(page.getByTestId("goal-text")).toHaveText("$75,000");
    await expect(page.getByTestId("percent-text")).toHaveText("11%");
    await expect(page.getByTestId("display-cta")).toBeHidden();
    await expect(page.getByTestId("tick-list").locator("li")).toHaveCount(8);
    await expect(page.getByTestId("thermometer-fill")).toHaveAttribute("aria-valuenow", "11");
  });

  test("control mode updates are reflected in display mode", async ({ browser, request }, testInfo) => {
    const campaign = buildCampaignId(testInfo, "sync");

    await seedCampaign(request, campaign, {
      maxValue: 100000,
      currentValue: 1250
    });

    const context = await browser.newContext();
    try {
      const displayPage = await context.newPage();
      const controlPage = await context.newPage();

      await displayPage.goto(`/?mode=display&campaign=${campaign}`);
      await controlPage.goto(`/?mode=control&campaign=${campaign}&token=test-admin-token`);

      const controlSummary = controlPage.getByTestId("display-summary");
      await expect(controlSummary).toBeVisible();
      await expect(controlSummary.locator(":scope > div")).toHaveCount(3);
      await expect(controlPage.getByTestId("raised-text")).toHaveText("$1,250");
      await expect(controlPage.getByTestId("goal-text")).toHaveText("$100,000");
      await expect(controlPage.getByTestId("percent-text")).toHaveText("1%");

      await controlPage.getByTestId("max-value-input").fill("120000");
      await controlPage.getByTestId("current-value-input").fill("36000");
      await controlPage.getByTestId("current-value-input").blur();

      await expect.poll(async () => controlPage.getByTestId("raised-text").textContent(), { timeout: 7000 }).toBe("$36,000");
      await expect.poll(async () => controlPage.getByTestId("goal-text").textContent(), { timeout: 7000 }).toBe("$120,000");
      await expect.poll(async () => controlPage.getByTestId("percent-text").textContent(), { timeout: 7000 }).toBe("30%");
      await expect.poll(async () => displayPage.getByTestId("raised-text").textContent(), { timeout: 7000 }).toBe("$36,000");
      await expect.poll(async () => displayPage.getByTestId("goal-text").textContent(), { timeout: 7000 }).toBe("$120,000");
      await expect.poll(async () => displayPage.getByTestId("percent-text").textContent(), { timeout: 7000 }).toBe("30%");
    } finally {
      await context.close();
    }
  });

  test("control mode preserves the latest edit when writes finish out of order", async ({ browser, request }, testInfo) => {
    const campaign = buildCampaignId(testInfo, "queued-sync");

    await seedCampaign(request, campaign, {
      maxValue: 50000,
      currentValue: 10000
    });

    const context = await browser.newContext();
    let delayedFirstWrite = true;

    try {
      const displayPage = await context.newPage();
      const controlPage = await context.newPage();

      await controlPage.route(new RegExp(`/api/state\\?campaign=${campaign}`), async (route, routedRequest) => {
        if (routedRequest.method() === "POST" && delayedFirstWrite) {
          delayedFirstWrite = false;
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }

        await route.continue();
      });

      await displayPage.goto(`/?mode=display&campaign=${campaign}`);
      await controlPage.goto(`/?mode=control&campaign=${campaign}&token=test-admin-token`);

      await controlPage.getByTestId("current-value-input").fill("12000");
      await controlPage.getByTestId("current-value-input").blur();
      await controlPage.getByTestId("max-value-input").fill("60000");
      await controlPage.getByTestId("current-value-input").fill("33000");
      await controlPage.getByTestId("current-value-input").blur();

      await expect.poll(async () => controlPage.getByTestId("raised-text").textContent(), { timeout: 9000 }).toBe("$33,000");
      await expect.poll(async () => controlPage.getByTestId("goal-text").textContent(), { timeout: 9000 }).toBe("$60,000");
      await expect.poll(async () => controlPage.getByTestId("percent-text").textContent(), { timeout: 9000 }).toBe("55%");
      await expect.poll(async () => displayPage.getByTestId("raised-text").textContent(), { timeout: 9000 }).toBe("$33,000");
      await expect.poll(async () => displayPage.getByTestId("goal-text").textContent(), { timeout: 9000 }).toBe("$60,000");
      await expect.poll(async () => displayPage.getByTestId("percent-text").textContent(), { timeout: 9000 }).toBe("55%");
    } finally {
      await context.close();
    }
  });

  test("control mode surfaces missing token errors", async ({ page, request }, testInfo) => {
    const campaign = buildCampaignId(testInfo, "missing-token");

    await seedCampaign(request, campaign, {
      maxValue: 50000,
      currentValue: 13000
    });

    await page.goto(`/?mode=control&campaign=${campaign}`);
    await page.getByTestId("current-value-input").fill("14000");
    await page.getByTestId("current-value-input").blur();

    await expect(page.getByTestId("status-text")).toContainText("token is missing");
  });

  test("control token is stored and removed from the URL", async ({ page, request }, testInfo) => {
    const campaign = buildCampaignId(testInfo, "token-storage");

    await seedCampaign(request, campaign, {
      maxValue: 50000,
      currentValue: 13000
    });

    await page.goto(`/?mode=control&campaign=${campaign}&token=test-admin-token`);

    await expect(page).not.toHaveURL(/token=/);
    const token = await page.evaluate((campaignKey) => localStorage.getItem(`therm-admin-token:${campaignKey}`), campaign);
    expect(token).toBe("test-admin-token");
  });

  test("control mode rejects invalid campaign IDs safely", async ({ page }) => {
    await page.goto(`/?mode=control&campaign=${encodeURIComponent("bad/name")}`);

    await expect(page.getByTestId("campaign-badge")).toHaveText("Campaign: invalid");
    await expect(page.getByTestId("status-text")).toContainText("Invalid campaign ID");
  });

  test("control mode recovers after a transient read failure", async ({ page, request }, testInfo) => {
    const campaign = buildCampaignId(testInfo, "recovery");

    await seedCampaign(request, campaign, {
      maxValue: 90000,
      currentValue: 22000
    });

    await page.goto(`/?mode=control&campaign=${campaign}&token=test-admin-token`);
    await expect(page.getByTestId("status-text")).toContainText("Control mode live", { timeout: 7000 });

    await injectFault(request, "getState", 1);
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await expect(page.getByTestId("status-text")).toContainText("Unable to reach live state. Retrying...", { timeout: 7000 });
    await expect(page.getByTestId("sync-meta")).toContainText("Connection issue. Retrying automatically...", { timeout: 7000 });
    await expect(page.getByTestId("status-text")).toContainText("Control mode live", { timeout: 12000 });
  });

  test("control mode reverts the preview after a transient write failure", async ({ page, request }, testInfo) => {
    const campaign = buildCampaignId(testInfo, "write-failure");

    await seedCampaign(request, campaign, {
      maxValue: 80000,
      currentValue: 20000
    });

    await page.goto(`/?mode=control&campaign=${campaign}&token=test-admin-token`);
    await expect(page.getByTestId("raised-text")).toHaveText("$20,000");
    await expect(page.getByTestId("goal-text")).toHaveText("$80,000");
    await expect(page.getByTestId("percent-text")).toHaveText("25%");

    await injectFault(request, "setState", 3);
    await page.getByTestId("max-value-input").fill("100000");
    await page.getByTestId("current-value-input").fill("30000");
    await page.getByTestId("current-value-input").blur();

    await expect(page.getByTestId("status-text")).toContainText("Showing last live state.", { timeout: 7000 });
    await expect(page.getByTestId("sync-meta")).toContainText("Inputs are unsynced", { timeout: 7000 });
    await expect(page.getByTestId("raised-text")).toHaveText("$20,000");
    await expect(page.getByTestId("goal-text")).toHaveText("$80,000");
    await expect(page.getByTestId("percent-text")).toHaveText("25%");
  });
});
