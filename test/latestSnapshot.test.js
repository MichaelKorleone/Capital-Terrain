import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";

const port = 4197;
const baseUrl = `http://127.0.0.1:${port}`;

test("latest snapshot exposes market data date and fetch metadata", async () => {
  const server = spawn(process.execPath, ["server.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(server);

    const first = await fetchJson("/api/latest-snapshot?symbols=AAPL,MSFT&force=1");
    assert.equal(first.rows.length, 2);
    assert.match(first.marketDataDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(first.fetchedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(first.cacheKey, first.marketDataDate);
    assert.equal(first.cacheStatus, "refreshed");
    assert.ok(first.rows.every((row) => row.asOfDate === first.marketDataDate));

    const second = await fetchJson("/api/latest-snapshot?symbols=AAPL,MSFT");
    assert.equal(second.cacheStatus, "hit");
    assert.equal(second.cacheKey, first.cacheKey);
    assert.equal(second.marketDataDate, first.marketDataDate);
  } finally {
    server.kill();
    await once(server, "exit").catch(() => {});
  }
});

async function waitForServer(server) {
  const started = new Promise((resolve, reject) => {
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Capital Terrain running")) resolve();
    });
    server.stderr.on("data", (chunk) => reject(new Error(String(chunk))));
    server.on("exit", (code) => reject(new Error(`Server exited early with ${code}`)));
  });
  await started;
}

async function fetchJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const payload = await response.json();
  assert.equal(response.status, 200, payload.error || "request failed");
  return payload;
}
