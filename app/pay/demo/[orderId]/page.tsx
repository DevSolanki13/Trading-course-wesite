import { notFound } from "next/navigation";
import { DemoPaymentPanel } from "@/frontend/components/demo-payment-panel";
import { isDemoPaymentEnabled } from "@/backend/payments/demo";
export const dynamic = "force-dynamic";
export default async function DemoPayPage({ params }: { params: Promise<{ orderId: string }> }) { if (!isDemoPaymentEnabled()) notFound(); const { orderId } = await params; return <main className="demo-pay-page container"><DemoPaymentPanel orderId={orderId} /></main>; }
