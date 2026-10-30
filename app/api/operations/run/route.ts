import { operationsAuthorized, operationsEnabled } from "@/backend/operations/policy";
import { runOperations } from "@/backend/operations/worker";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!operationsEnabled()) return Response.json({ error: "Not found" }, { status: 404, headers });
  if (!operationsAuthorized(request.headers.get("authorization")))
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    const result = await runOperations();
    const needsAttention =
      result.failed > 0 || Object.values(result.alerts).some((value) => value > 0);
    return Response.json(
      { status: needsAttention ? "attention" : "ok", ...result },
      { status: needsAttention ? 503 : 200, headers },
    );
  } catch {
    console.error("Operations run failed; sensitive details withheld.");
    return Response.json({ error: "Operations unavailable" }, { status: 503, headers });
  }
}
