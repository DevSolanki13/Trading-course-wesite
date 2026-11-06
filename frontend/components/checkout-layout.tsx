import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, LockSimple } from "@phosphor-icons/react";

export function checkoutMoney(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}

export function CheckoutLayout({
  title = "Complete your checkout",
  course,
  basePaise,
  taxPaise,
  totalPaise,
  discountPaise = 0,
  notice,
  details,
  policy,
  coupon,
  children,
}: {
  title?: string;
  course: { slug: string; title: string; description: string };
  basePaise: number;
  taxPaise: number;
  totalPaise: number;
  discountPaise?: number;
  notice?: ReactNode;
  details?: ReactNode;
  policy?: ReactNode;
  coupon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="checkout-flow" aria-labelledby="checkout-title">
      <Link className="checkout-back" href={`/courses/${course.slug}`}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to course
      </Link>
      <header className="checkout-heading">
        <div>
          <h1 id="checkout-title">{title}</h1>
          <p>Review your order and complete your payment.</p>
        </div>
        <span className="checkout-header-note">
          <LockSimple size={16} aria-hidden="true" /> Checkout
        </span>
      </header>
      {notice && (
        <div className="checkout-mode-notice" role="note">
          {notice}
        </div>
      )}
      <div className="checkout-grid">
        <section className="checkout-order" aria-labelledby="checkout-order-title">
          <h2 id="checkout-order-title">Order summary</h2>
          <div className="checkout-product">
            <span className="checkout-product-icon">
              <BookOpen size={24} aria-hidden="true" />
            </span>
            <div>
              <span className="checkout-product-type">Online course</span>
              <h3>{course.title}</h3>
            </div>
          </div>
          <p className="checkout-description">{course.description}</p>
          {details && <p className="checkout-access">{details}</p>}
          <dl className="checkout-price-list">
            <div>
              <dt>Course price</dt>
              <dd>{checkoutMoney(basePaise)}</dd>
            </div>
            {discountPaise > 0 && (
              <div className="checkout-discount">
                <dt>Coupon discount</dt>
                <dd>−{checkoutMoney(discountPaise)}</dd>
              </div>
            )}
            <div>
              <dt>GST</dt>
              <dd>{checkoutMoney(taxPaise)}</dd>
            </div>
            <div className="checkout-amount-due">
              <dt>
                Total amount<span>Including applicable taxes</span>
              </dt>
              <dd>{checkoutMoney(totalPaise)}</dd>
            </div>
          </dl>
          {coupon}
          {policy && <div className="checkout-refund">{policy}</div>}
        </section>
        <section className="checkout-payment" aria-labelledby="checkout-payment-title">
          {children}
        </section>
      </div>
    </section>
  );
}
