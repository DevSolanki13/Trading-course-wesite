import { afterEach, expect, it, vi } from "vitest";
import { getHealth } from "../backend/handlers/health";

afterEach(() => vi.unstubAllEnvs());
it("reports public checkout as closed during a pilot and open only after complete configuration", async () => {
  for (const [key, value] of Object.entries({
    PAYMENT_PROVIDER: "upi",
    UPI_PAYMENTS_ENABLED: "off",
    UPI_RELAY_ENABLED: "on",
    UPI_PILOT_USER_IDS: "pilot",
    UPI_COLLECTION_VPA: "academy@bank",
    UPI_ACCOUNT_MARKERS: "XX5678",
    UPI_RELAY_SENDERS: "HDFC",
    SMS_RELAY_SECRET: "a".repeat(48),
  }))
    vi.stubEnv(key, value);
  expect((await getHealth().json()).checkoutEnabled).toBe(false);
  vi.stubEnv("UPI_PAYMENTS_ENABLED", "on");
  expect((await getHealth().json()).checkoutEnabled).toBe(true);
  vi.stubEnv("UPI_COLLECTION_VPA", "");
  expect((await getHealth().json()).checkoutEnabled).toBe(false);
});
