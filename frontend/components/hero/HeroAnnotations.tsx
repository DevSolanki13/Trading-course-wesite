"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function HeroAnnotations({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const layer = ref.current;
    const hero = layer?.closest<HTMLElement>(".hero-modern");
    if (!layer || !hero) return;
    let disposed = false;
    function measure() {
      if (disposed || !layer || !hero) return;
      const heading = hero.querySelector("h1");
      const carousel = hero.querySelector(".marquee-wrap");
      if (!heading || !carousel) return;
      const bounds = hero.getBoundingClientRect();
      const title = heading.getBoundingClientRect();
      const center = bounds.left + bounds.width / 2;
      let halfWidth = 0;
      hero.querySelectorAll("h1, .hero-lede, .hero-actions a, .trust-line").forEach((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        for (const rect of range.getClientRects()) {
          halfWidth = Math.max(halfWidth, center - rect.left, rect.right - center);
        }
      });
      // 48px clearance plus 12px for rotated corners and the rough stroke filter.
      layer.style.setProperty("--annotation-clearance", `${halfWidth + 60}px`);
      const chartWidth = Math.min(480, Math.max(340, innerWidth * 0.25));
      const noteWidth = Math.min(320, Math.max(240, innerWidth * 0.17));
      layer.style.setProperty(
        "--annotation-chart-top",
        `${Math.max(12, title.top - bounds.top + title.height * 0.45 - (chartWidth * 350) / 480 / 2)}px`,
      );
      layer.style.setProperty(
        "--annotation-notes-top",
        `${Math.max(12, Math.min(title.bottom - bounds.top + 24, carousel.getBoundingClientRect().top - bounds.top - (noteWidth * 280) / 320 - 24))}px`,
      );
      layer.dataset.ready = "true";
    }
    const resize = new ResizeObserver(measure);
    resize.observe(hero);
    const observer = new IntersectionObserver(([entry]) => {
      layer.dataset.visible = String(entry.isIntersecting);
      if (entry.isIntersecting) layer.dataset.started = "true";
    });
    observer.observe(hero);
    measure();
    void document.fonts.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => {
      disposed = true;
      resize.disconnect();
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div ref={ref} className={`hero-annotations ${className}`}>
      {children}
    </div>
  );
}
