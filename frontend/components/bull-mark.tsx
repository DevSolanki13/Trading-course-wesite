/* eslint-disable @next/next/no-img-element */
import type { CSSProperties, ImgHTMLAttributes } from "react";

export interface BrandLogoProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "width" | "height"
> {
  className?: string;
  width?: number | string;
  height?: number | string;
  alt?: string;
  style?: CSSProperties;
  // Legacy SVG props kept for compatibility
  up?: string;
  down?: string;
  outline?: string;
}

/**
 * Official indianXtrade Brand Logo.
 * Displays the light theme logo in light mode,
 * and the dark theme logo in dark mode.
 */
export function BrandLogo({
  className = "",
  width,
  height = 46,
  alt = "indianXtrade",
  style,
  up: _up,
  down: _down,
  outline: _outline,
  ...props
}: BrandLogoProps) {
  void _up;
  void _down;
  void _outline;

  const inlineStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 0,
    flexShrink: 0,
    ...style,
  };

  const imgStyle: CSSProperties = {
    height: typeof height === "number" ? `${height}px` : height,
    width: width ? (typeof width === "number" ? `${width}px` : width) : "auto",
    objectFit: "contain",
    display: "block",
  };

  return (
    <span className={`brand-logo-wrap ${className}`} style={inlineStyle}>
      <img
        src="/brand/indianxtrade-dark.png"
        alt={alt}
        className="brand-logo-dark"
        style={imgStyle}
        {...props}
      />
      <img
        src="/brand/indianxtrade-light.png"
        alt={alt}
        className="brand-logo-light"
        style={imgStyle}
        {...props}
      />
    </span>
  );
}

/**
 * Official indianXtrade compact Brand Mark (icon).
 */
export function BrandMark({
  className = "",
  width,
  height = 28,
  alt = "indianXtrade",
  style,
  up: _up,
  down: _down,
  outline: _outline,
  ...props
}: BrandLogoProps) {
  void _up;
  void _down;
  void _outline;

  const inlineStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 0,
    flexShrink: 0,
    ...style,
  };

  const imgStyle: CSSProperties = {
    height: typeof height === "number" ? `${height}px` : height,
    width: width ? (typeof width === "number" ? `${width}px` : width) : "auto",
    objectFit: "contain",
    display: "block",
  };

  return (
    <span className={`brand-mark-wrap ${className}`} style={inlineStyle}>
      <img
        src="/brand/indianxtrade-mark.png"
        alt={alt}
        className="brand-mark-dark"
        style={imgStyle}
        {...props}
      />
      <img
        src="/brand/indianxtrade-mark-light.png"
        alt={alt}
        className="brand-mark-light"
        style={imgStyle}
        {...props}
      />
    </span>
  );
}

export const BrandWordmark = BrandLogo;
export const BullMark = BrandLogo;
