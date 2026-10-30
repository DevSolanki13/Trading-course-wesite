import "server-only";
import { z } from "zod";
import { admitted } from "../auth/session";
import { AuthError, body, failure, json, limit, sameOrigin } from "../auth/http";
import { databaseError } from "../admin/data";
export async function refundRequest(request: Request) {
  try {
    const context = await admitted();
    if (request.method === "GET") {
      const r = await context.admin.rpc("refund_statuses", {
        p_user: context.user.id,
        p_session: context.sessionId,
      });
      databaseError(r.error);
      return json({ items: r.data });
    }
    if (request.method !== "POST") throw new AuthError(405, "Method not allowed.");
    sameOrigin(request);
    await limit(request, "refund-request", context.user.id, 10, 3600);
    const parsed = z
      .object({ orderId: z.string().uuid(), reason: z.string().trim().min(5).max(2000) })
      .strict()
      .safeParse(await body(request));
    if (!parsed.success)
      throw new AuthError(400, "Choose an order and provide a reason of at least five characters.");
    const r = await context.admin.rpc("refund_request", {
      p_user: context.user.id,
      p_session: context.sessionId,
      p_order: parsed.data.orderId,
      p_reason: parsed.data.reason,
    });
    databaseError(r.error);
    return json({ id: r.data, message: "Refund request submitted for review." });
  } catch (error) {
    return failure(error);
  }
}
