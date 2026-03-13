const { test, expect } = require("@playwright/test");

async function resetCampaign(request, campaign, state) {
  const response = await request.post(`/api/test/reset?campaign=${campaign}`, {
    data: state
  });
  expect(response.ok()).toBeTruthy();
}

test.describe("thermometer smoke flows", () => {
  test("display mode renders expected values from seeded state", async ({ page, request }) => {
    await resetCampaign(request, "display-smoke", {
      maxValue: 75000,
      currentValue: 8000
    });

    await page.goto("/?mode=display&campaign=display-smoke");

    await expect(page.getByTestId("display-title")).toHaveText("Ramadan Fundraiser");
    await expect(page.getByTestId("raised-text")).toHaveText("$8,000");
    await expect(page.getByTestId("goal-text")).toHaveText("$75,000");
    await expect(page.getByTestId("percent-text")).toHaveText("11%");
    await expect(page.getByTestId("tick-list").locator("li")).toHaveCount(8);
    await expect(page.getByTestId("thermometer-fill")).toHaveAttribute("aria-valuenow", "11");
  });

  test("control mode updates are reflected in display mode", async ({ browser, request }) => {
    await resetCampaign(request, "sync-smoke", {
      maxValue: 100000,
      currentValue: 1250
    });

    const context = await browser.newContext();
    const displayPage = await context.newPage();
    const controlPage = await context.newPage();

    await displayPage.goto("/?mode=display&campaign=sync-smoke");
    await controlPage.goto("/?mode=control&campaign=sync-smoke&token=test-admin-token");

    await controlPage.getByTestId("max-value-input").fill("120000");
    await controlPage.getByTestId("current-value-input").fill("36000");
    await controlPage.getByTestId("current-value-input").blur();

    await expect.poll(async () => displayPage.getByTestId("raised-text").textContent()).toBe("$36,000");
    await expect.poll(async () => displayPage.getByTestId("goal-text").textContent()).toBe("$120,000");
    await expect.poll(async () => displayPage.getByTestId("percent-text").textContent()).toBe("30%");
  });

  test("control mode surfaces missing token errors", async ({ page, request }) => {
    await resetCampaign(request, "missing-token", {
      maxValue: 50000,
      currentValue: 13000
    });

    await page.goto("/?mode=control&campaign=missing-token");
    await page.getByTestId("current-value-input").fill("14000");
    await page.getByTestId("current-value-input").blur();

    await expect(page.getByTestId("status-text")).toContainText("token is missing");
  });

  test("control token is stored and removed from the URL", async ({ page, request }) => {
    await resetCampaign(request, "token-storage", {
      maxValue: 50000,
      currentValue: 13000
    });

    await page.goto("/?mode=control&campaign=token-storage&token=test-admin-token");

    await expect(page).not.toHaveURL(/token=/);
    const token = await page.evaluate(() => localStorage.getItem("therm-admin-token:token-storage"));
    expect(token).toBe("test-admin-token");
  });
});
