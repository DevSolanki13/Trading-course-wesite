import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";

// Reuses the isolated fixture preview: no shared database, credentials or provider calls.
const label = process.argv[2];
const visit = process.argv[3] ?? "returning";
const auditPath = process.argv[4] ?? "/";
if (
  !["first", "returning"].includes(visit) ||
  !["/", "/courses/basic-to-advance", "/login"].includes(auditPath)
)
  throw new Error("Expected first|returning and a supported public route.");
if (!label || !/^[a-z0-9-]+$/.test(label))
  throw new Error("Provide a unique measurement label, for example phase-0-before.");
const directory = `artifacts/optimization/${label}`;
await mkdir("artifacts/optimization", { recursive: true });
await mkdir(directory);
const origin = "http://127.0.0.1:3112";
try {
  await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
  throw new Error("Measurement port 3112 is already in use.");
} catch (reason) {
  if (reason.message.includes("already in use")) throw reason;
}
const server = spawn(
  process.execPath,
  [fileURLToPath(new URL("./release-preview.mjs", import.meta.url)), "3112"],
  { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
);
// Drain output without persisting environment values or arbitrary server logs.
server.stdout.resume();
server.stderr.resume();
let browser;
let chrome;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("Fixture preview exited before startup.");
    try {
      const result = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (result.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Fixture preview startup timed out.");
  const metadata = {
    label,
    checkedAt: new Date().toISOString(),
    buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
    node: process.version,
    environment: "isolated loopback production build; synthetic public catalogue; no real sessions",
    visit,
    auditPath,
    limitations: [
      "Not production network, field INP, database/provider latency, or physical-device evidence.",
      "Public snapshots do not verify authenticated student/payment/DRM flows.",
      "Animation captures use normal motion; static parity snapshots use reduced motion.",
    ],
    snapshots: [],
    lighthouse: [],
  };
  browser = await chromium.launch();
  for (const width of [390, 1440]) {
    for (const theme of ["dark", "light"]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      await context.addInitScript((value) => {
        localStorage.setItem("market-method-theme", value);
        localStorage.setItem("indianxtrade-diwali-video-seen", "1");
      }, theme);
      const page = await context.newPage();
      for (const [name, path] of [
        ["home", "/"],
        ["course", "/courses/basic-to-advance"],
        ["about", "/about"],
        ["login", "/login"],
      ]) {
        const response = await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
        await page.locator("main").waitFor({ state: "visible" });
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: `${directory}/${name}-${width}-${theme}.png`,
          fullPage: true,
        });
        metadata.snapshots.push({ name, width, theme, status: response.status() });
      }
      await context.close();
    }
  }
  const motion = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
    recordVideo: { dir: `${directory}/motion`, size: { width: 1440, height: 900 } },
  });
  await motion.tracing.start({ screenshots: true, snapshots: true });
  const page = await motion.newPage();
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  const dialog = page.getByRole("dialog", { name: "Happy Diwali from indianXtrade" });
  await dialog.getByRole("button", { name: /^(Skip|Close) video$/ }).click();
  await page.locator(".marquee-wrap").hover();
  await page.waitForTimeout(1000);
  await page.mouse.move(10, 450);
  await page.waitForTimeout(2000);
  await motion.tracing.stop({ path: `${directory}/motion-trace.zip` });
  await motion.close();
  metadata.browser = browser.version();
  await browser.close();
  browser = null;
  // Fresh browser profiles keep all samples in the same first-visit/video state.
  // Lighthouse alone does not reliably clear the app's once-per-browser localStorage flag.
  for (let run = 1; run <= 3; run++) {
    chrome = await launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ["--headless=new", "--no-first-run"],
    });
    if (visit === "returning") {
      const setup = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
      const tab = await setup.contexts()[0].newPage();
      await tab.goto(`${origin}/api/health`);
      await tab.evaluate(() => localStorage.setItem("indianxtrade-diwali-video-seen", "1"));
      await tab.close();
      // Do not close this CDP browser: that would terminate Lighthouse's Chrome.
    }
    const result = await lighthouse(`${origin}${auditPath}`, {
      port: chrome.port,
      logLevel: "error",
      output: "json",
      onlyCategories: ["performance"],
      disableStorageReset: true,
      formFactor: "mobile",
      throttlingMethod: "simulate",
      throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
    });
    const report = result.lhr;
    const entry = {
      run,
      performance: report.categories.performance.score,
      lcpMs: report.audits["largest-contentful-paint"].numericValue,
      cls: report.audits["cumulative-layout-shift"].numericValue,
      tbtMs: report.audits["total-blocking-time"].numericValue,
      ttfbMs:
        report.audits["server-response-time"]?.numericValue ??
        report.audits["document-latency-insight"]?.numericValue,
      transferBytes: report.audits["total-byte-weight"].numericValue,
      requests: report.audits["network-requests"].details.items.length,
      jsBytes: report.audits["resource-summary"].details.items.find(
        (item) => item.resourceType === "script",
      )?.transferSize,
      cssBytes: report.audits["resource-summary"].details.items.find(
        (item) => item.resourceType === "stylesheet",
      )?.transferSize,
      warnings: report.runWarnings,
      runtimeError: report.runtimeError,
    };
    metadata.lighthouse.push(entry);
    await writeFile(`${directory}/lighthouse-${run}.json`, result.report);
    await writeFile(`${directory}/summary.json`, JSON.stringify(metadata, null, 2) + "\n");
    console.log(JSON.stringify(entry));
    await chrome.kill();
    chrome = null;
  }
  console.log(`Saved snapshots, motion capture and three mobile runs to ${directory}.`);
} finally {
  await browser?.close();
  await chrome?.kill();
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]);
}
