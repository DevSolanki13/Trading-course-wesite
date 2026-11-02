"use client";

import { useEffect, useRef } from "react";
import { Play } from "./icons";

// Desktop radius controls the width of the curved path.
export const RADIUS = 760;
// Degrees travelled per second.
export const SPEED = 9;
// Negative values make the carousel travel right to left.
export const DIRECTION = -1;
// Only this part of the cylinder is visible.
export const VISIBLE_ARC = 70;
// Kept in sync with the existing card width.
export const CARD_WIDTH = 232;
// Depth perspective for the concave carousel.
export const PERSPECTIVE = 1200;

const marqueeCards = [
  {
    type: "chart",
    label: "Illustration",
    value: "Sample chart",
    change: "not live data",
    tone: "gold",
  },
  { type: "line", label: "Learning progress", value: "Review", change: "each session", tone: "up" },
  {
    type: "dark",
    label: "The market rewards",
    value: "process",
    change: "not prediction",
    tone: "gold",
  },
  {
    type: "portfolio",
    label: "Checklist",
    value: "Plan -> Review",
    change: "every trade",
    tone: "gold",
  },
  {
    type: "stat",
    label: "Course format",
    value: "Hindi lessons",
    change: "at your pace",
    tone: "gold",
  },
  {
    type: "live",
    label: "Learning format",
    value: "Guided study",
    change: "with context",
    tone: "gold",
  },
  {
    type: "risk",
    label: "Risk first",
    value: "Define it",
    change: "before you enter",
    tone: "gold",
  },
  {
    type: "order",
    label: "Market context",
    value: "Sample only",
    change: "for education",
    tone: "gold",
  },
];
const cards = [...marqueeCards, ...marqueeCards];

function MiniVisual({ type }: { type: string }) {
  if (type === "chart")
    return (
      <div className="mini-candles" aria-hidden="true">
        {[1, 3, 2, 5, 4, 7, 6, 8].map((height, index) => (
          <i
            key={index}
            className={index === 2 || index === 5 ? "down" : "up"}
            style={{ height: `${height * 8 + 12}px` }}
          />
        ))}
      </div>
    );
  if (type === "line")
    return (
      <svg className="mini-line" viewBox="0 0 220 80" aria-hidden="true">
        <defs>
          <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#16c784" stopOpacity=".35" />
            <stop offset="1" stopColor="#16c784" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 66 C28 62 28 39 56 48 S92 30 118 42 S151 14 174 26 S194 10 220 4 V80 H0Z"
          fill="url(#area)"
        />
        <path
          d="M0 66 C28 62 28 39 56 48 S92 30 118 42 S151 14 174 26 S194 10 220 4"
          fill="none"
          stroke="#16c784"
          strokeWidth="2.5"
        />
      </svg>
    );
  if (type === "portfolio")
    return (
      <div className="watchlist">
        <span>
          PLAN <b>DEFINE</b>
        </span>
        <span>
          REVIEW <em>LEARN</em>
        </span>
        <span>
          PROCESS <b>REPEAT</b>
        </span>
      </div>
    );
  if (type === "live")
    return (
      <div className="live-mark">
        <span>
          <Play size={15} weight="fill" />
        </span>
        <small>LIVE</small>
      </div>
    );
  if (type === "risk")
    return (
      <div className="risk-ratio">
        <span>RISK</span>
        <strong>1:3</strong>
        <span>REWARD</span>
      </div>
    );
  if (type === "order")
    return (
      <div className="order-book">
        <span>
          <i style={{ width: "78%" }} />
          BUY 78%
        </span>
        <span>
          <i style={{ width: "42%" }} />
          SELL 42%
        </span>
      </div>
    );
  return null;
}

