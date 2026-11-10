"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  ArrowsClockwise,
  CheckCircle,
  Clock,
  Copy,
  Hash,
  Info,
  Receipt,
  ShieldCheck,
} from "@phosphor-icons/react";
import type { PurchaseOrder } from "../../shared/purchase";
import { checkoutMoney } from "./checkout-layout";

export function UpiPaymentPanel({ order }: { order: PurchaseOrder }) {
  const router = useRouter();
  const [saved, setSaved] = useState(order);
  const [qr, setQr] = useState("");
  const [qrError, setQrError] = useState("");
  const [error, setError] = useState("");
  const [initiallyExpired] = useState(
    () => !!order.upi && Date.parse(order.upi.expiresAt) <= Date.now(),
  );
  const [remaining, setRemaining] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [manual, setManual] = useState(false);
  const [reference, setReference] = useState("");
  const [referenceError, setReferenceError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const submittingRef = useRef(false);
  const referenceHeading = useRef<HTMLHeadingElement>(null);
  const intent = order.upi;
  const pollInterval = intent?.gateway === "indianxtrade" ? 15000 : 4000;
  const link = intent
    ? (intent.uri ??
      `upi://pay?${new URLSearchParams({ pa: intent.vpa, pn: intent.payeeName, am: (intent.amount / 100).toFixed(2), cu: "INR", tn: `Academy ${order.id}` })}`)
    : "";
  const expired = saved.status !== "pending" || remaining === 0 || initiallyExpired;
  const submitted = saved.paymentReference;
  useEffect(() => {
    let active = true;
    if (!link) return;
    QRCode.toDataURL(link, { width: 280, margin: 2 })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => {
        if (active) setQrError("QR unavailable. Use the UPI app link below.");
      });
    return () => {
      active = false;
    };
  }, [link]);
  useEffect(() => {
    if (!intent) return;
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((Date.parse(intent.expiresAt) - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [intent]);
  useEffect(() => {
    if (manual) referenceHeading.current?.focus();
  }, [manual]);
  useEffect(() => {
    if (!intent) return;
    let active = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (document.hidden) {
        timer = setTimeout(() => void poll(), pollInterval);
        return;
      }
      setChecking(true);
      try {
        const response = await fetch(`/api/purchase/order?id=${order.id}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!active) return;
        if (!response.ok)
          throw new Error(
            data.error ||
              "Could not check payment. Your order is saved. Check again before paying.",
          );
        setSaved((current) => {
          const latest = current.paymentReference;
          const remote = data.order.paymentReference;
          return {
            ...data.order,
            paymentReference:
              latest && (!remote || Date.parse(latest.submittedAt) > Date.parse(remote.submittedAt))
                ? latest
                : remote,
          };
        });
        if (data.order.status === "paid") {
          router.refresh();
          return;
        }
        setError("");
        setChecked(true);
      } catch (reason) {
        if (active)
          setError(reason instanceof Error ? reason.message : "Payment check unavailable.");
      } finally {
        if (active) setChecking(false);
      }
      if (active) timer = setTimeout(() => void poll(), pollInterval);
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [intent, order.id, router, pollInterval, attempt]);
  async function submitReference(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const normalized = reference.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,32}$/.test(normalized)) {
      setReferenceError("Enter 6–32 letters or numbers from your UPI transaction details.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setReferenceError("");
    try {
      const response = await fetch("/api/purchase/reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, reference: normalized }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Reference could not be saved. Please try again.");
      if (data.order.status === "paid") {
        router.refresh();
        return;
      }
      if (!data.order.paymentReference)
        throw new Error("Reference could not be saved. Please try again.");
      setSaved(data.order);
      setManual(false);
    } catch (reason) {
      setReferenceError(reason instanceof Error ? reason.message : "Reference could not be saved.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }
  const statusButton = (
    <button
      type="button"
      className="ix-button ix-secondary"
      disabled={checking}
      onClick={() => setAttempt((n) => n + 1)}
    >
      {checking ? "Checking payment…" : "I’ve paid · Check status"}
      <ArrowsClockwise size={20} aria-hidden="true" />
    </button>
  );
  if (!intent)
    return <p role="alert">Payment setup is pending. Check your saved order before paying.</p>;
  return (
    <section aria-label="UPI payment">
      {submitted && !manual ? (
        <div className="ix-status-card" role="status">
          <span className="ix-state-icon">
            <Receipt size={30} aria-hidden="true" />
          </span>
          <span className="ix-status-chip">Reference submitted</span>
          <h2>Reference received.</h2>
          <p>
            We’re checking your reference against the bank payment. Your order will update once
            confirmed.
          </p>
          <div className="ix-submitted-receipt">
            <span>
              Payment reference <small>Submitted</small>
            </span>
            <strong>{submitted.reference}</strong>
            <dl>
              <div>
                <dt>Amount to verify</dt>
                <dd>{checkoutMoney(saved.amount)}</dd>
              </div>
              <div>
                <dt>Order</dt>
                <dd>{order.id}</dd>
              </div>
            </dl>
          </div>
          <ol className="ix-verification-steps">
            <li>
              <CheckCircle size={20} aria-hidden="true" />
              Reference submitted
            </li>
            <li>
              <Clock size={20} aria-hidden="true" />
              Waiting for bank verification
            </li>
            <li>
              <ShieldCheck size={20} aria-hidden="true" />
              Course access opens after confirmation
            </li>
          </ol>
          {statusButton}
          <p className="ix-caption">
            Submitting a reference doesn’t confirm a payment. No need to pay again.
          </p>
          <button
            className="ix-text-button"
            onClick={() => {
              setReference(submitted.reference);
              setManual(true);
            }}
          >
            Correct the reference
          </button>
        </div>
      ) : null}
      {manual ? (
        <div className="ix-status-card ix-manual">
          <button type="button" className="ix-back" onClick={() => setManual(false)}>
            <ArrowLeft size={16} aria-hidden="true" />
            {submitted ? "Back to payment status" : "Back to payment"}
          </button>
          <span className="ix-state-icon is-amber">
            <Clock size={30} aria-hidden="true" />
          </span>
          <span className="ix-status-chip is-amber">Awaiting bank confirmation</span>
          <h2 ref={referenceHeading} tabIndex={-1}>
            Paid, but still waiting?
          </h2>
          <p>
            Sometimes bank confirmation takes a little longer. Add your reference to help us find
            your payment.
          </p>
          <p className="ix-do-not-pay">
            <Info size={18} aria-hidden="true" />
            If money was debited, please don’t pay again.
          </p>
          <form
            className="ix-reference-form"
            onSubmit={(event) => void submitReference(event)}
            aria-busy={submitting}
          >
            <label htmlFor="upi-reference">
              UPI transaction reference <span>(UTR)</span>
            </label>
            <div className="ix-reference-input">
              <input
                id="upi-reference"
                value={reference}
                maxLength={32}
                autoComplete="off"
                spellCheck={false}
                placeholder="Enter transaction reference"
                onChange={(event) => {
                  setReference(event.target.value);
                  setReferenceError("");
                }}
                disabled={submitting}
                aria-invalid={!!referenceError}
                aria-describedby={`upi-reference-help${referenceError ? " upi-reference-error" : ""}`}
              />
              <Hash size={20} aria-hidden="true" />
            </div>
            <p id="upi-reference-help" className="ix-input-help">
              Find it in your UPI app’s transaction details.
            </p>
            <div className="ix-reference-example">
              <Receipt size={20} aria-hidden="true" />
              <div>
                <strong>Where do I find this?</strong>
                <p>Open your payment → Transaction details → UPI reference number</p>
              </div>
            </div>
            {referenceError && (
              <p id="upi-reference-error" className="ix-error" role="alert">
                {referenceError}
              </p>
            )}
            <button className="ix-button ix-primary" disabled={submitting || !reference.trim()}>
              {submitting ? "Saving reference…" : "Submit reference"}
              <ArrowRight size={20} aria-hidden="true" />
            </button>
            <p className="ix-caption">
              We’ll verify it against the bank payment before opening your course.
            </p>
          </form>
        </div>
      ) : !submitted ? (
        <>
          <div className="ix-payment-card">
            <div className="ix-payment-top">
              <span className="ix-status-chip">
                {expired ? "Payment window ended" : "Awaiting payment"}
              </span>
              <span className="ix-expires">
                <Clock size={15} aria-hidden="true" />
                {remaining === null
                  ? "--:--"
                  : `${Math.floor(remaining / 60)
                      .toString()
                      .padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`}
              </span>
            </div>
            <div className="ix-amount">
              <span>Pay exactly</span>
              <strong>{checkoutMoney(intent.amount)}</strong>
              <p>Keep the amount, including paise, unchanged.</p>
            </div>
            {expired ? (
              <p className="ix-do-not-pay" role="status">
                This QR has expired. Do not pay it. If you already paid, submit your reference
                below.
              </p>
            ) : (
              <>
                <div className="ix-qr-frame">
                  {qr ? (
                    <Image
                      unoptimized
                      src={qr}
                      width={244}
                      height={244}
                      alt={`Scan to pay ${checkoutMoney(intent.amount)} to IndianXTrade`}
                    />
                  ) : (
                    <span>Preparing QR…</span>
                  )}
                </div>
                <p className="ix-scan-caption">Scan with any UPI app</p>
              </>
            )}
            <p className="ix-payee">
              <ShieldCheck size={18} aria-hidden="true" />
              Paying <strong>IndianXTrade</strong>
            </p>
            <div className="ix-upi-id">
              <span>{intent.vpa}</span>
              <button
                type="button"
                aria-label="Copy UPI ID"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(intent.vpa);
                    setCopied(true);
                  } catch {
                    setError("Could not copy. Select and copy the UPI ID above.");
                  }
                }}
              >
                <Copy size={16} aria-hidden="true" />
              </button>
              {copied && <span role="status">Copied</span>}
            </div>
            {qrError && !expired && (
              <p className="ix-error" role="alert">
                {qrError}
              </p>
            )}
            {!expired && (
              <a className="ix-button ix-primary" href={link}>
                Open UPI app
                <ArrowSquareOut size={20} aria-hidden="true" />
              </a>
            )}
            {statusButton}
            <p className="ix-confirmation-note" role="status">
              {checked ? "Payment not confirmed yet. " : ""}Checking for bank confirmation
              automatically
            </p>
          </div>
          <button type="button" className="ix-manual-shortcut" onClick={() => setManual(true)}>
            <Receipt size={22} aria-hidden="true" />
            <span>
              <strong>Paid, but not confirmed?</strong>
              <small>Enter your transaction reference</small>
            </span>
            <ArrowRight size={20} aria-hidden="true" />
          </button>
          {expired && (
            <p className="ix-caption">
              If you haven’t paid, <Link href={`/checkout/${order.slug}`}>return to checkout</Link>{" "}
              for a new payment window.
            </p>
          )}
        </>
      ) : null}
      {error && (
        <p className="ix-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
