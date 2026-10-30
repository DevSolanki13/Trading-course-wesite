import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "../database/supabase";
import { AuthError } from "../auth/http";
import { isDemoPaymentEnabled } from "./demo";
import type { PaymentEvent } from "./types";

export async function settleDemoPayment(event: PaymentEvent) {
  if (!isDemoPaymentEnabled()) throw new AuthError(404, "Not found.");
  const { error } = await createAdminClient().rpc("demo_settle_payment", {
    p_hash: createHash("sha256").update(JSON.stringify(event)).digest("hex"),
    p_event: event,
  });
  if (error)
    throw new AuthError(503, "Payment could not be confirmed. Retry or check your orders.");
}
