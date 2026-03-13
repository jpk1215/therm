import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const mode = process.argv[2] === "full" ? "full" : "quick";
const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
const agentRunsDir = path.join(projectRoot, "test-results", "agent-runs");
const runDir = path.join(agentRunsDir, runId);
const baseEnv = {
  ...process.env,
  THERM_STATE_MODE: process.env.THERM_STATE_MODE || "memory",
  ALLOW_TEST_API: process.env.ALLOW_TEST_API || "1",
  ADMIN_WRITE_TOKEN: process.env.ADMIN_WRITE_TOKEN || "test-admin-token"
};

await mkdir(runDir, { recursive: true });

const steps = [
  {
    id: "check",
    name: "Static syntax checks",
    script: "check",
    kind: "generic",
    rerun: { script: "check", args: [] }
  },
  {
    id: "unit",
    name: "Unit tests",
    script: "test:unit:agent",
    kind: "unit",
    rerun: { script: "test:unit:agent", args: [] }
  },
  {
    id: "smoke",
    name: "Smoke e2e tests",
    script: "test:smoke",
    kind: "playwright",
    lane: "smoke",
    rerun: { script: "test:smoke", args: [] }
  }
];

if (mode === "full") {
  steps.push({
    id: "visual",
    name: "Visual regression tests",
    script: "test:visual",
    kind: "playwright",
    lane: "visual",
    rerun: { script: "test:visual", args: [] }
  });
}

function buildPlaywrightEnv(stepId) {
  const laneDir = path.join(runDir, stepId);
  return {
    ...baseEnv,
    PLAYWRIGHT_OUTPUT_DIR: path.join(laneDir, "output"),
    PLAYWRIGHT_HTML_REPORT_DIR: path.join(laneDir, "html-report"),
    PLAYWRIGHT_JSON_REPORT_PATH: path.join(laneDir, "report.json"),
    PLAYWRIGHT_JUNIT_REPORT_PATH: path.join(laneDir, "report.xml")
  };
}

function createStepEnv(step) {
  if (step.kind === "playwright") {
    return buildPlaywrightEnv(step.id);
  }

  if (step.kind === "unit") {
    return {
      ...baseEnv,
      UNIT_TAP_PATH: path.join("test-results", "agent-runs", runId, step.id, "unit.tap")
    };
  }

  return baseEnv;
}

function streamToOutputs(targets, chunk) {
  for (const target of targets) {
    target.write(chunk);
  }
}

