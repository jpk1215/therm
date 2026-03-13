import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const args = process.argv.slice(2);
const filePatterns = args.length ? args : ["tests/unit/*.test.mjs", "tests/unit/*.test.cjs"];
const tapLogPath = process.env.UNIT_TAP_PATH ? path.resolve(projectRoot, process.env.UNIT_TAP_PATH) : "";

if (tapLogPath) {
  await mkdir(path.dirname(tapLogPath), { recursive: true });
}

const command = [
  `"${process.execPath}"`,
  "--test",
  "--test-reporter=tap",
  ...filePatterns.map((pattern) => `"${pattern}"`)
].join(" ");

const child = spawn(command, {
  cwd: projectRoot,
  env: process.env,
  shell: true,
  stdio: ["ignore", "pipe", "pipe"]
});

let stdout = "";
let stderr = "";

child.stdout.on("data", (chunk) => {
  const text = String(chunk);
  stdout += text;
  process.stdout.write(text);
});

child.stderr.on("data", (chunk) => {
  const text = String(chunk);
  stderr += text;
  process.stderr.write(text);
});

const exitCode = await new Promise((resolve, reject) => {
  child.on("error", reject);
  child.on("close", resolve);
});

if (tapLogPath) {
  await writeFile(tapLogPath, `${stdout}${stderr}`, "utf8");
}

process.exit(exitCode ?? 1);
