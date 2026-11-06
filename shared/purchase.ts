export type PurchaseLesson = {
  id: string;
  title: string;
  duration: number;
  preview: boolean;
  completed: boolean;
};
export type PurchaseCourse = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  currency: "INR";
  level: string;
  language: string;
  thumbnail: string | null;
  owned: boolean;
  accessPeriod: number;
  accessUnit: "days" | "months";
  accessExpiresAt: string | null;
  progress: number;
  modules: { id: string; title: string; lessons: PurchaseLesson[] }[];
};
export type PurchaseOrder = {
  id: string;
  courseId: string;
  slug: string;
  courseTitle: string;
  userId: string;
  amount: number;
  tax: number;
  base: number;
  currency: "INR";
  status: string;
  paymentStatus?: "pending" | "failed" | "cancelled";
  provider: "mock" | "razorpay" | "cashfree" | "demo";
  providerOrderId: string | null;
  createdAt: string;
  paidAt: string | null;
  accessPeriod: number;
  accessUnit: "days" | "months";
  accessExpiresAt: string | null;
};
export function purchaseReceiptHref(order: Pick<PurchaseOrder, "id" | "provider">) {
  return order.provider === "cashfree" || order.provider === "demo"
    ? `/api/orders/${order.id}/document`
    : `/dashboard/orders/${order.id}/receipt`;
}
export type PurchaseLessonContent = PurchaseLesson & {
  content: string;
  videoUrl: string | null;
  isDemo: boolean;
  providerVideoId?: string | null;
  vdoCipher?: {
    otp: string;
    playbackInfo: string;
  } | null;
  resources?: Array<{
    id: string;
    title: string;
    size?: string;
    url: string;
  }>;
  outcomes?: string[];
};
export type PurchaseUser = {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin" | "support";
  phone?: string | null;
  avatar?: string | null;
};
