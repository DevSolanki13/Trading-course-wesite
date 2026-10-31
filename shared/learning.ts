/** Serializable API contracts only; no provider clients or secrets. */
export type LessonView = {
  id: string;
  title: string;
  duration: number;
  preview: boolean;
  completed: boolean;
  position: number;
  watchedSeconds: number;
};
export type ModuleView = { id: string; title: string; lessons: LessonView[] };
export type CourseView = {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  language: string;
  modules: ModuleView[];
  owned: boolean;
  accessExpiresAt?: string | null;
  progress: number;
  resumeLessonId: string | null;
};
export type OrderView = {
  id: string;
  courseTitle: string;
  status: string;
  total: number;
  createdAt: string;
  paidAt: string | null;
  refund: { eligible: boolean; reason: string; deadline?: string; watchedPercent?: number };
};
export type LibraryView = {
  name: string;
  courses: CourseView[];
  browse: CourseView[];
  orders: OrderView[];
  community: {
    telegram: string | null;
    instagram: string | null;
    privateInvite: string | null;
    expiresAt: string | null;
    eligible: boolean;
  };
};
export type PlaybackView = {
  autoplay?: boolean;
  otp: string;
  playbackInfo: string;
  leaseId: string | null;
  position: number;
  sequence: number;
  preview: boolean;
};
