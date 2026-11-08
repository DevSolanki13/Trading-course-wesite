"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import "../styles/payment-fireworks.css";

const BURSTS = [
  { left: "16%", top: "27%", delay: "0ms", color: "var(--accent)" },
  { left: "83%", top: "32%", delay: "450ms", color: "var(--gold)" },
  { left: "23%", top: "65%", delay: "900ms", color: "var(--gold)" },
  { left: "78%", top: "68%", delay: "1350ms", color: "var(--accent)" },
];
const SPARKS = Array.from({ length: 24 }, (_, index) => {
  const angle = (index / 24) * Math.PI * 2;
  const radius = 7 + (index % 3) * 1.5;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  return {
    "--spark-x": `${x.toFixed(2)}vmin`,
    "--spark-y": `${y.toFixed(2)}vmin`,
    "--spark-fall-y": `${(y + 4).toFixed(2)}vmin`,
    "--spark-angle": `${(angle * 180) / Math.PI + 90}deg`,
  } as CSSProperties;
});

export function PaymentFireworks({ orderId }: { orderId: string }) {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = layer.current;
    if (!element) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches || document.visibilityState === "hidden") return;

    const key = `indianxtrade:payment-celebrated:${orderId}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // A blocked storage API must never affect the payment confirmation.
    }

    let finish: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      delete element.dataset.active;
      clearTimeout(start);
      clearTimeout(finish);
    };
    // Deferring startup also avoids consuming the celebration during Strict Mode's effect check.
    const start = setTimeout(() => {
      if (motion.matches || document.visibilityState === "hidden") return;
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        // The brief visual can still run when session storage is unavailable.
      }
      element.dataset.active = "true";
      finish = setTimeout(stop, 3000);
    }, 0);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    motion.addEventListener("change", stop);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", stop);
    };
  }, [orderId]);

  return (
    <div ref={layer} className="payment-fireworks" aria-hidden="true">
      {BURSTS.map(({ left, top, delay, color }, burst) => (
        <div
          key={burst}
          className="payment-firework-burst"
          style={{ left, top, color, "--burst-delay": delay } as CSSProperties}
        >
          {SPARKS.map((style, spark) => (
            <i key={spark} className="payment-firework-spark" style={style} />
          ))}
        </div>
      ))}
    </div>
  );
}
