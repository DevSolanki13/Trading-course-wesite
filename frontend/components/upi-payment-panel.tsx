"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import type { PurchaseOrder } from "../../shared/purchase";
import { checkoutMoney } from "./checkout-layout";

export function UpiPaymentPanel({ order }: { order: PurchaseOrder }) {
  const router = useRouter();
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(
    () => !!order.upi && Date.parse(order.upi.expiresAt) <= Date.now(),
  );
  const intent = order.upi;
  const link = intent
    ? `upi://pay?${new URLSearchParams({ pa: intent.vpa, pn: intent.payeeName, am: (intent.amount / 100).toFixed(2), cu: "INR", tn: `Academy ${order.id}` })}`
    : "";
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(link, { width: 280, margin: 2 })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => {
        if (active) setError("QR unavailable. Use the UPI app link below.");
      });
    return () => {
      active = false;
    };
  }, [link]);
  useEffect(() => {
    if (!intent) return;
    let active = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const expiryTimer = setTimeout(
      () => setExpired(true),
      Math.max(0, Date.parse(intent.expiresAt) - Date.now()),
    );
    async function poll() {
      if (document.hidden) {
        timer = setTimeout(() => void poll(), 4000);
        return;
      }
      try {
        const response = await fetch(`/api/purchase/order?id=${order.id}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            "Could not check payment. Your order is saved; keep this page open or check your orders.",
          );
        const data = await response.json();
        if (!active) return;
        if (data.order.status === "paid") {
          router.push(`/checkout/success?orderId=${order.id}`);
          router.refresh();
          return;
        }
        if (data.order.status !== "pending" || Date.parse(intent!.expiresAt) <= Date.now()) {
          setExpired(true);
          return;
        }
        setError("");
      } catch (reason) {
        if (active)
          setError(reason instanceof Error ? reason.message : "Payment check unavailable.");
      }
      if (active && Date.parse(intent!.expiresAt) > Date.now())
        timer = setTimeout(() => void poll(), 4000);
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(expiryTimer);
      controller.abort();
    };
  }, [intent, order.id, router]);
  if (!intent)
    return <p role="alert">Payment setup is pending. Check your saved order before paying.</p>;
  return (
    <section aria-label="UPI payment">
      <h3>Pay exactly {checkoutMoney(intent.amount)}</h3>
      <p>This amount identifies your payment. Keep every digit, including paise, unchanged.</p>
      {expired ? (
        <p role="alert">
          This QR has expired. Do not pay it. If you already paid, contact support with your bank
          reference and order number.
        </p>
      ) : (
        <>
          {/* The QR is generated locally; no payment data is sent to an image service. */}
          {qr && (
            <Image
              unoptimized
              src={qr}
              width={280}
              height={280}
              alt={`Scan to pay ${checkoutMoney(intent.amount)} to ${intent.payeeName}`}
            />
          )}
          <p>
            {intent.payeeName} · {intent.vpa}
          </p>
          <a className="button button-primary" href={link}>
            Open UPI app
          </a>
          <p role="status">
            Waiting for bank confirmation… Course access opens automatically after confirmation.
          </p>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <p>Order reference: {order.id}</p>
      <p>
        Paid but still waiting? Contact <Link href="/contact">support</Link> with this order
        reference and your bank transaction reference. Do not pay again.
      </p>
    </section>
  );
}
