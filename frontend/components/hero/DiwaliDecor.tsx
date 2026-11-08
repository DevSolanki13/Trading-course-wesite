import { useId } from "react";

// Fixed positions follow the reference: staggered chains and a few faded lamps.
// Keeping these deterministic also keeps the server and browser renders identical.
const leftLamps = [
  { x: 18, length: 204, opacity: 0.95 },
  { x: 40, length: 166, opacity: 1 },
  { x: 62, length: 232, opacity: 1 },
  { x: 84, length: 160, opacity: 0.48 },
  { x: 106, length: 112, opacity: 0.32 },
  { x: 128, length: 139, opacity: 0.46 },
  { x: 162, length: 83, opacity: 0.95 },
  { x: 184, length: 44, opacity: 1 },
  { x: 206, length: 110, opacity: 0.95 },
];
const rightLamps = [
  { x: 14, length: 110, opacity: 0.95 },
  { x: 36, length: 44, opacity: 1 },
  { x: 58, length: 83, opacity: 0.95 },
  { x: 92, length: 122, opacity: 0.32 },
  { x: 114, length: 150, opacity: 0.42 },
  { x: 136, length: 173, opacity: 0.48 },
  { x: 158, length: 232, opacity: 1 },
  { x: 180, length: 171, opacity: 0.95 },
  { x: 202, length: 207, opacity: 1 },
];

function HangingDiyas({ side }: { side: "left" | "right" }) {
  const id = useId().replace(/:/g, "");
  const lamps = side === "left" ? leftLamps : rightLamps;

  return (
    <svg
      className={`diwali-cluster diwali-cluster--${side}`}
      viewBox="0 0 220 270"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id={`${id}-chain`} width="8" height="16" patternUnits="userSpaceOnUse">
          <path d="M4 0v5m0 6v5M4 5 6 8 4 11 2 8Z" className="diwali-chain" />
        </pattern>
        <linearGradient
          id={`${id}-bowl`}
          x1="0"
          y1="23"
          x2="0"
          y2="34"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#f5d878" />
          <stop offset="1" stopColor="#bd9030" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop stopColor="#efbd55" stopOpacity="0.2" />
          <stop offset="1" stopColor="#efbd55" stopOpacity="0" />
        </radialGradient>
        <symbol id={`${id}-diya`} viewBox="0 0 32 40">
          <ellipse cx="16" cy="21" rx="16" ry="19" fill={`url(#${id}-glow)`} />
          <path d="M16 2c1 5 5 8 4 13-.3 3-2 5-4 5s-4-2-4-5c0-4 3-8 4-13Z" fill="#f3cb66" />
          <path d="M16 10c0 3 2 5 2 7s-1 3-2 3-2-1-2-3 1-4 2-7Z" fill="#fff1c1" />
          <path d="M2 24q14 5 28 0c-3 8-7 11-14 11S5 32 2 24Z" fill={`url(#${id}-bowl)`} />
          <path d="M2 24q14 5 28 0" stroke="#fae29a" strokeWidth="0.8" />
        </symbol>
      </defs>
      {lamps.map(({ x, length, opacity }) => (
        <g key={x} className="diwali-lamp" opacity={opacity}>
          <rect x={x - 4} width="8" height={length - 8} fill={`url(#${id}-chain)`} />
          <path d={`M${x} ${length - 8}v8`} className="diwali-chain" />
          <use href={`#${id}-diya`} x={x - 14} y={length} width="28" height="35" />
        </g>
      ))}
    </svg>
  );
}

export function DiwaliDecor() {
  return (
    <div className="diwali-decor" aria-hidden="true">
      <HangingDiyas side="left" />
      <HangingDiyas side="right" />
    </div>
  );
}

export function DiwaliGreeting() {
  return (
    <div className="diwali-greeting">
      <svg viewBox="0 0 36 30" fill="none" aria-hidden="true" focusable="false">
        <path d="M18 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10Z" />
        <path d="M3 18q15 5 30 0c-3 8-8 10-15 10S6 26 3 18Z" />
      </svg>
      <span>Happy Diwali</span>
    </div>
  );
}
