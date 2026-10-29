export function getHealth() {
  return Response.json(
    { status: "ok", service: "trading-course-website", stage: "phase-0", checkoutEnabled: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