export function FloatingCardMarquee() {
  const section = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLElement | null)[]>([]);
  const phase = useRef(0);
  const speed = useRef(SPEED);
  const targetSpeed = useRef(SPEED);
  const reducedMotion = useRef(false);

  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = media.matches;
    const onMotionChange = () => {
      reducedMotion.current = media.matches;
      updateAnimation();
    };
    media.addEventListener("change", onMotionChange);
    let visible = false;
    let frame: number | null = null;
    let previous = performance.now();
    let width = window.innerWidth;
    const shown: boolean[] = [];

    function renderCards() {
      const radius = width <= 540 ? 420 : width <= 1024 ? 570 : RADIUS;
      const scaleFactor = width <= 540 ? 0.78 : width <= 1024 ? 0.9 : 1;
      const count = cards.length;
      cardsRef.current.forEach((card, index) => {
        if (!card) return;
        const rawAngle = (index / count) * 360 + DIRECTION * phase.current;
        const angle = ((((rawAngle + 180) % 360) + 360) % 360) - 180;
        const distance = Math.abs(angle);
        const visibleAngle = distance <= VISIBLE_ARC;
        if (!visibleAngle) {
          if (shown[index] !== false) {
            card.style.opacity = "0";
            card.style.pointerEvents = "none";
            shown[index] = false;
          }
          return;
        }
        const normalized = Math.min(distance / VISIBLE_ARC, 1);
        const x = Math.sin((angle * Math.PI) / 180) * radius * scaleFactor;
        const z = (Math.cos((angle * Math.PI) / 180) - 1) * radius * 0.6 * scaleFactor;
        const y = normalized * normalized * 20 * scaleFactor;
        const rotateY = -angle * 0.8;
        const scale = (1 - normalized * 0.25) * scaleFactor;
        const opacity = 1 - normalized * normalized * 0.7;
        card.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), ${z}px) rotateY(${rotateY}deg) scale(${scale})`;
        card.style.opacity = String(opacity);
        const zIndex = String(Math.round((1 - normalized) * 100));
        if (card.style.zIndex !== zIndex) card.style.zIndex = zIndex;
        if (shown[index] !== true) card.style.pointerEvents = "auto";
        shown[index] = true;
      });
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        updateAnimation();
      },
      { threshold: 0.05 },
    );
    observer.observe(root);

    const tick = (now: number) => {
      frame = null;
      if (!visible || document.hidden || reducedMotion.current) return;
      const delta = Math.min(now - previous, 100) / 1000;
      previous = now;
      speed.current += (targetSpeed.current - speed.current) * Math.min(delta * 6, 1);
      phase.current = (phase.current + speed.current * delta) % 360;
      renderCards();
      frame = requestAnimationFrame(tick);
    };

    function updateAnimation() {
      const running = visible && !document.hidden && !reducedMotion.current;
      if (!running && frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      } else if (running && frame === null) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }
    const onResize = () => {
      width = window.innerWidth;
      renderCards();
    };
    renderCards();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", updateAnimation);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      media.removeEventListener("change", onMotionChange);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", updateAnimation);
    };
  }, []);

  return (
    <section
      ref={section}
      className="marquee-wrap"
      aria-label="Sample market visuals"
      onMouseEnter={() => {
        targetSpeed.current = 0;
      }}
      onMouseLeave={() => {
        targetSpeed.current = SPEED;
      }}
    >
      <div className="sample-label">SAMPLE MARKET DATA · FOR EDUCATION ONLY</div>
      <div className="marquee-mask">
        <div className="marquee-track" style={{ perspective: `${PERSPECTIVE}px` }}>
          {cards.map((card, index) => (
            <article
              key={`${card.type}-${index}`}
              ref={(element) => {
                cardsRef.current[index] = element;
              }}
              className={`marquee-card marquee-${card.type}`}
              aria-hidden={index >= marqueeCards.length}
            >
              <div className="marquee-card-top">
                <span>{card.label}</span>
                <span className={card.tone === "up" ? "positive" : "gold-dot"}>
                  {card.tone === "up" ? "●" : "✦"}
                </span>
              </div>
              <MiniVisual type={card.type} />
              <strong>{card.value}</strong>
              <small>{card.change}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
