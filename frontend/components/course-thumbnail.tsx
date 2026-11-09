/* eslint-disable @next/next/no-img-element */
import type { ImgHTMLAttributes } from "react";
import { thumbnailSrcSet, thumbnailVariant } from "../../shared/course-thumbnail";

/** Native responsive delivery leaves protected and third-party image URLs untouched. */
export function CourseThumbnail({
  src,
  alt,
  sizes = "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw",
  loading = "lazy",
  decoding = "async",
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "alt"> & {
  src: string;
  alt: string;
}) {
  return (
    <img
      {...props}
      src={thumbnailVariant(src, 640)}
      srcSet={thumbnailSrcSet(src)}
      sizes={sizes}
      alt={alt}
      loading={loading}
      decoding={decoding}
    />
  );
}
