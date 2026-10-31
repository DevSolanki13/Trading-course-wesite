import { defineConfig } from "@playwright/test";
import { releaseEnvironment } from "./backend/scripts/release-environment";

// A separate production process and synthetic configuration keep this suite away
// from shared accounts, provider APIs and whichever app is running on port 3000.
const origin = "http://127.0.0.1:3100";
export default defineConfig({
  testDir: "./tests/release",
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  retries: 0,
  outputDir: "artifacts/phase-6/test-results",
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/phase-6/playwright.json" }],
    ["html", { outputFolder: "artifacts/phase-6/playwright", open: "never" }],
  ],
  use: {
    baseURL: origin,
    browserName: "chromium",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined },
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
    command: "npm run start -- --port 3100",
    url: `${origin}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: releaseEnvironment(origin),
  },
});
