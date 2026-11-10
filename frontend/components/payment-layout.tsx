import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarBlank,
  Check,
  Devices,
  Headset,
  LockSimple,
  PlayCircle,
  ShieldCheck,
  Translate,
} from "@phosphor-icons/react";
import type { PurchaseCourse, PurchaseOrder } from "../../shared/purchase";
import { checkoutMoney } from "./checkout-layout";

export function accessLabel(course: Pick<PurchaseCourse, "accessPeriod" | "accessUnit">) {
  return `${course.accessPeriod} ${course.accessPeriod === 1 ? course.accessUnit.slice(0, -1) : course.accessUnit} access`;
}
export function PaymentShell({ children, stage = 1 }: { children: ReactNode; stage?: 1 | 2 | 3 }) {
  return (
    <div className="ix-checkout">
      <header className="ix-payment-header">
        <Link className="ix-identity" href="/" aria-label="IndianXTrade home">
          <Image
            src="/brand/indianxtrade-wordmark-dark.png"
            alt="IndianXTrade"
            width={184}
            height={38}
            priority
          />
          {stage > 1 && <span>Gateway</span>}
        </Link>
        <nav className="ix-steps" aria-label="Checkout progress">
          <ol>
            {["Checkout", "Payment", "Course access"].map((name, index) => (
              <li
                key={name}
                aria-current={stage === index + 1 ? "step" : undefined}
                className={stage > index + 1 ? "is-complete" : ""}
              >
                <span>
                  {stage > index + 1 ? <Check size={13} aria-hidden="true" /> : index + 1}
                </span>
                {name}
              </li>
            ))}
          </ol>
        </nav>
        <span className="ix-secure">
          <LockSimple size={17} aria-hidden="true" />
          <span>Secure checkout</span>
        </span>
      </header>
      <main id="main-content" className="ix-payment-main">
        {children}
      </main>
    </div>
  );
}
export function CourseCover({
  course,
  compact = false,
}: {
  course: PurchaseCourse;
  compact?: boolean;
}) {
  return (
    <div
      className={`ix-course-cover${compact ? " is-compact" : ""}${course.title.length > 24 ? " ix-long-title" : ""}`}
    >
      {course.thumbnail ? (
        <Image
          src={course.thumbnail}
          alt={course.title}
          fill
          sizes={compact ? "360px" : "624px"}
          className="ix-cover-photo"
          loading="eager"
        />
      ) : (
        <>
          <div className="ix-cover-copy">
            <span>INDIANXTRADE ACADEMY</span>
            <strong>{course.title}</strong>
            <p>Learn the process.</p>
          </div>
          <Image
            src="/brand/course-process-chart.svg"
            alt=""
            width={560}
            height={210}
            className="ix-cover-chart"
            loading="eager"
          />
          <span className="ix-cover-number">01 / LEARN</span>
        </>
      )}
    </div>
  );
}
export function CourseReview({ course }: { course: PurchaseCourse }) {
  return (
    <section className="ix-course-review" aria-labelledby="review-course-title">
      <CourseCover course={course} />
      <div className="ix-course-info">
        <span className="ix-eyebrow">YOUR COURSE</span>
        <h2 id="review-course-title">{course.title}</h2>
        <p>{course.description}</p>
        <div className="ix-course-meta">
          <span>
            <Translate size={17} aria-hidden="true" />
            {course.language}
          </span>
          <span>
            <PlayCircle size={17} aria-hidden="true" />
            Self-paced
          </span>
          <span>
            <CalendarBlank size={17} aria-hidden="true" />
            {accessLabel(course)}
          </span>
        </div>
      </div>
      <div className="ix-benefits">
        <p>
          <BookOpen size={19} aria-hidden="true" />
          From market basics to price action
        </p>
        <p>
          <ShieldCheck size={19} aria-hidden="true" />
          Risk management and execution
        </p>
        <p>
          <Devices size={19} aria-hidden="true" />
          Learn across your devices
        </p>
      </div>
    </section>
  );
}
export function PaymentTotals({
  base,
  tax,
  total,
  couponDiscount = 0,
  gatewaySavings = 0,
  couponCode,
  gateway = false,
}: {
  base: number;
  tax: number;
  total: number;
  couponDiscount?: number;
  gatewaySavings?: number;
  couponCode?: string | null;
  gateway?: boolean;
}) {
  // This is an offer illustration, not tax collected or an invoice calculation.
  const referenceGst = tax === 0 ? Math.floor((Math.max(0, base - couponDiscount) * 18) / 100) : 0;
  const earlyBirdOffer = referenceGst + gatewaySavings;
  return (
    <>
      <dl className="ix-price-list">
        <div>
          <dt>Course price</dt>
          <dd>{checkoutMoney(base)}</dd>
        </div>
        {couponDiscount > 0 && (
          <div className="ix-savings">
            <dt>{couponCode ? `Coupon · ${couponCode}` : "Coupon discount"}</dt>
            <dd>−{checkoutMoney(couponDiscount)}</dd>
          </div>
        )}
        <div>
          <dt>{referenceGst > 0 ? "GST (18%, reference)" : "GST"}</dt>
          <dd>{checkoutMoney(tax || referenceGst)}</dd>
        </div>
        {earlyBirdOffer > 0 && (
          <div className="ix-savings">
            <dt>Early bird offer</dt>
            <dd>−{checkoutMoney(earlyBirdOffer)}</dd>
          </div>
        )}
        <div className="ix-total">
          <dt>
            {gateway ? "Exact amount to pay" : "Order total"}
            <small>One-time payment</small>
          </dt>
          <dd>{checkoutMoney(total)}</dd>
        </div>
      </dl>
      {referenceGst > 0 && (
        <p className="ix-offer-note">
          GST charged: ₹0.00. The 18% reference amount is fully offset by the early bird offer.
          {gatewaySavings > 0 &&
            ` The offer also includes the ${checkoutMoney(gatewaySavings)} payment amount adjustment.`}
        </p>
      )}
    </>
  );
}
export function GatewayOrderSummary({
  course,
  order,
}: {
  course: PurchaseCourse;
  order: PurchaseOrder;
}) {
  const savings = order.gatewaySavings ?? 0;
  const totals = (
    <PaymentTotals
      base={order.base}
      tax={order.tax}
      total={order.amount}
      couponDiscount={
        order.couponDiscount ?? Math.max(0, order.base + order.tax - order.amount - savings)
      }
      gatewaySavings={savings}
      couponCode={order.couponCode}
      gateway
    />
  );
  return (
    <aside className="ix-order-rail" aria-label="Order summary">
      <div className="ix-desktop-order">
        <span className="ix-eyebrow">YOU’RE ENROLLING IN</span>
        <h2>{order.courseTitle}</h2>
        <p>Build your foundation. Develop your trading process.</p>
        <CourseCover course={course} compact />
        <div className="ix-rail-meta">
          <span>
            <CalendarBlank size={17} aria-hidden="true" />
            {accessLabel(order)}
          </span>
          <span>
            <Translate size={17} aria-hidden="true" />
            Lessons in {course.language}
          </span>
        </div>
        {totals}
        <div className="ix-order-reference">
          <span>Order reference</span>
          <strong>{order.id}</strong>
        </div>
      </div>
      <details className="ix-mobile-order">
        <summary>
          <BookOpen size={22} aria-hidden="true" />
          <span>
            <strong>{order.courseTitle}</strong>
            <small>
              {course.language} · {accessLabel(order)}
            </small>
          </span>
          <span className="ix-summary-toggle">Details</span>
        </summary>
        <div>
          {totals}
          <p className="ix-order-reference">Order {order.id}</p>
        </div>
      </details>
    </aside>
  );
}
export function PaymentHelp({ orderId }: { orderId?: string }) {
  return (
    <div className="ix-help">
      <span>
        <Headset size={18} aria-hidden="true" />
        Need a hand? <Link href="/contact">Contact support</Link>
      </span>
      {orderId && <small>Order {orderId}</small>}
    </div>
  );
}
export function PaymentBack({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="ix-back" href={href}>
      <ArrowLeft size={17} aria-hidden="true" />
      {children}
    </Link>
  );
}
