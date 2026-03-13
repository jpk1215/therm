import { spawnSync } from "node:child_process";

const commands = [
  ["npm", ["run", "check"]],
  ["npm", ["run", "test:unit"]],
  ["npm", ["run", "test:e2e"]]
];

for (const [command, args] of commands) {
  process.stdout.write(`\n> ${command} ${args.join(" ")}\n`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      THERM_STATE_MODE: process.env.THERM_STATE_MODE || "memory",
      ALLOW_TEST_API: process.env.ALLOW_TEST_API || "1",
      ADMIN_WRITE_TOKEN: process.env.ADMIN_WRITE_TOKEN || "test-admin-token"
    }
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

process.stdout.write("\nAgent test loop completed successfully.\n");
