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
    command:
      "node --experimental-strip-types tests/purchase-browser/seed-gateway.ts && npm run dev:demo -- --port 3102",
    url: "http://127.0.0.1:3102/courses/basic-to-advance",
    timeout: 180000,
    reuseExistingServer: false,
    env: {
      LOCAL_DEMO: "true",
      PAYMENT_PROVIDER: "",
      LOCAL_DATA_NAME: `purchase-e2e-${Date.now()}`,
      // A developer's saved gateway/DRM credentials must never activate providers in this fixture.
      UPI_GATEWAY: "",
      UPI_PAYMENTS_ENABLED: "off",
      UPI_RELAY_ENABLED: "off",
      UPI_PILOT_USER_IDS: "",
      UPI_COLLECTION_VPA: "",
      SMS_RELAY_SECRET: "",
      INDIANXTRADE_COLLECTOR_EMAIL: "",
      INDIANXTRADE_COLLECTOR_PASSWORD: "",
      INDIANXTRADE_SESSION_TOKEN: "",
      VDOCIPHER_API_SECRET: "",
      VDOCIPHER_TEST_VIDEO_ID: "",
    },
  },
});
