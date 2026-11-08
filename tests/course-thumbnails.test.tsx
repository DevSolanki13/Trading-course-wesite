import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { CourseEditor } from "../frontend/components/admin/course-editor";
import { adminRequest } from "../backend/handlers/admin";
import { courseThumbnail } from "../backend/admin/thumbnails";
import { courseSchema } from "../backend/admin/validation";
import { MAX_THUMBNAIL_BYTES } from "../shared/course-thumbnail";
import type { AdminCourse } from "../shared/admin";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  session: vi.fn(),
  privileged: vi.fn(),
  fetch: vi.fn(),
  createAdmin: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../backend/local/database", () => ({
  localDatabase: async () => ({ query: mocks.query }),
}));
vi.mock("../backend/local/auth", () => ({
  LOCAL_SESSION_COOKIE: "session",
  localSession: mocks.session,
}));
vi.mock("../backend/auth/session", () => ({ privileged: mocks.privileged, audit: vi.fn() }));
vi.mock("../backend/database/supabase", () => ({ createAdminClient: mocks.createAdmin }));

const id = "11111111-1111-4111-8111-111111111111";
const thumbnailUrl = `/api/course-thumbnails/${id}`;
const course: AdminCourse = {
  id,
  version: 1,
  slug: "market-basics",
  title: "Market basics",
  description: "Course description",
  price_paise: 10000,
  sale_price_paise: null,
  access_period: 1,
  access_unit: "months",
  language: "Hindi",
  level: "beginner",
  status: "draft",
  thumbnail_url: null,
  outcomes: ["Understand market structure"],
  audience: "",
  prerequisites: "",
  artwork: "risk",
  modules: [],
  updated_at: "2026-11-08T00:00:00Z",
};
const request = (image: string, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/admin/thumbnail-upload", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ image }),
  });
