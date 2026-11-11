"use client";

import { useEffect, useRef } from "react";

const candles = [
  { x: 30, open: 212, close: 192, high: 180, low: 224 },
  { x: 72, open: 194, close: 174, high: 161, low: 208 },
  { x: 114, open: 171, close: 182, high: 156, low: 194 },
  { x: 156, open: 180, close: 147, high: 135, low: 193 },
  { x: 198, open: 146, close: 119, high: 106, low: 158 },
  { x: 240, open: 119, close: 131, high: 104, low: 143 },
  { x: 282, open: 131, close: 94, high: 82, low: 143 },
  { x: 324, open: 95, close: 69, high: 56, low: 109 },
  { x: 366, open: 69, close: 78, high: 55, low: 91 },
  { x: 408, open: 78, close: 43, high: 29, low: 92 },
  { x: 450, open: 44, close: 17, high: 9, low: 59 },
];

export function ProgressCandlestickChart() {
  const chart = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = chart.current;
    if (!root) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animations: Animation[] = [];
    const cancel = () => animations.forEach((animation) => animation.cancel());
    const play = () => {
      if (media.matches || animations.some((animation) => animation.playState === "running"))
        return;
      cancel();
      animations = Array.from(
        root.querySelectorAll<SVGGElement>(".progress-candle"),
        (candle, index) =>
          candle.animate(
            [
              { opacity: 0, transform: "translateY(12px) scaleY(0.25)" },
              { opacity: 1, transform: "translateY(0) scaleY(1)" },
            ],
            {
              duration: 800,
              delay: index * 110,
              easing: "cubic-bezier(0.23, 1, 0.32, 1)",
              fill: "both",
            },
          ),
      );
      const trail = root.querySelector(".progress-chart-trail");
      if (trail)
        animations.push(
          trail.animate(
            [
              { clipPath: "inset(0 100% 0 0)", opacity: 0 },
              { clipPath: "inset(0 0 0 0)", opacity: 1 },
            ],
            { duration: 2200, easing: "linear", fill: "both" },
          ),
        );
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        play();
        observer.unobserve(root);
      },
      { threshold: 0.25 },
    );
    observer.observe(root);
    const onEnter = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && window.matchMedia("(hover: hover)").matches) play();
    };
    const onMotionChange = () => {
      if (media.matches) cancel();
    };
    root.addEventListener("pointerenter", onEnter);
    media.addEventListener("change", onMotionChange);
    return () => {
      cancel();
      observer.disconnect();
      root.removeEventListener("pointerenter", onEnter);
      media.removeEventListener("change", onMotionChange);
    };
  }, []);
  return (
    <div ref={chart} className="stat-chart progress-chart">
      <svg viewBox="0 0 480 250" aria-hidden="true" focusable="false">
        <path
          d="M0 50H480M0 100H480M0 150H480M0 200H480M72 0V250M156 0V250M240 0V250M324 0V250M408 0V250"
          className="progress-chart-grid"
        />
        <path
          d="M20 239C110 231 129 203 195 181S295 139 344 105S407 78 460 55"
          className="progress-chart-trail"
        />
        {candles.map((candle) => (
          <g
            key={candle.x}
            className={`progress-candle${candle.close > candle.open ? " is-pullback" : ""}`}
          >
            <path d={`M${candle.x} ${candle.high}V${candle.low}`} />
            <rect
              x={candle.x - 9}
              y={Math.min(candle.open, candle.close)}
              width="18"
              height={Math.abs(candle.close - candle.open)}
              rx="2"
            />
          </g>
        ))}
      </svg>
      <div className="progress-chart-caption">
        <span>Learn. Practice. Grow.</span>
        <span>Illustrative chart</span>
      </div>
    </div>
  );
}
