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
  provider: "mock" | "razorpay";
  providerOrderId: string | null;
  createdAt: string;
  paidAt: string | null;
  accessPeriod: number;
  accessUnit: "days" | "months";
  accessExpiresAt: string | null;
};
export type PurchaseLessonContent = PurchaseLesson & {
  content: string;
  videoUrl: string | null;
  isDemo: boolean;
};
export type PurchaseUser = {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin" | "support";
};