async function runStep(step) {
  const stepDir = path.join(runDir, step.id);
  const logPath = path.join(stepDir, "step.log");
  await mkdir(stepDir, { recursive: true });

  process.stdout.write(`\n> npm run ${step.script}\n`);

  const child = spawn("npm", ["run", step.script], {
    cwd: projectRoot,
    env: createStepEnv(step),
    stdio: ["ignore", "pipe", "pipe"]
  });

  const logChunks = [];
  const startedAt = Date.now();

  child.stdout.on("data", (chunk) => {
    logChunks.push(chunk);
    streamToOutputs([process.stdout], chunk);
  });

  child.stderr.on("data", (chunk) => {
    logChunks.push(chunk);
    streamToOutputs([process.stderr], chunk);
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  await writeFile(logPath, Buffer.concat(logChunks));

  const result = {
    id: step.id,
    name: step.name,
    script: step.script,
    kind: step.kind,
    status: exitCode === 0 ? "passed" : "failed",
    exitCode: exitCode ?? 1,
    durationMs: Date.now() - startedAt,
    logPath: path.relative(projectRoot, logPath),
    rerun: step.rerun
  };

  if (step.kind === "playwright") {
    Object.assign(result, await collectPlaywrightArtifacts(step));
  }

  if (step.kind === "unit") {
    const tapPath = path.join(stepDir, "unit.tap");
    if (existsSync(tapPath)) {
      result.tapPath = path.relative(projectRoot, tapPath);
    }
  }

  return result;
}

function flattenSuites(suites, parentTitles = []) {
  const output = [];

  for (const suite of suites || []) {
    const suiteTitles = suite.title ? [...parentTitles, suite.title] : parentTitles;

    for (const spec of suite.specs || []) {
      const specTitles = spec.title ? [...suiteTitles, spec.title] : suiteTitles;

      for (const test of spec.tests || []) {
        output.push({
          file: spec.file,
          title: [...specTitles, test.title].join(" > "),
          results: test.results || []
        });
      }
    }

    output.push(...flattenSuites(suite.suites, suiteTitles));
  }

  return output;
}

async function collectPlaywrightArtifacts(step) {
  const stepDir = path.join(runDir, step.id);
  const htmlReportDir = path.join(stepDir, "html-report");
  const jsonReportPath = path.join(stepDir, "report.json");
  const junitReportPath = path.join(stepDir, "report.xml");
  const outputDir = path.join(stepDir, "output");
  const artifacts = {
    htmlReportDir: path.relative(projectRoot, htmlReportDir),
    jsonReportPath: path.relative(projectRoot, jsonReportPath),
    junitReportPath: path.relative(projectRoot, junitReportPath),
    outputDir: path.relative(projectRoot, outputDir),
    failedTests: []
  };

  if (!existsSync(jsonReportPath)) {
    return artifacts;
  }

  const report = JSON.parse(await readFile(jsonReportPath, "utf8"));
  const flattenedTests = flattenSuites(report.suites || []);
  const failedTests = [];
  const failedFiles = new Set();

  for (const test of flattenedTests) {
    const failingResults = test.results.filter((result) => ["failed", "timedOut", "interrupted"].includes(result.status));
    if (!failingResults.length) {
      continue;
    }

    failedFiles.add(test.file);
    failedTests.push({
      file: test.file,
      title: test.title,
      statuses: failingResults.map((result) => result.status),
      attachments: failingResults.flatMap((result) =>
        (result.attachments || [])
          .filter((attachment) => attachment.path)
          .map((attachment) => ({
            name: attachment.name,
            contentType: attachment.contentType,
            path: attachment.path
          }))
      ),
      errors: failingResults.flatMap((result) => (result.errors || []).map((error) => error.message || error.value || "Unknown error"))
    });
  }

  artifacts.failedTests = failedTests;

  if (failedFiles.size) {
    artifacts.rerun = {
      script: "test:e2e:spec",
      args: [...failedFiles]
    };
  }

  return artifacts;
}

const stepResults = [];
let overallStatus = "passed";
let exitCode = 0;

for (const step of steps) {
  const result = await runStep(step);
  if (result.rerun && !result.failedTests?.length) {
    result.rerun = step.rerun;
  } else if (result.rerun?.script) {
    result.rerun = result.rerun;
  }

  stepResults.push(result);
  if (result.status !== "passed") {
    overallStatus = "failed";
    exitCode = result.exitCode || 1;
    break;
  }
}

const artifactManifest = {
  runId,
  mode,
  generatedAt: new Date().toISOString(),
  failedSteps: stepResults
    .filter((step) => step.status !== "passed")
    .map((step) => ({
      id: step.id,
      name: step.name,
      logPath: step.logPath,
      htmlReportDir: step.htmlReportDir,
      jsonReportPath: step.jsonReportPath,
      junitReportPath: step.junitReportPath,
      outputDir: step.outputDir,
      tapPath: step.tapPath,
      failedTests: step.failedTests || [],
      rerun: step.rerun
    }))
};

const summary = {
  runId,
  mode,
  status: overallStatus,
  startedAt: new Date().toISOString(),
  environment: {
    stateMode: baseEnv.THERM_STATE_MODE,
    allowTestApi: baseEnv.ALLOW_TEST_API,
    adminTokenConfigured: Boolean(baseEnv.ADMIN_WRITE_TOKEN)
  },
  steps: stepResults
};

const summaryPath = path.join(runDir, "summary.json");
const artifactManifestPath = path.join(runDir, "artifacts.json");
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
await writeFile(artifactManifestPath, `${JSON.stringify(artifactManifest, null, 2)}\n`, "utf8");
await writeFile(path.join(agentRunsDir, "latest-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
await writeFile(path.join(agentRunsDir, "latest-artifacts.json"), `${JSON.stringify(artifactManifest, null, 2)}\n`, "utf8");

process.stdout.write(`\nAgent test loop ${overallStatus === "passed" ? "completed successfully" : "failed"}.\n`);
process.stdout.write(`Summary: ${path.relative(projectRoot, summaryPath)}\n`);
process.stdout.write(`Artifacts: ${path.relative(projectRoot, artifactManifestPath)}\n`);

process.exit(exitCode);
