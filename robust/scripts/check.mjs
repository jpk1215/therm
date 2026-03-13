import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const targetDirectories = [
  "api",
  "lib",
  "public/app",
  "scripts",
  "tests"
];
const allowedExtensions = new Set([".js", ".mjs", ".cjs"]);

async function collectCheckableFiles(targetDirectory) {
  const absoluteDirectory = path.join(projectRoot, targetDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(absoluteDirectory, entry.name);
    const relativePath = path.relative(projectRoot, entryPath);

    if (entry.isDirectory()) {
      files.push(...await collectCheckableFiles(relativePath));
      continue;
    }

    if (allowedExtensions.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
}

const filesToCheck = [];
for (const targetDirectory of targetDirectories) {
  filesToCheck.push(...await collectCheckableFiles(targetDirectory));
}

for (const relativePath of filesToCheck.sort()) {
  const absolutePath = path.join(projectRoot, relativePath);
  const result = spawnSync(process.execPath, ["--check", absolutePath], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

process.stdout.write("Static syntax checks passed.\n");
