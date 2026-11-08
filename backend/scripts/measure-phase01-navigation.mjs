import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";

// Run only against optimization-preview.mjs, never a developer/shared/live database.
const origin = "http://127.0.0.1:3115";
// The dedicated .next-demo build was produced with this public origin.
const buildOrigin = "http://127.0.0.1:3113";
const label = process.argv[2];
if (!label || !/^[a-z0-9-]+$/.test(label)) throw new Error("Provide a unique output label.");
const directory = `artifacts/optimization/${label}`;
await mkdir("artifacts/optimization", { recursive: true });
await mkdir(directory);
try {
  await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
  throw new Error("Measurement port 3115 is already occupied.");
} catch (error) {
  if (error.message.includes("already occupied")) throw error;
}
let browser;
const report = {
  label,
  date: new Date().toISOString(),
  build: (await readFile(".next-demo/BUILD_ID", "utf8")).trim(),
  browser: null,
  conditions: {
    viewport: "390x844",
    latencyMs: 150,
    downloadBytesPerSecond: 204800,
    cpuSlowdown: 4,
    observationMs: 5000,
    samples: 3,
    serverState: "primed before samples; cold/warm labels describe browser cache only",
  },
  limits: [
    "Local production-mode PGlite fixture, not hosted services or real DRM.",
    "Cold/warm refer to browser HTTP cache, not a restart of the database/server.",
    "Blocking is sum(max(0,longtask.duration-50)) from FCP through observation end, not field INP or a Lighthouse score.",
    "Measurements start after Phase 1 core fixes; no retroactive Phase 1 speed-gain claim.",
  ],
  samples: [],
  summaries: [],
};
const server = spawn(
  process.execPath,
  ["backend/scripts/optimization-preview.mjs", "start", label, "3115"],
  { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
);
server.stdout.resume();
server.stderr.resume();
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) })).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Isolated measurement preview did not start.");
  // Initialize the disposable database before comparable browser samples.
  const prime = await fetch(origin, { signal: AbortSignal.timeout(60000) });
  await prime.text();
  if (!prime.ok) throw new Error("Fixture priming failed.");
  browser = await chromium.launch();
  report.browser = browser.version();
  for (const email of ["demo@example.com", "admin@example.com"]) {
    const check = await browser.newContext();
    const response = await check.request.post(`${origin}/api/auth/login`, {
      headers: { Origin: buildOrigin },
      data: { email, password: "OptimizationFixture123!" },
    });
    await check.close();
    if (!response.ok()) throw new Error(`Fixture preflight failed (${response.status()}).`);
  }
  for (const [name, path, account, first] of [
    ["home-returning", "/", null, false],
    ["home-first-video", "/", null, true],
    ["course-returning", "/courses/basic-to-advance", null, false],
    ["login-returning", "/login", null, false],
    ["student", "/dashboard", "demo@example.com", false],
    ["admin", "/admin", "admin@example.com", false],
  ]) {
    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: "no-preference",
      });
      await context.addInitScript(
        ({ first }) => {
          if (!first) localStorage.setItem("indianxtrade-diwali-video-seen", "1");
          window.__measurement = {
            lcp: 0,
            cls: 0,
            shiftSum: 0,
            shiftWindow: { start: 0, last: 0, value: 0 },
            tasks: [],
          };
          for (const type of ["largest-contentful-paint", "layout-shift", "longtask"]) {
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (type === "largest-contentful-paint") window.__measurement.lcp = entry.startTime;
                if (type === "layout-shift" && !entry.hadRecentInput) {
                  const state = window.__measurement;
                  state.shiftSum += entry.value;
                  const previous = state.shiftWindow;
                  state.shiftWindow =
                    entry.startTime - previous.last < 1000 &&
                    entry.startTime - previous.start < 5000
                      ? { ...previous, last: entry.startTime, value: previous.value + entry.value }
                      : { start: entry.startTime, last: entry.startTime, value: entry.value };
                  state.cls = Math.max(state.cls, state.shiftWindow.value);
                }
                if (type === "longtask")
                  window.__measurement.tasks.push({
                    start: entry.startTime,
                    duration: entry.duration,
                  });
              }
            }).observe({ type, buffered: true });
          }
        },
        { first },
      );
      if (account) {
        const login = await context.request.post(`${origin}/api/auth/login`, {
          headers: { Origin: buildOrigin },
          data: { email: account, password: "OptimizationFixture123!" },
        });
        if (!login.ok()) throw new Error(`Fixture login failed (${login.status()}).`);
      }
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 204800,
        uploadThroughput: 93750,
      });
      for (const cache of first ? ["cold"] : ["cold", "warm"]) {
        const requests = new Map();
        const onRequest = (event) =>
          requests.set(event.requestId, {
            url: event.request.url,
            type: event.type,
            start: event.timestamp,
            bytes: 0,
          });
        const onResponse = (event) => {
          const item = requests.get(event.requestId);
          if (item) {
            item.status = event.response.status;
            item.cached = !!event.response.fromDiskCache;
            item.responseMs = (event.timestamp - item.start) * 1000;
          }
        };
        const onData = (event) => {
          const item = requests.get(event.requestId);
          if (item) item.partialBytes = (item.partialBytes ?? 0) + event.encodedDataLength;
        };
        const onFinished = (event) => {
          const item = requests.get(event.requestId);
          if (item) {
            item.bytes = event.encodedDataLength;
            item.ms = (event.timestamp - item.start) * 1000;
          }
        };
        cdp.on("Network.requestWillBeSent", onRequest);
        cdp.on("Network.responseReceived", onResponse);
        cdp.on("Network.dataReceived", onData);
        cdp.on("Network.loadingFinished", onFinished);
        if (cache === "cold") await cdp.send("Network.clearBrowserCache");
        const response = await page.goto(`${origin}${path}`, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        if (response.status() !== 200) throw new Error(`${name} returned ${response.status()}`);
        await page.locator('main:not([aria-busy="true"])').last().waitFor({ state: "visible" });
        // Fixed, explicit observation instead of waiting for continuous animation to become idle.
        await page.waitForTimeout(5000);
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType("navigation")[0];
          const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
          return {
            lcpMs: window.__measurement.lcp,
            cls: window.__measurement.cls,
            fcpMs: fcp,
            ttfbMs: navigation.responseStart - navigation.requestStart,
            observedUntilMs: performance.now(),
            blockingMs: window.__measurement.tasks
              .filter((task) => task.start >= fcp)
              .reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0),
            longTasks: window.__measurement.tasks.length,
            greeting: !!document.querySelector(".festival-video-dialog"),
            greetingReadyState:
              document.querySelector(".festival-video-dialog video")?.readyState ?? null,
            greetingCurrentTime:
              document.querySelector(".festival-video-dialog video")?.currentTime ?? null,
          };
        });
        const items = [...requests.values()];
        const bytes = (type) =>
          items
            .filter((item) => !type || item.type === type)
            .reduce((sum, item) => sum + (item.bytes || item.partialBytes || 0), 0);
        const sample = {
          name,
          run,
          cache,
          ...metrics,
          requests: items.length,
          transferBytes: bytes(),
          jsBytes: bytes("Script"),
          cssBytes: bytes("Stylesheet"),
          mediaBytes: bytes("Media"),
          cacheHits: items.filter((item) => item.cached).length,
          api: items
            .filter((item) => item.url.startsWith(`${origin}/api/`))
            .map(({ url, ms, responseMs, status }) => ({
              path: new URL(url).pathname,
              ms,
              responseMs,
              status,
            })),
        };
        if (first !== metrics.greeting)
          throw new Error("Greeting scenario did not match expected state.");
        report.samples.push(sample);
        console.log(JSON.stringify(sample));
        await writeFile(`${directory}/navigation.json`, JSON.stringify(report, null, 2));
        cdp.off("Network.requestWillBeSent", onRequest);
        cdp.off("Network.responseReceived", onResponse);
        cdp.off("Network.dataReceived", onData);
        cdp.off("Network.loadingFinished", onFinished);
      }
      await context.close();
    }
  }
  for (const key of new Set(report.samples.map((sample) => `${sample.name}/${sample.cache}`))) {
    const samples = report.samples.filter((sample) => `${sample.name}/${sample.cache}` === key);
    const summary = { scenario: key, samples: samples.length };
    for (const metric of [
      "lcpMs",
      "cls",
      "ttfbMs",
      "blockingMs",
      "transferBytes",
      "jsBytes",
      "cssBytes",
      "requests",
    ]) {
      const values = samples.map((sample) => sample[metric]).sort((a, b) => a - b);
      summary[metric] = { median: values[1], min: values[0], max: values.at(-1) };
    }
    report.summaries.push(summary);
  }
  await writeFile(`${directory}/navigation.json`, JSON.stringify(report, null, 2));
  console.log("Navigation scenarios complete.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]);
}
