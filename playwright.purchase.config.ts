import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/purchase-browser",
  workers: 1,
  timeout: 240000,
  expect: { timeout: 45000 },
  reporter: [["list"], ["html", { outputFolder: "artifacts/purchase/playwright", open: "never" }]],
  outputDir: "artifacts/purchase/results",
  use: {
    baseURL: "http://127.0.0.1:3102",
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev:demo -- --port 3102",
    url: "http://127.0.0.1:3102/courses/market-foundations",
    timeout: 180000,
    reuseExistingServer: false,
    env: { LOCAL_DATA_NAME: `purchase-e2e-${Date.now()}` },
  },
});
