// Retired provider-specific checkout creation. New purchases use /api/purchase/create.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST() {
  return Response.json({ error: "Use Academy UPI checkout to create a payment." }, { status: 410 });
}
