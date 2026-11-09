import "server-only";
import { sharedUpiGateway } from "../payments/indianxtrade";
import { reconcileGatewayPurchase } from "../purchase/upi-gateway";
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
  purchaseLesson,
  purchaseOrder,
  purchaseOrders,
  purchaseOrdersPage,
  purchaseRpc,
  purchaseQuoteCoupon,
} from "../purchase/repository";
import {
  getCheckoutProvider,
  PaymentsUnavailableError,
  InvalidPaymentSignatureError,
} from "../payments/providers";
import { schedulePurchaseReceipt } from "../purchase/mail";
export async function purchaseRequest(request: Request) {
  const url = new URL(request.url);
  const action = url.pathname.replace(/^\/api\/purchase\//, "");
  try {
    if (action === "mock") return json({ error: "Not found" }, 404);
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
      if (action === "lesson") {
        const user = await purchaseUser(false);
        const lessonId = z.string().uuid().parse(url.searchParams.get("id"));
        const lesson = await purchaseLesson(lessonId, user?.id ?? null);
        return json({ lesson });
      }
      const user = (await purchaseUser())!;
      if (action === "orders") {
        if (!localDemoEnabled()) await limit(request, "billing-history", user.id, 30, 60);
        if (url.searchParams.size) {
          const cursorSchema = z
            .object({ createdAt: z.iso.datetime({ offset: true }), id: z.uuid() })
            .strict();
          const cursor = (name: string) => {
            const value = url.searchParams.get(name);
            if (!value) return null;
            try {
              return cursorSchema.parse(JSON.parse(value));
            } catch {
              throw new AuthError(400, "Invalid history cursor.");
            }
          };
          return json(
            await purchaseOrdersPage(user.id, {
              limit: z.coerce
                .number()
                .int()
                .min(1)
                .max(50)
                .parse(url.searchParams.get("limit") ?? 20),
              cursor: cursor("cursor"),
              pendingCursor: cursor("pendingCursor"),
              pendingOnly: z.enum(["0", "1"]).parse(url.searchParams.get("pending") ?? "0") === "1",
              status: z
                .enum(["all", "pending", "paid", "failed", "cancelled", "refunded"])
                .parse(url.searchParams.get("status") ?? "all"),
              provider: z
                .enum(["all", "mock", "razorpay", "upi", "cashfree", "demo"])
                .parse(url.searchParams.get("provider") ?? "all"),
            }),
          );
        }
        return json({ orders: await purchaseOrders(user.id) });
      }
      if (action === "dashboard") {
        const [courses, orders] = await Promise.all([
          purchaseCatalog(user.id),
          purchaseOrders(user.id),
        ]);
        return json({ user, courses: courses.filter((c) => c.owned || c.accessExpiresAt), orders });
      }
      if (action === "order") {
        let order = await purchaseOrder(
          z.string().uuid().parse(url.searchParams.get("id")),
          user.id,
        );
        if (!order) throw new AuthError(404, "Order not found.");
        if (sharedUpiGateway()) order = await reconcileGatewayPurchase(order, user.id);
        if (order.status === "paid" && order.provider === "upi")
          schedulePurchaseReceipt(order.id, user);
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
        .object({
          courseId: z.string().min(1).max(120),
          terms: z.literal(true),
          coupon: z.string().trim().max(32).optional(),
        })
        .strict()
        .parse(await body(request));
      const provider = getCheckoutProvider(process.env, user.id);
      const origin = process.env.NEXT_PUBLIC_APP_URL
        ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
        : url.origin;
      const order = await createPurchase(user, input.courseId, origin, input.coupon);
      return json({
        order,
        provider: provider.name,
        keyId: provider.name === "razorpay" ? process.env.RAZORPAY_KEY_ID : undefined,
      });
    }
    if (action === "quote") {
      const input = z
        .object({ courseId: z.string().min(1).max(120), coupon: z.string().trim().min(3).max(32) })
        .strict()
        .parse(await body(request));
      return json(await purchaseQuoteCoupon(input.courseId, input.coupon, user.id));
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
      const provider = getCheckoutProvider(process.env, user.id);
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
      if (saved.status === "paid") schedulePurchaseReceipt(order.id, user);
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
    if (error && typeof error === "object" && "status" in error) {
      const status = Number(error.status);
      if (Number.isInteger(status) && status >= 400 && status < 500)
        return json(
          { error: error instanceof Error ? error.message : "Please try again later." },
          status,
        );
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "23505")
        return json({ error: "You already own this course.", code: "ALREADY_OWNED" }, 409);
      if (error.code === "42501")
        return json(
          {
            error: error instanceof Error ? error.message : "Access denied.",
            code: "ACCESS_DENIED",
          },
          403,
        );
      if (error.code === "22023")
        return json(
          {
            error:
              error instanceof Error ? error.message : "Course or order configuration unavailable.",
            code: "INVALID_REQUEST",
          },
          400,
        );
    }
    console.error("Purchase operation failed:", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Purchase is temporarily unavailable. Check your saved order before retrying.",
      },
      503,
    );
  }
}
