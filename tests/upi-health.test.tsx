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

it("validates the complete multi-account configuration without exposing receiving IDs or credentials", async () => {
  for (const [key, value] of Object.entries({
    PAYMENT_PROVIDER: "upi",
    UPI_GATEWAY: "indianxtrade",
    UPI_PAYMENTS_ENABLED: "on",
    UPI_COLLECTION_VPA: "",
    UPI_COLLECTION_VPAS: "first@bank, SECOND@BANK",
    INDIANXTRADE_COLLECTOR_EMAIL: "collector@example.invalid",
    INDIANXTRADE_COLLECTOR_PASSWORD: "p".repeat(48),
  }))
    vi.stubEnv(key, value);
  const valid = await getHealth().json();
  expect(valid.checkoutEnabled).toBe(true);
  expect(valid.checkoutConfigured).toBe(true);
  expect(JSON.stringify(valid)).not.toMatch(/first@bank|SECOND@BANK|collector|pppp/);
  vi.stubEnv("UPI_COLLECTION_VPAS", "first@bank,invalid");
  const invalid = await getHealth().json();
  expect(invalid.checkoutEnabled).toBe(false);
  expect(invalid.checkoutConfigured).toBe(false);
});
