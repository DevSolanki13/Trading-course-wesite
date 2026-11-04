import { notFound } from "next/navigation";
import { z } from "zod";
import { CheckoutStatus } from "@/frontend/components/checkout-status";

export const dynamic = "force-dynamic";

export default async function StatusPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!z.string().uuid().safeParse(orderId).success) notFound();
  return (
    <main className="checkout-page container">
      <CheckoutStatus orderId={orderId} />
    </main>
  );
}
