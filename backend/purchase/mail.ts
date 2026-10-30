import { localDemoEnabled } from "./mode.ts";
import { purchaseRpc } from "./repository.ts";
import { sendNotification, type Notification } from "../notifications/delivery.ts";
import type { PurchaseUser } from "../../shared/purchase.ts";
export async function sendPurchaseReceipt(orderId: string, user: PurchaseUser) {
  try {
    if (
      localDemoEnabled() &&
      process.env.NODE_ENV !== "production" &&
      !process.env.RESEND_API_KEY
    ) {
      const { localDatabase } = await import("../local/database.ts");
      const db = await localDatabase();
      await db.exec(
        "create table if not exists local_auth.mail_log(order_id uuid primary key,created_at timestamptz default now())",
      );
      const result = await db.query<{ subject: string; body: string }>(
        "select subject,body from notification_outbox where user_id=$1 and dedupe_key=$2",
        [user.id, `purchase:${orderId}`],
      );
      const row = result.rows[0];
      if (!row) return;
      const logged = await db.query(
        "insert into local_auth.mail_log(order_id)values($1)on conflict do nothing returning order_id",
        [orderId],
      );
      if (logged.rows.length)
        console.info(
          `[DEV EMAIL - not delivered]\nTo: ${user.email}\nSubject: ${row.subject}\n${row.body}`,
        );
      return;
    }
    if (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) {
      const row = await purchaseRpc<Notification | null>("purchase_mail_claim", {
        p_user: user.id,
        p_order: orderId,
      });
      if (row) {
        console.info(
          `[DEV EMAIL - not delivered]\nTo: ${user.email}\nSubject: ${row.subject}\n${row.body}`,
        );
        await purchaseRpc("purchase_mail_finish", {
          p_id: row.id,
          p_attempt: row.attempts,
          p_success: false,
        });
      }
      return;
    }
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
      console.error("Receipt remains queued: mail sender is not configured.");
      return;
    }
    const row = await purchaseRpc<Notification | null>("purchase_mail_claim", {
      p_user: user.id,
      p_order: orderId,
    });
    if (!row) return;
    let accepted = false;
    try {
      accepted = await sendNotification(row, user.email);
    } catch {}
    await purchaseRpc("purchase_mail_finish", {
      p_id: row.id,
      p_attempt: row.attempts,
      p_success: accepted,
    });
  } catch {
    console.error("Receipt delivery deferred; paid access is unaffected. Details withheld.");
  }
}
