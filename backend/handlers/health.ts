import { upiConfig } from "../payments/upi-config";

export function getHealth() {
  return Response.json(
    {
      status: "ok",
      service: "trading-course-website",
      stage: "phase-6-verification",
      checkoutEnabled: upiConfig().enabled,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
