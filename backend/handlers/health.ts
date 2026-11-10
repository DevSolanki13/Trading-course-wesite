import { upiConfig } from "../payments/upi-config";

export function getHealth() {
  const checkout = upiConfig();
  return Response.json(
    {
      status: "ok",
      service: "trading-course-website",
      stage: "phase-6-verification",
      checkoutEnabled: checkout.enabled,
      checkoutConfigured: checkout.configured,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
