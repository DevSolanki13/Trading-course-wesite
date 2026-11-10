import { AuthError } from "../auth/http";
import { purchaseOrder } from "../purchase/repository";
import { reconcileGatewayPurchase } from "../purchase/upi-gateway";
import { sendPurchaseReceipt } from "../purchase/mail";
import type { PurchaseUser } from "../../shared/purchase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PGlite } from "@electric-sql/pglite";

export function upiPaymentParams(url: URL) {
  const tab = url.searchParams.get("tab") ?? "review";
  if (!["review", "unmatched", "history"].includes(tab))
    throw new AuthError(400, "Choose a payment view.");
  const page = Number(url.searchParams.get("page") ?? 0);
  return {
    p_tab: tab,
    p_query: (url.searchParams.get("q") ?? "").trim().slice(0, 120),
    p_page: Number.isSafeInteger(page) && page >= 0 ? Math.min(page, 10000) : 0,
  };
}

export async function checkAcademyUpiPayment(orderId: string, userId: string) {
  const order = await purchaseOrder(orderId, userId);
  if (!order || order.provider !== "upi") throw new AuthError(404, "UPI order not found.");
  const result = await reconcileGatewayPurchase(order, userId);
  return {
    message:
      result.status === "paid"
        ? "Payment confirmed and course access recorded."
        : result.status === "cancelled"
          ? "The gateway closed this checkout."
          : "The gateway has not confirmed payment yet. No course access was granted.",
  };
}

export type ManualApproveInput = {
  id: string;
  utr: string;
  reason: string;
  confirmAmount: number;
  bankChecked: boolean;
};

export async function approveAcademyUpiPayment(
  actorId: string,
  input: ManualApproveInput,
  options: {
    adminClient?: SupabaseClient;
    localDb?: PGlite;
  },
) {
  const normalizedUtr = input.utr.trim().toUpperCase();

  // Validate UTR in synced bank records vs explicit bank statement check
  if (options.localDb) {
    const bankCheck = await options.localDb.query(
      "select 1 from academy_upi_gateway_deposits where utr=$1 union all select 1 from academy_upi_unmatched_credits where utr=$1 limit 1",
      [normalizedUtr],
    );
    if (!bankCheck.rows.length && !input.bankChecked) {
      throw new AuthError(
        400,
        "This UTR was not found in the synced bank records. Please check the bank statement and confirm with the checkbox.",
      );
    }
  } else if (options.adminClient) {
    const [depCheck, credCheck] = await Promise.all([
      options.adminClient
        .from("academy_upi_gateway_deposits")
        .select("token")
        .eq("utr", normalizedUtr)
        .limit(1),
      options.adminClient
        .from("academy_upi_unmatched_credits")
        .select("id")
        .eq("utr", normalizedUtr)
        .limit(1),
    ]);
    const foundInBank = (depCheck.data?.length ?? 0) > 0 || (credCheck.data?.length ?? 0) > 0;
    if (!foundInBank && !input.bankChecked) {
      throw new AuthError(
        400,
        "This UTR was not found in the synced bank records. Please check the bank statement and confirm with the checkbox.",
      );
    }
  }

  // Execute manual approval transaction
  let rpcResult: { status: string; alreadyPaid: boolean } | null = null;
  if (options.localDb) {
    try {
      const res = await options.localDb.query<{
        result: { status: string; alreadyPaid: boolean };
      }>("select admin_upi_manual_approve($1,$2,$3,$4,$5) as result", [
        actorId,
        input.id,
        normalizedUtr,
        input.reason.trim(),
        input.confirmAmount,
      ]);
      rpcResult = res.rows[0]?.result ?? null;
    } catch (err: unknown) {
      const pgErr = err as { code?: string; message?: string };
      if (pgErr.code === "42501") {
        throw new AuthError(403, pgErr.message || "Unauthorized to approve payments.");
      }
      if (pgErr.code === "23505") {
        throw new AuthError(409, "This UTR has already been used to approve an order.");
      }
      if (pgErr.code === "22023") {
        throw new AuthError(400, pgErr.message || "Invalid approval parameters.");
      }
      throw new AuthError(500, pgErr.message || "Failed to approve payment.");
    }
  } else if (options.adminClient) {
    const { data, error } = await options.adminClient.rpc("admin_upi_manual_approve", {
      p_actor: actorId,
      p_order: input.id,
      p_utr: normalizedUtr,
      p_reason: input.reason.trim(),
      p_confirm_amount: input.confirmAmount,
    });
    if (error) {
      if (error.code === "42501") {
        throw new AuthError(403, error.message || "Unauthorized to approve payments.");
      }
      if (error.code === "23505") {
        throw new AuthError(409, "This UTR has already been used to approve an order.");
      }
      if (error.code === "22023") {
        throw new AuthError(400, error.message || "Invalid approval parameters.");
      }
      throw new AuthError(500, error.message || "Failed to approve payment.");
    }
    rpcResult = data as { status: string; alreadyPaid: boolean };
  }

  // Best-effort receipt notification
  try {
    let studentUser: PurchaseUser | null = null;
    if (options.localDb) {
      const ownerRes = await options.localDb.query<{
        id: string;
        email: string;
        full_name: string;
      }>(
        "select u.id, u.email, p.full_name from orders o join auth.users u on u.id=o.user_id join profiles p on p.id=u.id where o.id=$1",
        [input.id],
      );
      if (ownerRes.rows[0]) {
        studentUser = {
          id: ownerRes.rows[0].id,
          email: ownerRes.rows[0].email,
          name: ownerRes.rows[0].full_name || "Student",
          role: "student",
        };
      }
    } else if (options.adminClient) {
      const orderRes = await options.adminClient
        .from("orders")
        .select("user_id, profiles(id, full_name)")
        .eq("id", input.id)
        .single();
      if (orderRes.data) {
        const authUser = await options.adminClient.auth.admin.getUserById(orderRes.data.user_id);
        if (authUser.data?.user?.email) {
          studentUser = {
            id: orderRes.data.user_id,
            email: authUser.data.user.email,
            name:
              (orderRes.data.profiles as unknown as { full_name?: string })?.full_name || "Student",
            role: "student",
          };
        }
      }
    }
    if (studentUser) {
      await sendPurchaseReceipt(input.id, studentUser);
    }
  } catch (mailErr) {
    console.warn("Manual approval receipt email failed (outbox will retry):", mailErr);
  }

  return {
    status: "paid",
    alreadyPaid: Boolean(rpcResult?.alreadyPaid),
    message: rpcResult?.alreadyPaid
      ? "Order is already recorded as paid."
      : "Payment approved manually and course access granted.",
  };
}
