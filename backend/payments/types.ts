export type PaymentOrder = {
  id: string;
  providerOrderId?: string | null;
  amountPaise: number;
  currency: "INR";
  courseSlug: string;
  customerEmail: string;
};

export type PaymentEvent = {
  eventId: string;
  providerOrderId: string;
  status: "paid" | "failed" | "pending" | "cancelled";
  amountPaise: number;
};

/** Compatibility contract for the older explicitly configured demo routes. */
export interface LegacyDemoPaymentProvider {
  createOrder(order: PaymentOrder): Promise<{ providerOrderId: string; checkoutUrl: string }>;
  verifyWebhook(rawBody: string, headers: Headers): PaymentEvent;
}
export type { PaymentProvider } from "./providers";
