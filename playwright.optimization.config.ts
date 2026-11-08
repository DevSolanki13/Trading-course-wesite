import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/optimization",
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  outputDir: "artifacts/optimization/acceptance",
  reporter: [["list"], ["json", { outputFile: "artifacts/optimization/acceptance.json" }]],
  use: {
    baseURL: "http://127.0.0.1:3113",
    trace: "on",
    video: "on",
    screenshot: "only-on-failure",
    reducedMotion: "no-preference",
  },
  projects: [
    { name: "desktop-dark", use: { viewport: { width: 1440, height: 900 }, colorScheme: "dark" } },
    {
      name: "desktop-light",
      use: { viewport: { width: 1440, height: 900 }, colorScheme: "light" },
    },
    {
      name: "mobile-dark",
      use: {
        viewport: { width: 390, height: 844 },
        colorScheme: "dark",
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-light",
      use: {
        viewport: { width: 390, height: 844 },
        colorScheme: "light",
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "node backend/scripts/optimization-preview.mjs start phase-01-20261109 3113",
    url: "http://127.0.0.1:3113/api/health",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
