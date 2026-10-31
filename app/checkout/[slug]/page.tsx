import { notFound, redirect } from "next/navigation";
import { CheckoutForm } from "@/frontend/components/checkout-form";
import { admitted } from "@/backend/auth/session";
import { AuthError } from "@/backend/auth/http";
import { isDemoPaymentEnabled } from "@/backend/payments/demo";
import { calculateTotal } from "@/backend/payments/calculations";
import { cashfreeSandboxEnabled } from "@/backend/payments/cashfree";
import { headers } from "next/headers";
import { getPaymentProvider } from "@/backend/payments/providers";
import { requirePurchaseUser } from "@/backend/purchase/pages";
import { purchaseCourse, purchaseRpc } from "@/backend/purchase/repository";
import { PurchaseCheckout } from "@/frontend/components/purchase-checkout";
export const dynamic = "force-dynamic";
export const metadata = { title: "Course checkout", robots: { index: false, follow: false } };
export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  if (
    process.env.PAYMENT_PROVIDER === "razorpay" ||
    !["demo", "cashfree-sandbox"].includes(process.env.PAYMENT_MODE ?? "")
  ) {
    const { slug } = await params;
    const user = await requirePurchaseUser(`/checkout/${slug}`);
    const course = await purchaseCourse(slug, user.id);
    if (!course) notFound();
    if (course.owned) redirect(`/learn/${course.slug}`);
    let provider: "mock" | "razorpay" = "mock",
      available = true;
    try {
      provider = getPaymentProvider().name;
    } catch {
      available = false;
    }
    const tax = await purchaseRpc<number>("purchase_tax", { p_base: course.price });
    return (
      <main id="main-content" className="checkout-page container">
        <PurchaseCheckout
          course={course}
          provider={provider}
          available={available}
          tax={tax}
          nonce={(await headers()).get("x-nonce") ?? undefined}
        />
      </main>
    );
  }
  const sandbox = cashfreeSandboxEnabled();
  if (!isDemoPaymentEnabled() && !sandbox) notFound();
  const { slug } = await params;
  let context;
  try {
    context = await admitted();
  } catch (error) {
    const next = encodeURIComponent(`/checkout/${slug}`);
    if (error instanceof AuthError && error.status === 401) redirect(`/login?next=${next}`);
    if (error instanceof AuthError && error.code === "DEVICE_LIMIT")
      redirect(`/auth/devices?next=${next}`);
    throw error;
  }
  const [course, settings] = await Promise.all([
    context.admin
      .from("courses")
      .select("slug,title,description,price_paise,sale_price_paise")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle(),
    context.admin
      .from("site_settings")
      .select("gst_enabled,gst_rate_bps,refund_window_days,refund_watch_limit_percent")
      .eq("id", true)
      .single(),
  ]);
  if (course.error || settings.error) throw new Error("Checkout is temporarily unavailable.");
  if (!course.data) notFound();
  const totals = calculateTotal({
    basePaise: sandbox
      ? (course.data.sale_price_paise ?? course.data.price_paise)
      : course.data.price_paise,
    gstEnabled: settings.data.gst_enabled,
    gstRateBps: settings.data.gst_rate_bps,
  });
  return (
    <main id="main-content" className="checkout-page container">
      <CheckoutForm
        course={{ slug, title: course.data.title, description: course.data.description }}
        totals={totals}
        refundDays={settings.data.refund_window_days}
        refundWatchLimit={settings.data.refund_watch_limit_percent}
        sandbox={sandbox}
      />
    </main>
  );
}
