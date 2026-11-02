import { describe, expect, it, vi } from "vitest";
import { invalidatePublicCatalog, PUBLIC_CATALOG_TAG } from "../backend/public/cache";

vi.mock("server-only", () => ({}));
const cache = vi.hoisted(() => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);

describe("public catalogue invalidation", () => {
  it("immediately expires published data after every operation that can change the public catalogue", () => {
    for (const action of [
      "course_save",
      "course_state",
      "module_save",
      "lesson_save",
      "reorder",
      "course_delete",
      "lesson_delete",
      "settings",
      "content",
    ]) {
      cache.revalidateTag.mockClear();
      cache.revalidatePath.mockClear();
      invalidatePublicCatalog(action);
      expect(cache.revalidateTag).toHaveBeenCalledWith(PUBLIC_CATALOG_TAG, { expire: 0 });
      for (const path of ["/", "/courses", "/about", "/contact", "/sitemap.xml"])
        expect(cache.revalidatePath).toHaveBeenCalledWith(path);
      expect(cache.revalidatePath).toHaveBeenCalledWith("/courses/[slug]", "page");
    }
  });

  it("does not invalidate public content for private account, coupon or refund operations", () => {
    cache.revalidateTag.mockClear();
    cache.revalidatePath.mockClear();
    for (const action of [
      "grant",
      "revoke",
      "block",
      "logout_student",
      "coupon",
      "refund_decide",
      "task_done",
    ])
      invalidatePublicCatalog(action);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });
});
