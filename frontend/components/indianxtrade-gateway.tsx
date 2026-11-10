"use client";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle,
  Clock,
  DownloadSimple,
  Receipt,
  ShieldCheck,
} from "@phosphor-icons/react";
import type { PurchaseCourse, PurchaseOrder } from "../../shared/purchase";
import { purchaseReceiptHref } from "../../shared/purchase";
import { checkoutMoney } from "./checkout-layout";
import {
  GatewayOrderSummary,
  PaymentBack,
  PaymentHelp,
  PaymentShell,
  accessLabel,
} from "./payment-layout";
import { UpiPaymentPanel } from "./upi-payment-panel";

export function IndianxtradeGatewayPage({
  initialOrder: order,
  course,
  accessExpired = false,
}: {
  initialOrder: PurchaseOrder;
  course: PurchaseCourse;
  accessExpired?: boolean;
}) {
  const paid = order.status === "paid";
  return (
    <PaymentShell stage={paid ? 3 : 2}>
      <div className="ix-gateway-container">
        <div className="ix-gateway-top">
          <PaymentBack href={`/checkout/${order.slug}`}>Back to checkout</PaymentBack>
          <span>IndianXTrade Gateway</span>
        </div>
        <div className="ix-gateway-grid">
          <GatewayOrderSummary order={order} course={course} />
          <div className="ix-gateway-primary">
            <header className="ix-gateway-heading">
              <h1>{paid ? "Payment confirmed." : "IndianXTrade Gateway"}</h1>
              <p>
                {paid
                  ? "Welcome to IndianXTrade Academy."
                  : "Complete your course payment with UPI."}
              </p>
            </header>
            {paid ? (
              <section className="ix-status-card ix-success" aria-label="Confirmed payment">
                <span className="ix-state-icon">
                  <Check size={34} aria-hidden="true" />
                </span>
                <span className="ix-status-chip is-success">
                  <CheckCircle size={14} aria-hidden="true" />
                  Bank confirmed
                </span>
                <h2>
                  {accessExpired ? (
                    "Your access period has ended."
                  ) : (
                    <>
                      You’re in.
                      <br />
                      Let’s start learning.
                    </>
                  )}
                </h2>
                <p>
                  Your payment of <strong>{checkoutMoney(order.amount)}</strong> is confirmed.
                  {!accessExpired && <> Your course is ready in your dashboard.</>}
                </p>
                <div className="ix-success-course">
                  <Receipt size={24} aria-hidden="true" />
                  <div>
                    <strong>{order.courseTitle}</strong>
                    <small>
                      {accessLabel(order)} · Lessons in {course.language}
                    </small>
                  </div>
                  <ShieldCheck size={23} aria-hidden="true" />
                </div>
                <Link
                  className="ix-button ix-primary"
                  href={accessExpired ? `/checkout/${order.slug}` : `/learn/${order.slug}`}
                >
                  {accessExpired ? "Renew course access" : "Start learning"}
                  <ArrowRight size={20} aria-hidden="true" />
                </Link>
                <Link className="ix-receipt-link" href={purchaseReceiptHref(order)}>
                  <DownloadSimple size={18} aria-hidden="true" />
                  View payment receipt
                </Link>
                <p className="ix-caption">
                  Your order and receipt are saved in Billing & receipts.
                </p>
              </section>
            ) : order.upi && ["pending", "cancelled"].includes(order.status) ? (
              <UpiPaymentPanel key={order.id} order={order} />
            ) : (
              <section className="ix-status-card">
                <span className="ix-state-icon">
                  <Clock size={30} aria-hidden="true" />
                </span>
                <h2>
                  {order.status === "pending"
                    ? "Payment setup is pending."
                    : order.status === "refunded"
                      ? "Payment refunded."
                      : "Payment not completed."}
                </h2>
                <p>
                  {order.status === "pending"
                    ? "Your order is saved. Resume setup before making a payment."
                    : "Check your saved order and bank transaction before paying again."}
                </p>
                <Link className="ix-button ix-primary" href={`/checkout/${order.slug}`}>
                  {order.status === "pending" ? "Resume payment setup" : "Return to checkout"}
                  <ArrowRight size={20} aria-hidden="true" />
                </Link>
              </section>
            )}
            <PaymentHelp orderId={order.id} />
          </div>
        </div>
      </div>
    </PaymentShell>
  );
}
