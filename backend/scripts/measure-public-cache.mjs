import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const origin = "http://127.0.0.1:3114";
const reads = [];
const server = fork("backend/scripts/release-preview.mjs", ["3114"], {
  stdio: ["ignore", "ignore", "ignore", "ipc"],
  windowsHide: true,
});
server.on("message", (message) => {
  if (message.type === "fixture-read") reads.push(message.path);
});
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${origin}/api/health`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(ready, "Fixture did not start.");
  const entries = [];
  for (const path of ["/", "/", "/about", "/courses/basic-to-advance"]) {
    const before = reads.length;
    const start = performance.now();
    const response = await fetch(`${origin}${path}`);
    await response.text();
    assert.equal(response.status, 200);
    entries.push({
      path,
      ms: performance.now() - start,
      fixtureReads: reads.slice(before),
      cacheControl: response.headers.get("cache-control"),
    });
  }
  assert.equal(entries[0].fixtureReads.filter((path) => path.endsWith("/courses")).length, 1);
  assert.equal(
    entries
      .slice(1)
      .flatMap((entry) => entry.fixtureReads)
      .filter((path) => /\/(courses|site_content|site_settings)$/.test(path)).length,
    0,
  );
  await mkdir("artifacts/optimization/public-cache", { recursive: true });
  await writeFile(
    "artifacts/optimization/public-cache/result.json",
    JSON.stringify(
      {
        entries,
        note: "Fresh fixture URL in Next cache key; first catalogue miss then shared public-data hits. Dynamic HTML itself is not CDN cached. No private identity cached.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(entries));
  console.log("VERDICT: PASS");
} finally {
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]);
}
