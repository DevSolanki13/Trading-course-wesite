import "server-only";
import { createAdminClient } from "../database/supabase";
import type { Purchase } from "./cashfree";
import type { CommerceStore, PaymentConfirmation, RefundRequest } from "./workflow";

export function commerceStore(admin = createAdminClient()): CommerceStore {
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const result = await admin.rpc(name, args);
    if (result.error) throw new Error("COMMERCE_WRITE_FAILED");
  };
  return {
    async order(id) {
      const r = await admin
        .from("orders")
        .select("id,user_id,provider_order_id,total_paise,status,created_at,billing_snapshot")
        .eq("provider_order_id", id)
        .maybeSingle();
      if (r.error || !r.data) throw new Error("COMMERCE_ORDER_UNAVAILABLE");
      return r.data as Purchase;
    },
    async refund(reference) {
      const r = await admin
        .from("refund_requests")
        .select("id,order_id,provider_reference,state")
        .eq("provider_reference", reference)
        .maybeSingle();
      if (r.error || !r.data) throw new Error("COMMERCE_REFUND_UNAVAILABLE");
      return r.data as RefundRequest;
    },
    payment: (event: PaymentConfirmation, hash: string) =>
      rpc("commerce_settle_payment", { p_hash: hash, p_event: event }),
    terminal: (id, status) => rpc("commerce_close_order", { p_provider_id: id, p_status: status }),
    refundState: (reference, id, amount, state) =>
      rpc("commerce_refund_state", {
        p_reference: reference,
        p_provider_id: id,
        p_amount: amount,
        p_state: state,
      }),
  };
}