async function photo() {
  const image = await sharp({
    create: { width: 80, height: 40, channels: 3, background: "#11aa88" },
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${image.toString("base64")}`;
}
function pick(file = new File(["photo"], "thumbnail.png", { type: "image/png" })) {
  fireEvent.change(screen.getByLabelText("Choose photo from device"), {
    target: { files: [file] },
  });
}
function mount(value: AdminCourse = course) {
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(<CourseEditor course={value} onSaved={onSaved} onBack={vi.fn()} />);
  return onSaved;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LOCAL_DEMO", "true");
  vi.stubEnv("PAYMENT_PROVIDER", "demo");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  mocks.session.mockResolvedValue({ id, role: "admin" });
  mocks.query.mockResolvedValue({ rows: [] });
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("device thumbnail picker", () => {
  it("uploads, previews and saves a device image, then previews it when the editor reopens", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ thumbnailUrl }) });
    const onSaved = mount();
    pick();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByAltText("Market basics")).toHaveAttribute("src", thumbnailUrl),
    );
    expect(mocks.fetch.mock.calls[0][0]).toBe("/api/admin/thumbnail-upload");
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).image).toMatch(/^data:image\/png;base64,/);
    expect(screen.getByLabelText("Thumbnail HTTPS URL (optional)")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).form!);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(id));
    const saved = JSON.parse(mocks.fetch.mock.calls[1][1].body);
    expect(saved.data.thumbnail_url).toBe(thumbnailUrl);
    expect(saved.data.artwork).toBe("risk");
  });

  it("previews saved uploads and allows removing or replacing them with an HTTPS URL", () => {
    mount({ ...course, thumbnail_url: thumbnailUrl });
    expect(screen.getByAltText("Market basics")).toHaveAttribute("src", thumbnailUrl);
    fireEvent.click(screen.getByRole("button", { name: "Remove thumbnail" }));
    expect(screen.queryByAltText("Market basics")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Thumbnail HTTPS URL (optional)"), {
      target: { value: "https://example.com/photo.jpg" },
    });
    expect(screen.getByAltText("Market basics")).toHaveAttribute(
      "src",
      "https://example.com/photo.jpg",
    );
  });

  it("rejects unsupported and oversized files without uploading", () => {
    mount();
    pick(new File(["svg"], "photo.svg", { type: "image/svg+xml" }));
    expect(screen.getByRole("alert")).toHaveTextContent("JPG, PNG or WebP");
    pick(new File([new Uint8Array(MAX_THUMBNAIL_BYTES + 1)], "large.jpg", { type: "image/jpeg" }));
    expect(screen.getByRole("alert")).toHaveTextContent("smaller than 3 MB");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("keeps the previous thumbnail after an upload failure and allows retrying", async () => {
    mocks.fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: "Upload unavailable" }),
    });
    mount({ ...course, thumbnail_url: "https://example.com/previous.jpg" });
    pick();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Upload unavailable"));
    expect(screen.getByAltText("Market basics")).toHaveAttribute(
      "src",
      "https://example.com/previous.jpg",
    );
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ thumbnailUrl }) });
    pick();
    await waitFor(() =>
      expect(screen.getByAltText("Market basics")).toHaveAttribute("src", thumbnailUrl),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("thumbnail upload and delivery", () => {
  it("checks authentication, admin role and request origin before storing a photo", async () => {
    const image = await photo();
    mocks.session.mockResolvedValueOnce(null);
    expect((await adminRequest(request(image))).status).toBe(401);
    mocks.session.mockResolvedValueOnce({ id, role: "support" });
    expect((await adminRequest(request(image))).status).toBe(403);
    expect((await adminRequest(request(image, "https://other.example"))).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("converts real image bytes to WebP, stores them and serves them by their persisted ID", async () => {
    const uploaded = await adminRequest(request(await photo()));
    expect(uploaded.status).toBe(200);
    const result = await uploaded.json();
    const [storedId, content] = mocks.query.mock.calls[0][1];
    expect(result.thumbnailUrl).toBe(`/api/course-thumbnails/${storedId}`);
    mocks.query.mockResolvedValueOnce({ rows: [{ content }] });
    const response = await courseThumbnail(storedId);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toContain("immutable");
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    expect(metadata).toMatchObject({ format: "webp", width: 80, height: 40 });
  });

  it("rejects spoofed and corrupt images instead of storing arbitrary bytes", async () => {
    for (const image of ["data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,aGVsbG8="]) {
      expect((await adminRequest(request(image))).status).toBe(400);
    }
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("bounds the request size and returns 404 for invalid or missing thumbnail IDs", async () => {
    const image = `data:image/png;base64,${"a".repeat(MAX_THUMBNAIL_BYTES * 2)}`;
    expect((await adminRequest(request(image))).status).toBe(413);
    expect((await courseThumbnail("../private")).status).toBe(404);
    expect(mocks.query).not.toHaveBeenCalled();
    expect((await courseThumbnail(id)).status).toBe(404);
  });

  it("only permits uploaded thumbnail paths or existing HTTPS links in course saves", () => {
    const data = {
      courseId: course.id,
      version: course.version,
      title: course.title,
      slug: course.slug,
      description: course.description,
      price_paise: course.price_paise,
      sale_price_paise: course.sale_price_paise,
      access_period: course.access_period,
      access_unit: course.access_unit,
      level: course.level,
      language: course.language,
      outcomes: course.outcomes,
      audience: course.audience,
      prerequisites: course.prerequisites,
      artwork: course.artwork,
    };
    for (const thumbnail_url of [thumbnailUrl, "https://example.com/photo.jpg", ""]) {
      expect(courseSchema.safeParse({ ...data, thumbnail_url }).success).toBe(true);
    }
    for (const thumbnail_url of [
      "//evil.example/photo",
      "/api/admin/orders",
      "data:image/svg+xml,evil",
      "http://example.com/photo.jpg",
    ]) {
      expect(courseSchema.safeParse({ ...data, thumbnail_url }).success).toBe(false);
    }
  });
});
