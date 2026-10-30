import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { releaseEnvironment } from "./release-environment.ts";

const origin = "http://127.0.0.1:3101";
const overrides = releaseEnvironment(origin);
const output = "artifacts/phase-6/lighthouse";
mkdirSync("artifacts/phase-6", { recursive: true });
let server;
let audit;
try {
  try {
    await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
    throw new Error("PORT_IN_USE");
  } catch (error) {
    if (error.message === "PORT_IN_USE") throw error;
  }
  server = spawn(
    process.execPath,
    [
      fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url)),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3101",
    ],
    {
      env: { ...process.env, ...overrides },
      stdio: "ignore",
      windowsHide: true,
    },
  );
  server.on("error", () => {});
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("PREVIEW_START_FAILED");
    try {
      const result = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (result.ok && (await result.json()).stage === "phase-6-verification") {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("PREVIEW_START_TIMEOUT");
  audit = spawn(
    process.execPath,
    [
      fileURLToPath(new URL("../../node_modules/lighthouse/cli/index.js", import.meta.url)),
      origin,
      "--quiet",
      "--chrome-flags=--headless=new --disable-gpu --no-first-run",
      "--only-categories=performance,accessibility",
      "--form-factor=mobile",
      "--throttling-method=simulate",
      "--throttling.rttMs=150",
      "--throttling.throughputKbps=1638.4",
      "--throttling.cpuSlowdownMultiplier=4",
      "--output=json",
      "--output=html",
      `--output-path=${output}`,
    ],
    {
      env: {
        ...process.env,
        ...overrides,
        CHROME_PATH: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || chromium.executablePath(),
      },
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
    },
  );
  const [code] = await once(audit, "exit");
  if (code !== 0) throw new Error("LIGHTHOUSE_FAILED");
  const report = JSON.parse(readFileSync(`${output}.report.json`, "utf8"));
  if (report.runtimeError) throw new Error("LIGHTHOUSE_RUNTIME_ERROR");
  const summary = {
    checkedAt: report.fetchTime,
    lighthouseVersion: report.lighthouseVersion,
    environment:
      "loopback production build with synthetic catalogue; no remote database/provider calls",
    settings: report.configSettings,
    performance: report.categories.performance.score * 100,
    accessibility: report.categories.accessibility.score * 100,
    lcpMs: report.audits["largest-contentful-paint"].numericValue,
    cls: report.audits["cumulative-layout-shift"].numericValue,
    tbtMs: report.audits["total-blocking-time"].numericValue,
    transferBytes: report.audits["total-byte-weight"].numericValue,
    fieldInp: "not measured; laboratory TBT is not field INP",
    warnings: report.runWarnings,
  };
  summary.passed =
    summary.performance >= 90 &&
    summary.accessibility === 100 &&
    summary.lcpMs <= 2000 &&
    summary.cls <= 0.1;
  writeFileSync(`${output}-summary.json`, JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.passed) process.exitCode = 1;
} catch (error) {
  console.error(
    `Performance verification failed: ${/^[A-Z_]+$/.test(error.message) ? error.message : "LOCAL_AUDIT_ERROR"}. No deployment changed.`,
  );
  process.exitCode = 1;
} finally {
  audit?.kill();
  server?.kill();
}
