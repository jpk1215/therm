import { mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const nvmrcPath = path.join(projectRoot, ".nvmrc");
const expectedNodeVersion = (await readFile(nvmrcPath, "utf8")).trim();

await mkdir(path.join(projectRoot, "test-results", "agent-runs"), { recursive: true });

if (process.version !== `v${expectedNodeVersion}`) {
  process.stdout.write(
    `Expected Node ${expectedNodeVersion} for deterministic agent runs, current version is ${process.version}.\n`
  );
}

if (process.env.SKIP_PLAYWRIGHT_INSTALL === "1") {
  process.stdout.write("Skipping Playwright browser install because SKIP_PLAYWRIGHT_INSTALL=1.\n");
  process.exit(0);
}

const result = spawnSync("npx", ["playwright", "install", "chromium"], {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env
});

process.exit(result.status ?? 1);
