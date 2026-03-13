import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "../..");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        if (!port) {
          reject(new Error("Could not determine free port"));
          return;
        }

        resolve(port);
      });
    });

    server.on("error", reject);
  });
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the server is reachable.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Dev server did not become healthy in time");
}

async function withDevServer(run) {
  const port = await getFreePort();
  const server = spawn("node", ["scripts/dev-server.js"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      THERM_STATE_MODE: "memory",
      ALLOW_TEST_API: "1",
      ADMIN_WRITE_TOKEN: "test-admin-token"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  server.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  server.stderr.on("data", (chunk) => {
    output += String(chunk);
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForHealth(baseUrl);
    await run(baseUrl);
  } finally {
    if (!server.killed) {
      server.kill("SIGTERM");
    }

    await new Promise((resolve) => {
      server.once("exit", resolve);
      setTimeout(resolve, 1000);
    });
  }

  return output;
}

test("dev server state API enforces auth and persists updates", async () => {
  await withDevServer(async (baseUrl) => {
    const seededResponse = await fetch(`${baseUrl}/api/test/reset?campaign=api-spec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        maxValue: 10000,
        currentValue: 2500,
        incrementValue: 1000
      })
    });

    assert.equal(seededResponse.status, 200);
    const seededPayload = await seededResponse.json();
    assert.deepEqual(seededPayload.state, {
      maxValue: 10000,
      incrementValue: 1000,
      currentValue: 2500
    });

    const initialStateResponse = await fetch(`${baseUrl}/api/state?campaign=api-spec`, {
      cache: "no-store"
    });
    assert.equal(initialStateResponse.status, 200);
    assert.deepEqual(await initialStateResponse.json(), seededPayload.state);

    const unauthorizedResponse = await fetch(`${baseUrl}/api/state?campaign=api-spec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        maxValue: 15000,
        currentValue: 5000
      })
    });
    assert.equal(unauthorizedResponse.status, 401);

    const authorizedResponse = await fetch(`${baseUrl}/api/state?campaign=api-spec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": "test-admin-token"
      },
      body: JSON.stringify({
        maxValue: 15000,
        currentValue: 5000,
        incrementValue: 2500
      })
    });

    assert.equal(authorizedResponse.status, 200);
    const authorizedPayload = await authorizedResponse.json();
    assert.deepEqual(authorizedPayload.state, {
      maxValue: 15000,
      incrementValue: 2500,
      currentValue: 5000
    });

    const updatedStateResponse = await fetch(`${baseUrl}/api/state?campaign=api-spec`, {
      cache: "no-store"
    });
    assert.equal(updatedStateResponse.status, 200);
    assert.deepEqual(await updatedStateResponse.json(), authorizedPayload.state);
  });
});
