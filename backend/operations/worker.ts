import "server-only";
import { createAdminClient } from "../database/supabase";
import { CashfreeClient, cashfreeSandboxEnabled } from "../payments/cashfree";
import { commerceStore } from "../payments/data";
import { reconcilePayment, reconcileRefund } from "../payments/workflow";
import { sendNotification, type Notification } from "../notifications/delivery";
import { operationsEnabled } from "./policy";

export async function runOperations() {
  if (!operationsEnabled()) throw new Error("OPERATIONS_DISABLED");
  const deadline = AbortSignal.timeout(240000);
  const boundedFetch: typeof fetch = (input, init) =>
    fetch(input, {
      ...init,
      signal: AbortSignal.any([deadline, ...(init?.signal ? [init.signal] : [])]),
    });
  const admin = createAdminClient(deadline);
  const store = commerceStore(admin);
  const summary = { jobs: 0, completed: 0, retried: 0, notifications: 0, accepted: 0, failed: 0 };
  if (cashfreeSandboxEnabled()) {
    const claimed = await admin.rpc("commerce_claim_jobs");
    if (claimed.error) throw new Error("JOB_CLAIM_FAILED");
    const client = new CashfreeClient(process.env, boundedFetch);
    for (const job of claimed.data ?? []) {
      summary.jobs++;
      let done = false;
      let confirmed = false;
      try {
        if (job.kind === "payment")
          done = (await reconcilePayment(client, store, job.target)) !== "pending";
        else {
          const refund = await store.refund(job.target);
          const order = await admin
            .from("orders")
            .select("provider_order_id")
            .eq("id", refund.order_id)
            .single();
          if (order.error || !order.data?.provider_order_id)
            throw new Error("REFUND_ORDER_UNAVAILABLE");
          done =
            (await reconcileRefund(
              client,
              store,
              order.data.provider_order_id,
              job.target,
              true,
            )) !== "pending";
        }
        confirmed = true;
      } catch {
        summary.failed++;
      }
      if (confirmed) {
        let inbox = admin
          .from("webhook_events")
          .update({ status: "processed", processed_at: new Date().toISOString() })
          .eq("provider", "cashfree")
          .in("status", ["received", "failed"]);
        inbox =
          job.kind === "payment"
            ? inbox.eq("payload->>orderId", job.target).is("payload->>refundId", null)
            : inbox.eq("payload->>refundId", job.target);
        if ((await inbox).error) summary.failed++;
      }
      const saved = await admin.rpc("commerce_finish_job", {
        p_id: job.id,
        p_attempt: job.attempts,
        p_done: done,
      });
      if (saved.error || saved.data !== true) {
        summary.failed++;
        continue;
      }
      if (done) summary.completed++;
      else summary.retried++;
    }
  }
  if (process.env.NOTIFICATION_DELIVERY_ENABLED === "true") {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
      throw new Error("SENDER_UNCONFIGURED");
    const claimed = await admin.rpc("notification_claim");
    if (claimed.error) throw new Error("NOTIFICATION_CLAIM_FAILED");
    for (const row of (claimed.data ?? []) as (Notification & { user_id: string })[]) {
      summary.notifications++;
      let accepted = false;
      try {
        const user = await admin.auth.admin.getUserById(row.user_id);
        if (!user.error && user.data.user?.email_confirmed_at && user.data.user.email)
          accepted = await sendNotification(row, user.data.user.email, process.env, boundedFetch);
      } catch {}
      const backoff = Math.min(86400, 300 * 2 ** Math.min(row.attempts, 8));
      const saved = await admin
        .from("notification_outbox")
        .update({
          state: accepted ? "sent" : "failed",
          claimed_until: null,
          ...(!accepted
            ? { next_attempt_at: new Date(Date.now() + backoff * 1000).toISOString() }
            : {}),
        })
        .eq("id", row.id)
        .eq("state", "sending")
        .eq("attempts", row.attempts)
        .gt("claimed_until", new Date().toISOString())
        .select("id");
      if (saved.error || saved.data?.length !== 1) summary.failed++;
      if (accepted) summary.accepted++;
      else summary.failed++;
    }
  }
  const metrics = await admin.rpc("commerce_ops_summary");
  if (metrics.error) throw new Error("MONITORING_UNAVAILABLE");
  const alerts = metrics.data as Record<string, number>;
  // Log only aggregate operational signals. No user/order IDs or provider bodies.
  if (Object.values(alerts).some((value) => value > 0))
    console.error("Operations require attention", alerts);
  return {
    ...summary,
    alerts,
    deliveryEnabled: process.env.NOTIFICATION_DELIVERY_ENABLED === "true",
    sandboxEnabled: cashfreeSandboxEnabled(),
  };
}
