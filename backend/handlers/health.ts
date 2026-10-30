export function getHealth() {
  return Response.json(
    {
      status: "ok",
      service: "trading-course-website",
      stage: "phase-6-verification",
      checkoutEnabled: false,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
