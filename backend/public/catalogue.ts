import "server-only";
import { cache } from "react";
import { createAdminClient } from "../database/supabase";
import type { SiteDocument } from "../../shared/admin";
type RawCourse = {
  slug: string;
  title: string;
  description: string;
  level: string;
  language: string;
  price_paise: number;
  thumbnail_url: string | null;
  artwork: string;
  outcomes: unknown;
  audience: string;
  prerequisites: string;
  modules: {
    title: string;
    position: number;
    lessons: {
      title: string;
      position: number;
      duration_seconds: number;
      is_preview: boolean;
      published: boolean;
      id: string;
    }[];
  }[];
};
const format = (value: number) =>
  `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
function social(raw: unknown, hosts: string[]) {
  try {
    const u = new URL(String(raw));
    return u.protocol === "https:" && hosts.includes(u.hostname) && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export const publicCatalog = cache(async function publicCatalog() {
  try {
    const admin = createAdminClient();
    const [courses, content, settings] = await Promise.all([
      admin
        .from("courses")
        .select(
          "slug,title,description,level,language,price_paise,thumbnail_url,artwork,outcomes,audience,prerequisites,modules(title,position,lessons(id,title,position,duration_seconds,is_preview,published))",
        )
        .eq("status", "published")
        .order("created_at")
        .limit(100),
      admin.from("site_content").select("document").eq("id", true).single(),
      admin
        .from("site_settings")
        .select("public_telegram_url,public_instagram_url,support_email")
        .eq("id", true)
        .single(),
    ]);
    if (courses.error || content.error || settings.error) throw Error("Unavailable");
    const result = (courses.data as RawCourse[]).map((raw) => {
      const modules = [...raw.modules]
        .sort((a, b) => a.position - b.position)
        .map((m) => ({
          title: m.title,
          lessons: m.lessons
            .filter((l) => l.published)
            .sort((a, b) => a.position - b.position)
            .map((l) => ({
              title: l.title,
              duration: format(l.duration_seconds),
              preview: l.is_preview,
              id: l.id,
            })),
        }));
      const lessons = modules.flatMap((m) => m.lessons);
      const seconds = [...raw.modules]
        .flatMap((m) => m.lessons)
        .filter((l) => l.published)
        .reduce((n, l) => n + l.duration_seconds, 0);
      return {
        slug: raw.slug,
        title: raw.title,
        shortTitle: raw.description.split(".")[0]?.slice(0, 100) ?? raw.title,
        summary: raw.description,
        level: raw.level[0].toUpperCase() + raw.level.slice(1),
        duration: `${Math.floor(seconds / 3600)}h ${String(Math.round((seconds % 3600) / 60)).padStart(2, "0")}m`,
        lessons: lessons.length,
        price: raw.price_paise / 100,
        artwork: ["foundations", "structure", "risk"].includes(raw.artwork)
          ? raw.artwork
          : "foundations",
        color: "mint",
        outcomes: Array.isArray(raw.outcomes)
          ? raw.outcomes.filter((x): x is string => typeof x === "string")
          : [],
        audience: raw.audience,
        prerequisites: raw.prerequisites,
        modules,
        thumbnailUrl: raw.thumbnail_url,
        provisional: false,
        previewLessonId: lessons.find((l) => l.preview)?.id,
      };
    });
    const doc = content.data.document as SiteDocument;
    return {
      courses: result,
      content: doc && typeof doc === "object" ? doc : null,
      telegramUrl: social(settings.data.public_telegram_url, ["t.me", "telegram.me"]),
      instagramUrl: social(settings.data.public_instagram_url, [
        "instagram.com",
        "www.instagram.com",
      ]),
      supportEmail:
        typeof settings.data.support_email === "string" &&
        /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(settings.data.support_email)
          ? settings.data.support_email
          : null,
    };
  } catch {
    return {
      courses: [],
      content: null,
      telegramUrl: null,
      instagramUrl: null,
      supportEmail: null,
    };
  }
});
