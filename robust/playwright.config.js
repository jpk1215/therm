const { defineConfig } = require("@playwright/test");

const htmlReportDir = process.env.PLAYWRIGHT_HTML_REPORT_DIR || "playwright-report";
const jsonReportPath = process.env.PLAYWRIGHT_JSON_REPORT_PATH || "test-results/playwright-results.json";
const junitReportPath = process.env.PLAYWRIGHT_JUNIT_REPORT_PATH || "test-results/playwright-results.xml";
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || "test-results/playwright-output";
const includeVisual = process.env.PLAYWRIGHT_INCLUDE_VISUAL === "1";

module.exports = defineConfig({
  testDir: "./tests/e2e",
  outputDir,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI || process.env.PLAYWRIGHT_FORBID_ONLY || "1"),
  timeout: 30000,
  expect: {
    timeout: 7000
  },
  maxFailures: 1,
  grepInvert: includeVisual ? undefined : /@visual/,
  reporter: [
    ["list"],
    ["html", { outputFolder: htmlReportDir, open: "never" }],
    ["json", { outputFile: jsonReportPath }],
    ["junit", { outputFile: junitReportPath }]
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "npm run dev:test",
    port: 4173,
    reuseExistingServer: false,
    timeout: 30000
  }
});
