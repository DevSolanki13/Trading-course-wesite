import "server-only";
import { z } from "zod";
import { AuthError, body, failure, json, limit } from "../auth/http";
import { purchaseOrigin } from "../local/http";
import { localRateLimit } from "../local/auth";
import { localDemoEnabled } from "../purchase/mode";
import { purchaseUser } from "../purchase/session";
import { createPurchase, settlePurchase } from "../purchase/service";
import {
  purchaseCatalog,
  purchaseCourse,
  purchaseOrder,
  purchaseOrders,
  purchaseRpc,
} from "../purchase/repository";
import {
  getPaymentProvider,
  mockPaymentsAllowed,
  PaymentsUnavailableError,
  InvalidPaymentSignatureError,
} from "../payments/providers";
import { sendPurchaseReceipt } from "../purchase/mail";
export async function purchaseRequest(request: Request) {
  const url = new URL(request.url);
  const action = url.pathname.replace(/^\/api\/purchase\//, "");
  try {
    if (action === "mock" && !mockPaymentsAllowed()) return json({ error: "Not found" }, 404);
    if (request.method === "GET") {
      if (action === "course") {
        const user = await purchaseUser(false);
        return json({
          course: await purchaseCourse(
            z.string().max(120).parse(url.searchParams.get("id")),
            user?.id ?? null,
          ),
        });
      }
      const user = (await purchaseUser())!;
      if (action === "dashboard") {
        const [courses, orders] = await Promise.all([
          purchaseCatalog(user.id),
          purchaseOrders(user.id),
        ]);
        return json({ user, courses: courses.filter((c) => c.owned), orders });
      }
      if (action === "order") {
        const order = await purchaseOrder(
          z.string().uuid().parse(url.searchParams.get("id")),
          user.id,
        );
        if (!order) throw new AuthError(404, "Order not found.");
        return json({ order });
      }
      return json({ error: "Not found" }, 404);
    }
    purchaseOrigin(request);
    const user = (await purchaseUser())!;
    if (localDemoEnabled()) await localRateLimit(`purchase:${user.id}:${action}`);
    else await limit(request, `purchase:${action}`, user.id, 30, 60);
    if (action === "create") {
      const input = z
        .object({ courseId: z.string().min(1).max(120), terms: z.literal(true) })
        .strict()
        .parse(await body(request));
      const provider = getPaymentProvider();
      const origin = process.env.NEXT_PUBLIC_APP_URL
        ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
        : url.origin;
      const order = await createPurchase(user, input.courseId, origin);
      return json({
        order,
        provider: provider.name,
        keyId: provider.name === "razorpay" ? process.env.RAZORPAY_KEY_ID : undefined,
      });
    }
    if (action === "mock" || action === "verify") {
      const input = z
        .object({
          orderId: z.string().uuid(),
          outcome: z.enum(["paid", "failed", "cancelled"]).optional(),
          payment: z.unknown().optional(),
        })
        .strict()
        .parse(await body(request));
      const order = await purchaseOrder(input.orderId, user.id);
      if (!order) throw new AuthError(404, "Order not found.");
      const provider = getPaymentProvider();
      if (order.provider !== provider.name)
        throw new AuthError(409, "This order uses a different provider. Check its saved status.");
      if (action === "mock" && provider.name !== "mock") return json({ error: "Not found" }, 404);
      if (provider.name === "mock" && action !== "mock")
        throw new AuthError(400, "Use the test checkout controls.");
      const verified = await provider.verifyPayment(
        provider.name === "mock"
          ? {
              providerOrderId: order.providerOrderId,
              amount: order.amount,
              currency: order.currency,
              outcome: input.outcome,
            }
          : input.payment,
      );
      if (
        verified.providerOrderId !== order.providerOrderId ||
        verified.amount !== order.amount ||
        verified.currency !== order.currency
      )
        throw new AuthError(400, "Payment does not match the saved order.");
      await settlePurchase(verified);
      const saved = (await purchaseOrder(order.id, user.id))!;
      if (saved.status === "paid") await sendPurchaseReceipt(order.id, user);
      return json({ order: saved });
    }
    if (action === "complete") {
      const input = z
        .object({ lessonId: z.string().uuid(), completed: z.boolean() })
        .strict()
        .parse(await body(request));
      await purchaseRpc("purchase_complete", {
        p_user: user.id,
        p_lesson: input.lessonId,
        p_completed: input.completed,
      });
      return json({ saved: true });
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof InvalidPaymentSignatureError)
      return json({ error: "Invalid payment signature." }, 400);
    if (error instanceof PaymentsUnavailableError) return json({ error: error.message }, 503);
    if (error instanceof z.ZodError) return json({ error: "Check the supplied fields." }, 400);
    if (error instanceof AuthError) return failure(error);
    if (error && typeof error === "object" && "code" in error && error.code === "23505")
      return json({ error: "You already own this course.", code: "ALREADY_OWNED" }, 409);
    console.error("Purchase operation failed; provider and personal details withheld.");
    return json(
      {
        error:
          error instanceof Error &&
          /pending|awaiting|saved order|Purchase to unlock|temporarily unavailable/.test(
            error.message,
          )
            ? error.message
            : "Purchase is temporarily unavailable. Check your saved order before retrying.",
      },
      503,
    );
  }
}
