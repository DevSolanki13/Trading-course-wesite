import { notFound } from "next/navigation";
import { CheckoutStatus } from "@/frontend/components/checkout-status";
import { isDemoPaymentEnabled } from "@/backend/payments/demo";
export const dynamic = "force-dynamic";
export default async function StatusPage({ params }: { params: Promise<{ orderId: string }> }) { if (!isDemoPaymentEnabled()) notFound(); const { orderId } = await params; return <main className="checkout-page container"><CheckoutStatus orderId={orderId} /></main>; }
