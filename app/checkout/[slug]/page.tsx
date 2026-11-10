import { notFound, redirect } from "next/navigation";
import { getCheckoutProvider } from "@/backend/payments/providers";
import { requirePurchaseUser } from "@/backend/purchase/pages";
import { purchaseCourse, purchaseRpc } from "@/backend/purchase/repository";
import { PurchaseCheckout } from "@/frontend/components/purchase-checkout";
export const dynamic = "force-dynamic";
export const metadata = { title: "Course checkout", robots: { index: false, follow: false } };
export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  const user = await requirePurchaseUser(`/checkout/${slug}`);
  const course = await purchaseCourse(slug, user.id);
  if (!course) notFound();
  if (isUuid && course.slug) redirect(`/checkout/${course.slug}`);
  if (course.owned) redirect(`/learn/${course.slug}`);
  let available = true;
  try {
    getCheckoutProvider(process.env, user.id);
  } catch {
    available = false;
  }
  const tax = await purchaseRpc<number>("purchase_tax", { p_base: course.price });
  return <PurchaseCheckout course={course} provider="upi" available={available} tax={tax} />;
}
