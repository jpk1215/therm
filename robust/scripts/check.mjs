import { access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");

const filesToCheck = [
  "api/state.js",
  "api/test/reset.js",
  "lib/state-model.js",
  "lib/state-store.js",
  "scripts/dev-server.js",
  "public/app/constants.mjs",
  "public/app/format.mjs",
  "public/app/scale.mjs",
  "public/app/state-utils.mjs",
  "public/app/main.mjs"
];

for (const relativePath of filesToCheck) {
  const absolutePath = path.join(projectRoot, relativePath);
  await access(absolutePath);

  const result = spawnSync(process.execPath, ["--check", absolutePath], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

process.stdout.write("Static syntax checks passed.\n");
