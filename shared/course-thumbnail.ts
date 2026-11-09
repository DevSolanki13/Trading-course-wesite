export const MAX_THUMBNAIL_BYTES = 3 * 1024 * 1024;
export const THUMBNAIL_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const UPLOADED_THUMBNAIL =
  /^\/api\/course-thumbnails\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const THUMBNAIL_WIDTHS = [160, 320, 640, 960, 1600] as const;
export type ThumbnailWidth = (typeof THUMBNAIL_WIDTHS)[number];

/** Transform only our public, immutable uploads, never external or authenticated URLs. */
export function thumbnailVariant(src: string, width: ThumbnailWidth) {
  return UPLOADED_THUMBNAIL.test(src) ? `${src}?w=${width}` : src;
}

export function thumbnailSrcSet(src: string) {
  return UPLOADED_THUMBNAIL.test(src)
    ? THUMBNAIL_WIDTHS.map((width) => `${thumbnailVariant(src, width)} ${width}w`).join(", ")
    : undefined;
}

/** Reject arbitrary transforms before reading storage or allocating an image pipeline. */
export function parseThumbnailWidth(searchParams: URLSearchParams): ThumbnailWidth | undefined {
  const values = searchParams.getAll("w");
  if (!values.length) return undefined;
  const width = THUMBNAIL_WIDTHS.find((candidate) => String(candidate) === values[0]);
  if (values.length !== 1 || !width) throw new Error("Unsupported thumbnail width.");
  return width;
}
