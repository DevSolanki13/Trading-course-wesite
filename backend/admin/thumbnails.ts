import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { AuthError, body, json } from "../auth/http";
import { createAdminClient } from "../database/supabase";
import { localDatabase } from "../local/database";
import { localDemoEnabled } from "../purchase/mode";
import { MAX_THUMBNAIL_BYTES, UPLOADED_THUMBNAIL } from "../../shared/course-thumbnail";

/** Called only after the admin handler has checked origin, session and role. */
export async function uploadCourseThumbnail(request: Request) {
  const input = await body(request, Math.ceil(MAX_THUMBNAIL_BYTES / 3) * 4 + 1024);
  const match =
    typeof input?.image === "string" &&
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.image);
  if (!match) throw new AuthError(400, "Choose a JPG, PNG or WebP photo.");
  const original = Buffer.from(match[2], "base64");
  if (!original.length || original.length > MAX_THUMBNAIL_BYTES)
    throw new AuthError(413, "Choose a photo smaller than 3 MB.");

  let image: Buffer;
  try {
    const photo = sharp(original, { limitInputPixels: 40_000_000 });
    const metadata = await photo.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("Unsupported");
    image = await photo
      .rotate()
      .resize({ width: 1600, height: 1000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new AuthError(400, "This photo could not be read. Choose another JPG, PNG or WebP.");
  }
  if (image.length > 512 * 1024)
    throw new AuthError(413, "This photo is too detailed. Choose a smaller photo.");

  const id = randomUUID();
  const content = image.toString("base64");
  if (localDemoEnabled()) {
    await (
      await localDatabase()
    ).query("insert into course_thumbnails(id,content) values($1,$2)", [id, content]);
  } else {
    const { error } = await createAdminClient().from("course_thumbnails").insert({ id, content });
    if (error) throw new AuthError(503, "Photo could not be uploaded. Please try again.");
  }
  return json({ thumbnailUrl: `/api/course-thumbnails/${id}` });
}

export async function courseThumbnail(id: string) {
  if (!UPLOADED_THUMBNAIL.test(`/api/course-thumbnails/${id}`))
    return new Response(null, { status: 404 });
  let content: string | undefined;
  if (localDemoEnabled()) {
    content = (
      await (
        await localDatabase()
      ).query<{ content: string }>("select content from course_thumbnails where id=$1", [id])
    ).rows[0]?.content;
  } else {
    const { data, error } = await createAdminClient()
      .from("course_thumbnails")
      .select("content")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new AuthError(503, "Thumbnail temporarily unavailable.");
    content = data?.content;
  }
  if (!content) return new Response(null, { status: 404 });
  return new Response(Uint8Array.from(Buffer.from(content, "base64")), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
