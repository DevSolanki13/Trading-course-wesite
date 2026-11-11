"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TradingCardVisual, type TradingTopic } from "./trading-card-visual";

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

const marqueeCards: { type: TradingTopic; label: string; value: string; change: string }[] = [
  {
    type: "hindi",
    label: "Lesson language",
    value: "Lessons in Hindi",
    change: "Concepts explained clearly",
  },
  {
    type: "candles",
    label: "Trading basics",
    value: "Read the candles",
    change: "Understand price movement",
  },
  {
    type: "pace",
    label: "Your own pace",
    value: "Learn at your pace",
    change: "Pause, replay, revisit",
  },
  {
    type: "structure",
    label: "Market direction",
    value: "Follow the trend",
    change: "See the market direction",
  },
  {
    type: "path",
    label: "Structured lessons",
    value: "A clear learning path",
    change: "Learn one concept at a time",
  },
  {
    type: "levels",
    label: "Key levels",
    value: "Support & resistance",
    change: "Find the key zones",
  },
  {
    type: "context",
    label: "Chart examples",
    value: "Charts in context",
    change: "See concepts through examples",
  },
  {
    type: "sizing",
    label: "Risk awareness",
    value: "Know your risk",
    change: "Plan before you trade",
  },
  {
    type: "education",
    label: "Our approach",
    value: "Learning, not signals",
    change: "Build understanding, not dependency",
  },
  {
    type: "journal",
    label: "Trading habits",
    value: "Review every trade",
    change: "Learn from your decisions",
  },
];
const cards = [...marqueeCards, ...marqueeCards];
const explanations: Record<TradingTopic, string> = {
  hindi: "Learn trading concepts in Hindi, with clear explanations and familiar language.",
  candles: "Each candle shows the open, high, low and close for one period of time.",
  pace: "Pause a lesson, replay an example and return whenever you need a refresher.",
  structure: "Look at the sequence of highs and lows to understand market direction.",
  path: "Work through connected lessons, building on one concept before the next.",
  levels: "Mark areas where price has previously found buying or selling interest.",
  context: "Connect the concept to a chart and look at the price action around it.",
  sizing: "Decide how much you can risk before choosing the size of a trade.",
  education: "Understand the reasoning behind a decision instead of copying a trade signal.",
  journal: "Note your setup, your decision and one lesson to carry into the next review.",
};

