import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrandLogo, BrandMark } from "../frontend/components/bull-mark";
import { CourseThumbnail } from "../frontend/components/course-thumbnail";
import { ThemeToggle } from "../frontend/components/theme-toggle";
import { thumbnailSrcSet, thumbnailVariant } from "../shared/course-thumbnail";
import { unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";
import { config as proxyConfig } from "../proxy";

vi.mock("server-only", () => ({}));

const uploaded = "/api/course-thumbnails/11111111-1111-4111-8111-111111111111";

it("skips auth interception only for public static branding, retaining private route protection", () => {
  for (const url of ["/brand/indianxtrade-dark-v2.webp", "/videos/indianxtrade-greeting-v2.mp4"]) {
    expect(doesProxyMatch({ config: proxyConfig, url })).toBe(false);
  }
  for (const url of [
    "/dashboard",
    "/checkout/market-basics",
    "/account",
    "/api/admin/orders",
    uploaded,
  ]) {
    expect(doesProxyMatch({ config: proxyConfig, url })).toBe(true);
  }
});

describe("responsive public thumbnails", () => {
  it("advertises five bounded sizes and leaves all other source URLs unchanged", () => {
    expect(thumbnailSrcSet(uploaded)?.split(", ")).toHaveLength(5);
    expect(thumbnailVariant(uploaded, 320)).toBe(`${uploaded}?w=320`);
    for (const src of [
      "https://example.com/photo.jpg",
      "/api/private/photo",
      "data:image/png;base64,abc",
      `${uploaded}?token=private`,
    ]) {
      expect(thumbnailVariant(src, 320)).toBe(src);
      expect(thumbnailSrcSet(src)).toBeUndefined();
    }
  });

  it("reserves card dimensions, loads lazily and allows eager detail images", () => {
    const { rerender } = render(
      <CourseThumbnail src={uploaded} alt="Course" width={600} height={400} />,
    );
    const image = screen.getByAltText("Course");
    expect(image).toHaveAttribute("src", `${uploaded}?w=640`);
    expect(image).toHaveAttribute("srcset", expect.stringContaining("?w=160 160w"));
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("width", "600");
    expect(image).toHaveAttribute("height", "400");
    rerender(
      <CourseThumbnail
        src={uploaded}
        alt="Course"
        sizes="45vw"
        loading="eager"
        fetchPriority="high"
      />,
    );
    expect(image).toHaveAttribute("sizes", "45vw");
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
  });
});

describe("theme artwork delivery", () => {
  const images: { src: string; onload: (() => void) | null; onerror: (() => void) | null }[] = [];
  beforeEach(() => {
    images.length = 0;
    document.documentElement.dataset.theme = "dark";
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        onload = null;
        onerror = null;
        decode = () => Promise.resolve();
        constructor() {
          images.push(this);
        }
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete document.documentElement.dataset.theme;
    localStorage.removeItem("market-method-theme");
  });

  it("uses lossless versioned assets with intrinsic dimensions and lazy hidden artwork", () => {
    const { container } = render(
      <>
        <BrandLogo height={46} />
        <BrandMark />
      </>,
    );
    const artwork = container.querySelectorAll("img");
    expect(artwork).toHaveLength(4);
    for (const image of artwork) {
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image.getAttribute("src")).toMatch(/-v2\.webp$/);
      expect(Number(image.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(image.getAttribute("height"))).toBeGreaterThan(0);
    }
    expect(images).toHaveLength(0);
  });

  it("warms only the requested theme on intent, decodes before switching, and persists it", async () => {
    render(
      <>
        <BrandLogo />
        <BrandMark />
        <ThemeToggle />
      </>,
    );
    const toggle = screen.getByRole("button");
    fireEvent.pointerEnter(toggle);
    expect(images.map((image) => image.src)).toEqual([
      expect.stringContaining("indianxtrade-light-v2.webp"),
      expect.stringContaining("indianxtrade-mark-light-v2.webp"),
    ]);
    fireEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("dark");
    for (const image of images) image.onload?.();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    expect(localStorage.getItem("market-method-theme")).toBe("light");
  });

  it("honours rapid double clicks without applying a stale image completion", async () => {
    render(
      <>
        <BrandLogo />
        <ThemeToggle />
      </>,
    );
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));
    for (const image of images) image.onload?.();
    await waitFor(() => expect(localStorage.getItem("market-method-theme")).toBe("dark"));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("still switches when the alternate artwork fails", async () => {
    render(
      <>
        <BrandLogo />
        <ThemeToggle />
      </>,
    );
    fireEvent.click(screen.getByRole("button"));
    for (const image of images) image.onerror?.();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
  });

  it("bounds slow artwork waiting so theme controls cannot stay stuck", async () => {
    vi.useFakeTimers();
    render(
      <>
        <BrandLogo />
        <ThemeToggle />
      </>,
    );
    fireEvent.click(screen.getByRole("button"));
    await vi.advanceTimersByTimeAsync(1200);
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
