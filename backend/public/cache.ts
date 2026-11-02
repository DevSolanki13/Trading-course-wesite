import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

export const PUBLIC_CATALOG_TAG = "public-catalogue";
const contentActions = new Set([
  "course_save",
  "course_state",
  "module_save",
  "lesson_save",
  "reorder",
  "course_delete",
  "lesson_delete",
  "settings",
  "content",
]);

/** Called only after a successful admin write; private account data is never cached. */
export function invalidatePublicCatalog(action: string) {
  if (!contentActions.has(action)) return;
  revalidateTag(PUBLIC_CATALOG_TAG, { expire: 0 });
  for (const path of ["/", "/courses", "/about", "/contact", "/sitemap.xml"]) revalidatePath(path);
  revalidatePath("/courses/[slug]", "page");
}
