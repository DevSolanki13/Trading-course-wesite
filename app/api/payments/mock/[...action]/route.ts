import { purchaseRequest } from "@/backend/handlers/purchase";
import { mockPaymentsAllowed } from "@/backend/payments/providers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ error: "Not found" }, { status: 404 });
}
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export async function POST(request: Request) {
  if (!mockPaymentsAllowed()) return Response.json({ error: "Not found" }, { status: 404 });
  const url = new URL(request.url);
  url.pathname = "/api/purchase/mock";
  return purchaseRequest(new Request(url, request));
}