export function FloatingCardMarquee() {
  const id = useId();
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const hovered = useRef(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const section = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLElement | null)[]>([]);
  const phase = useRef(0);
  const speed = useRef(SPEED);
  const targetSpeed = useRef(SPEED);
  const reducedMotion = useRef(false);
  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const mask = root.querySelector<HTMLElement>(".marquee-mask");
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = media.matches;
    const onMotionChange = () => {
      reducedMotion.current = media.matches;

      updateAnimation();
    };
    media.addEventListener("change", onMotionChange);
    const dismiss = () => {
      activeRef.current = null;
      setActiveCard(null);
      targetSpeed.current = pausedRef.current || hovered.current ? 0 : SPEED;
    };
    const onOutsidePress = (event: PointerEvent) => {
      if (!root.contains(event.target as Node)) dismiss();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("pointerdown", onOutsidePress);
    document.addEventListener("keydown", onEscape);
    let visible = false;
    let frame: number | null = null;
    let previous = performance.now();
    let width = window.innerWidth;
    const shown: boolean[] = [];

    function renderCards() {
      // Focusing a transformed card can scroll an overflow-hidden container.
      // Keep the curved viewport fixed; reduced motion uses native scrolling.
      if (mask && !reducedMotion.current) {
        mask.scrollTop = 0;
        mask.scrollLeft = 0;
      }
      const count = cards.length;
      const cardWidth = width <= 600 ? 210 : CARD_WIDTH;
      // Maintain a real gap between cards as the topic count grows.
      const radius = Math.max(RADIUS, (cardWidth + 28) / (2 * Math.sin(Math.PI / count)));
      const scaleFactor = width <= 540 ? 0.94 : 1;
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
        card.style.opacity = String(activeRef.current === index ? 1 : opacity);
        const zIndex = String(
          activeRef.current === index ? 200 : Math.round((1 - normalized) * 100),
        );
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
      if (activeRef.current === null) phase.current = (phase.current + speed.current * delta) % 360;
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
      document.removeEventListener("pointerdown", onOutsidePress);
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", updateAnimation);
    };
  }, []);

  return (
    <section
      ref={section}
      className="marquee-wrap"
      aria-label="Explore our learning experience and trading basics"
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse" || !window.matchMedia("(hover: hover)").matches) return;
        hovered.current = true;
        speed.current = targetSpeed.current = 0;
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        hovered.current = false;
        activeRef.current = null;
        setActiveCard(null);
        targetSpeed.current = pausedRef.current ? 0 : SPEED;
      }}
    >
      <div className="marquee-toolbar">
        <div className="sample-label">YOUR LEARNING, AT A GLANCE</div>
        <button
          type="button"
          className="marquee-pause"
          aria-pressed={paused}
          onClick={() => {
            const next = !paused;
            pausedRef.current = next;
            targetSpeed.current = next ? 0 : SPEED;
            setPaused(next);
          }}
        >
          <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
          {paused ? "Resume motion" : "Pause motion"}
        </button>
      </div>
      <div className="marquee-mask">
        <div className="marquee-track" style={{ perspective: `${PERSPECTIVE}px` }}>
          {cards.map((card, index) => (
            <article
              key={`${card.type}-${index}`}
              ref={(element) => {
                cardsRef.current[index] = element;
              }}
              className={`marquee-card marquee-${card.type}${activeCard === index ? " is-active" : ""}`}
              aria-hidden={index >= marqueeCards.length}
              onPointerEnter={(event) => {
                if (event.pointerType !== "mouse" || !window.matchMedia("(hover: hover)").matches)
                  return;
                activeRef.current = index;
                setActiveCard(index);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType !== "mouse") return;
                activeRef.current = null;
                setActiveCard(null);
              }}
            >
              <button
                type="button"
                className="marquee-card-face"
                tabIndex={index >= marqueeCards.length ? -1 : 0}
                aria-expanded={activeCard === index}
                aria-controls={`${id}-info-${index}`}
                aria-describedby={activeCard === index ? `${id}-info-${index}` : undefined}
                aria-label={`About ${card.value}`}
                onFocus={(event) => {
                  if (!event.currentTarget.matches(":focus-visible")) return;
                  phase.current = (index / cards.length) * 360;
                  speed.current = targetSpeed.current = 0;
                  activeRef.current = index;
                  setActiveCard(index);
                }}
                onBlur={() => {
                  activeRef.current = null;
                  setActiveCard(null);
                  targetSpeed.current = pausedRef.current || hovered.current ? 0 : SPEED;
                }}
                onClick={(event) => {
                  const canHover = window.matchMedia("(hover: hover)").matches;
                  const next =
                    event.detail === 0 || !canHover
                      ? activeRef.current === index
                        ? null
                        : index
                      : index;
                  activeRef.current = next;
                  if (next !== null && !canHover && !reducedMotion.current)
                    phase.current = (index / cards.length) * 360;
                  setActiveCard(next);
                  targetSpeed.current =
                    next !== null || pausedRef.current || hovered.current ? 0 : SPEED;
                }}
              >
                <span className="marquee-card-top">{card.label}</span>
                <TradingCardVisual topic={card.type} active={activeCard === index} />
                <strong>{card.value}</strong>
                <small>{card.change}</small>
                <span
                  id={`${id}-info-${index}`}
                  className="marquee-card-info"
                  aria-hidden={activeCard !== index}
                >
                  {explanations[card.type]}
                </span>
              </button>
            </article>
          ))}
        </div>
      </div>
      <p className="marquee-note">Trading education · Concepts, not trade signals</p>
    </section>
  );
}
