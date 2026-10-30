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

export interface PaymentProvider {
  createOrder(order: PaymentOrder): Promise<{ providerOrderId: string; checkoutUrl: string }>;
  verifyWebhook(rawBody: string, headers: Headers): PaymentEvent;
}
