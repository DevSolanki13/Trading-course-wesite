import { AuthError, failure, json } from "@/backend/auth/http";
import { DemoProvider, isDemoPaymentEnabled } from "@/backend/payments/demo";
import { settleDemoPayment } from "@/backend/payments/settlement";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isDemoPaymentEnabled()) return json({ error: "Not found" }, 404);
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new AuthError(400, "Empty event.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new AuthError(413, "Event too large.");
      }
      chunks.push(value);
    }
    let event;
    try {
      event = new DemoProvider().verifyWebhook(
        Buffer.concat(chunks).toString("utf8"),
        request.headers,
      );
    } catch {
      throw new AuthError(401, "Invalid payment event.");
    }
    await settleDemoPayment(event);
    return json({ received: true });
  } catch (error) {
    return failure(error);
  }
}
