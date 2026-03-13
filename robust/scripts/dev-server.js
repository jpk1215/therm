const fs = require("fs");
const path = require("path");
const http = require("http");
const { URL } = require("url");

const { normalizeCampaignId } = require("../lib/campaign-id");
const { DEFAULT_STATE } = require("../lib/state-model");
const { canUseTestApi, getState, resetState, setState } = require("../lib/state-store");

const port = Number(process.env.PORT || 4173);
const publicDir = path.join(__dirname, "..", "public");

// The local dev server supports one-shot fault injection so browser tests can
// deterministically verify read/write recovery paths without mocking fetch.
const injectedFaults = {
  getState: 0,
  setState: 0
};

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function consumeInjectedFault(name) {
  if (!injectedFaults[name]) {
    return false;
  }

  injectedFaults[name] -= 1;
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function resolveStaticPath(pathname) {
  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  return path.join(publicDir, normalized);
}

function serveStatic(req, res, pathname) {
  const filePath = resolveStaticPath(pathname);

  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(res, 404, { error: "Not found" });
        return;
      }

      sendJson(res, 500, { error: "Failed to read file" });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const mimeType = mimeTypes[extension] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mimeType });
    res.end(contents);
  });
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/state" && req.method === "GET") {
    if (consumeInjectedFault("getState")) {
      sendJson(res, 503, { error: "Injected test fault" });
      return;
    }

    const campaign = normalizeCampaignId(url.searchParams.get("campaign"));
    const state = await getState(campaign);
    sendJson(res, 200, state);
    return;
  }

  if (url.pathname === "/api/state" && req.method === "POST") {
    if (consumeInjectedFault("setState")) {
      sendJson(res, 503, { error: "Injected test fault" });
      return;
    }

    const campaign = normalizeCampaignId(url.searchParams.get("campaign"));
    const sentToken = req.headers["x-admin-token"];
    if (!process.env.ADMIN_WRITE_TOKEN || sentToken !== process.env.ADMIN_WRITE_TOKEN) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    const body = await readBody(req);
    const state = await setState(campaign, body);
    sendJson(res, 200, { ok: true, state });
    return;
  }

  if (url.pathname === "/api/test/reset" && req.method === "POST") {
    const campaign = normalizeCampaignId(url.searchParams.get("campaign"));
    if (!canUseTestApi()) {
      sendJson(res, 403, { error: "Test reset API is disabled" });
      return;
    }

    const body = await readBody(req);
    const state = await resetState(campaign, Object.keys(body).length ? body : DEFAULT_STATE);
    sendJson(res, 200, { ok: true, state });
    return;
  }

  if (url.pathname === "/api/test/fault" && req.method === "POST") {
    if (!canUseTestApi()) {
      sendJson(res, 403, { error: "Test fault API is disabled" });
      return;
    }

    const body = await readBody(req);
    const target = String(body.target || "");
    const count = Math.max(0, Number(body.count || 0));

    if (!Object.hasOwn(injectedFaults, target)) {
      sendJson(res, 400, { error: "Unknown test fault target" });
      return;
    }

    injectedFaults[target] = count;
    sendJson(res, 200, {
      ok: true,
      faults: { ...injectedFaults }
    });
    return;
  }

  if (url.pathname === "/health") {
    // The health payload doubles as a contract check for the agent harness so
    // tests can confirm they are attached to the intended in-memory server.
    sendJson(res, 200, {
      ok: true,
      app: "therm-dev-server",
      stateMode: process.env.THERM_STATE_MODE || "firebase",
      allowTestApi: canUseTestApi(),
      adminTokenConfigured: Boolean(process.env.ADMIN_WRITE_TOKEN)
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
      await handleApi(req, res, url);
      return;
    }

    serveStatic(req, res, url.pathname);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message || "Server error" });
  }
});

server.listen(port, () => {
  process.stdout.write(`Therm dev server listening on http://127.0.0.1:${port}\n`);
});
