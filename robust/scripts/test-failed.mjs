import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const latestSummaryPath = path.join(projectRoot, "test-results", "agent-runs", "latest-summary.json");

const summary = JSON.parse(await readFile(latestSummaryPath, "utf8"));
const failedStep = summary.steps.find((step) => step.status !== "passed");

if (!failedStep) {
  process.stdout.write("No failing step found in the latest agent summary.\n");
  process.exit(0);
}

const rerun = failedStep.rerun || { script: failedStep.script, args: [] };
if (!rerun.script) {
  process.stderr.write(`No rerun command recorded for step ${failedStep.id}.\n`);
  process.exit(1);
}

const commandArgs = ["run", rerun.script];
if (rerun.args?.length) {
  commandArgs.push("--", ...rerun.args);
}

const result = spawnSync("npm", commandArgs, {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    THERM_STATE_MODE: process.env.THERM_STATE_MODE || "memory",
    ALLOW_TEST_API: process.env.ALLOW_TEST_API || "1",
    ADMIN_WRITE_TOKEN: process.env.ADMIN_WRITE_TOKEN || "test-admin-token"
  }
});

process.exit(result.status ?? 1);
