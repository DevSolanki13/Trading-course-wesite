import { z } from "zod";
const id = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);
const optionalId = id.nullable().optional();
const version = z.number().int().min(1);
const url = z.union([
  z.literal(""),
  z.url().refine((value) => {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  }, "Use an HTTPS URL."),
]);
const note = text(1000).min(5, "Add an explanation of at least five characters.");
const social = (hosts: string[]) =>
  url.refine(
    (value) => !value || hosts.includes(new URL(value).hostname),
    "Use an official service URL.",
  );
export const courseSchema = z
  .object({
    courseId: optionalId,
    version: version.optional(),
    title: text(150).min(3),
    slug: text(120).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    description: text(2000),
    price_paise: z.number().int().min(0).max(100000000),
    sale_price_paise: z.number().int().min(0).max(100000000).nullable(),
    level: z.enum(["beginner", "intermediate", "advanced"]),
    language: text(30).min(1),
    thumbnail_url: url,
    outcomes: z.array(text(150)).max(12),
    audience: text(1000),
    prerequisites: text(1000),
    artwork: z.enum(["foundations", "structure", "risk"]),
  })
  .strict()
  .refine(
    (v) => v.sale_price_paise === null || v.sale_price_paise <= v.price_paise,
    "Sale price cannot exceed the base price.",
  )
  .refine((v) => !v.courseId || v.version, "Reload the course before saving.");
export const lessonSchema = z
  .object({
    courseId: id,
    version,
    moduleId: id,
    id: optionalId,
    title: text(180).min(2),
    duration_seconds: z.number().int().min(0).max(86400),
    videoId: z.union([z.literal(""), text(128).regex(/^[a-zA-Z0-9_-]{8,128}$/)]),
    notes: text(6000),
    is_preview: z.boolean(),
    published: z.boolean(),
    resources: z.array(z.object({ title: text(150).min(1), content: text(2000) }).strict()).max(3),
  })
  .strict();
export const settingsSchema = z
  .object({
    version,
    gst_enabled: z.boolean(),
    gst_rate_bps: z.number().int().min(0).max(10000),
    gstin: z.union([
      z.literal(""),
      text(15).regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/),
    ]),
    device_limit: z.number().int().min(1).max(2),
    refund_window_days: z.number().int().min(0).max(365),
    refund_watch_limit_percent: z.number().int().min(0).max(100),
    business_name: text(180),
    business_address: text(1000),
    support_email: z.union([z.literal(""), z.email()]),
    public_telegram_url: social(["t.me", "telegram.me"]),
    public_instagram_url: social(["instagram.com", "www.instagram.com"]),
    private_telegram_url: social(["t.me", "telegram.me"]),
    private_invite_expires_at: z.iso.datetime().nullable(),
  })
  .strict()
  .refine(
    (v) => !v.private_telegram_url || !!v.private_invite_expires_at,
    "Set an expiry for the private invitation.",
  )
  .refine((v) => !v.gst_enabled || !!v.gstin, "Add a GSTIN before enabling GST.");
export const contentSchema = z
  .object({
    version,
    document: z
      .object({
        heroTitle: text(100),
        heroAccent: text(100),
        heroDescription: text(500),
        teachingTitle: text(140),
        teachingDescription: text(1000),
        instructorName:text(100),
        instructorBio:text(1200),
        instructorPortraitUrl:url,
        instructorConfirmed:z.boolean(),
        faqs: z
          .array(z.object({ question: text(180).min(3), answer: text(800).min(3) }).strict())
          .max(12),
        testimonials: z
          .array(
            z
              .object({ name: text(80).min(1), quote: text(500).min(5), course: text(100) })
              .strict(),
          )
          .max(5),
        genuineTestimonialsConfirmed: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .refine(
    (v) => !v.document.testimonials.length || v.document.genuineTestimonialsConfirmed,
    "Confirm permission and authenticity before publishing testimonials.",
  ).refine(v=>!(v.document.instructorName||v.document.instructorBio||v.document.instructorPortraitUrl)||(!!v.document.instructorName&&!!v.document.instructorBio&&v.document.instructorConfirmed),"Confirm the instructor's identity, biography and media permission before publishing.");
export const operationSchemas = {
  course_save: courseSchema,
  course_state: z
    .object({ courseId: id, version, status: z.enum(["draft", "published", "archived"]) })
    .strict(),
  module_save: z
    .object({ courseId: id, version, id: optionalId, title: text(150).min(2) })
    .strict(),
  lesson_save: lessonSchema,
  reorder: z
    .object({
      courseId: id,
      version,
      kind: z.enum(["modules", "lessons"]),
      moduleId: optionalId,
      ids: z.array(id).min(1).max(100),
    })
    .strict()
    .refine((v) => new Set(v.ids).size === v.ids.length, "Duplicate items are not allowed.")
    .refine((v) => v.kind === "modules" || !!v.moduleId, "Choose a module."),
  grant: z.object({ userId: id, courseId: id, note }).strict(),
  revoke: z.object({ enrollmentId: id, note }).strict(),
  block: z.object({ userId: id, blocked: z.boolean(), note }).strict(),
  logout_student: z.object({ userId: id, note }).strict(),
  settings: settingsSchema,
  content: contentSchema,
  coupon: z
    .object({
      id: optionalId,
      version: version.optional(),
      code: text(32)
        .transform((v) => v.toUpperCase())
        .pipe(z.string().regex(/^[A-Z0-9_-]{3,32}$/)),
      kind: z.enum(["fixed", "percent"]),
      value: z.number().int().min(1).max(100000000),
      courseId: optionalId,
      expiresAt: z.iso.datetime().nullable(),
      totalLimit: z.number().int().min(1).nullable(),
      perUserLimit: z.number().int().min(1).max(1000),
      active: z.boolean(),
    })
    .strict()
    .refine((v) => v.kind !== "percent" || v.value <= 10000, "Percentage cannot exceed 100%.")
    .refine((v) => !v.id || !!v.version, "Reload the coupon."),
  refund_decide: z
    .object({
      id,
      version,
      decision: z.enum(["approve", "reject"]),
      note,
      goodwill: z.boolean().default(false),
    })
    .strict(),
  goodwill_request: z.object({ orderId: id, note }).strict(),
  task_done: z.object({ id, note }).strict(),
} as const;
export type AdminAction = keyof typeof operationSchemas;
