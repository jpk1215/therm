const fs = require("fs");
const path = require("path");
const http = require("http");
const { URL } = require("url");

const { DEFAULT_STATE } = require("../lib/state-model");
const { canUseTestApi, getState, resetState, setState } = require("../lib/state-store");

const port = Number(process.env.PORT || 4173);
const publicDir = path.join(__dirname, "..", "public");

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
  const campaign = String(url.searchParams.get("campaign") || "default");

  if (url.pathname === "/api/state" && req.method === "GET") {
    const state = await getState(campaign);
    sendJson(res, 200, state);
    return;
  }

  if (url.pathname === "/api/state" && req.method === "POST") {
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
    if (!canUseTestApi()) {
      sendJson(res, 403, { error: "Test reset API is disabled" });
      return;
    }

    const body = await readBody(req);
    const state = await resetState(campaign, Object.keys(body).length ? body : DEFAULT_STATE);
    sendJson(res, 200, { ok: true, state });
    return;
  }

  if (url.pathname === "/health") {
    sendJson(res, 200, { ok: true });
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
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(port, () => {
  process.stdout.write(`Therm dev server listening on http://127.0.0.1:${port}\n`);
});
