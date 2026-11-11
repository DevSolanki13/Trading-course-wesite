"use client";

import { useEffect, useRef, type ReactNode } from "react";

export type TradingTopic =
  | "hindi"
  | "pace"
  | "path"
  | "context"
  | "education"
  | "candles"
  | "structure"
  | "levels"
  | "sizing"
  | "journal";

function PlayerStory({
  x,
  y,
  progressY,
  captionY,
}: {
  x: number;
  y: number;
  progressY: number;
  captionY: number;
}) {
  return (
    <>
      <g transform={`translate(${x} ${y})`}>
        <g className="trade-player-ready">
          <path d="M-5-10V10L9 0Z" className="trade-play" />
        </g>
        <g className="trade-player-playing trade-player-hidden">
          <path d="M-5-8V8M5-8V8" className="trade-player-pause" />
        </g>
        <g className="trade-player-complete trade-player-hidden">
          <path d="M-9 0L-2 7L11-8" className="trade-gain trade-player-check" />
        </g>
      </g>
      <rect x="40" y={progressY} width="116" height="3" rx="1.5" className="trade-video-progress" />
      <text x="156" y={captionY} textAnchor="end" className="trade-player-ready">
        PRESS PLAY
      </text>
      <text
        x="156"
        y={captionY}
        textAnchor="end"
        className="trade-player-playing trade-player-hidden"
      >
        PLAYING
      </text>
      <text
        x="156"
        y={captionY}
        textAnchor="end"
        className="trade-player-complete trade-player-hidden"
      >
        COMPLETED
      </text>
    </>
  );
}

export function TradingCardVisual({
  topic,
  active = false,
}: {
  topic: TradingTopic;
  active?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const root = svg.current;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!active || !root || media.matches || root.closest("button")?.matches(":focus-visible"))
      return;
    const animations: Animation[] = [];
    const play = (
      selector: string,
      frames: Keyframe[],
      duration = 1000,
      delay = 0,
      easing = "cubic-bezier(0.23, 1, 0.32, 1)",
    ) => {
      root.querySelectorAll<SVGElement>(selector).forEach((element) => {
        animations.push(element.animate(frames, { duration, delay, easing, fill: "both" }));
      });
    };
    const trace = (selector: string, delay = 0) =>
      play(
        selector,
        [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
        1400,
        delay,
      );
    const appear = [
      { opacity: 0, transform: "translateY(4px)" },
      { opacity: 1, transform: "translateY(0)" },
    ];
    if (topic === "hindi" || topic === "pace") {
      const duration = 2600;
      play(
        ".trade-player-ready",
        [
          { opacity: 1, offset: 0 },
          { opacity: 0, offset: 0.04 },
          { opacity: 0, offset: 1 },
        ],
        duration,
        0,
        "linear",
      );
      play(
        ".trade-player-playing",
        [
          { opacity: 0, offset: 0 },
          { opacity: 1, offset: 0.04 },
          { opacity: 1, offset: 0.82 },
          { opacity: 0, offset: 0.87 },
          { opacity: 0, offset: 1 },
        ],
        duration,
        0,
        "linear",
      );
      play(
        ".trade-player-complete",
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.85 },
          { opacity: 1, offset: 0.92 },
          { opacity: 1, offset: 1 },
        ],
        duration,
        0,
        "linear",
      );
      play(
        ".trade-video-progress",
        [
          { transform: "scaleX(0)", offset: 0 },
          { transform: "scaleX(1)", offset: 0.84 },
          { transform: "scaleX(1)", offset: 1 },
        ],
        duration,
        0,
        "linear",
      );
    } else if (topic === "candles") {
      root.querySelectorAll(".trade-candle").forEach((_, i) =>
        play(
          `.trade-candle:nth-of-type(${i + 1})`,
          [
            { opacity: 0, transform: "scaleY(0.25)" },
            { opacity: 1, transform: "scaleY(1)" },
          ],
          650,
          i * 160,
        ),
      );
    } else if (topic === "path") {
      trace(".trade-route");
      root.querySelectorAll(".trade-lesson").forEach((_, i) => {
        play(`.trade-lesson:nth-of-type(${i + 1})`, appear, 450, i * 350);
        play(
          `.trade-lesson:nth-of-type(${i + 1}) .trade-unit-risk`,
          [{ opacity: 1 }, { opacity: 0 }],
          180,
          350 + i * 350,
        );
        play(
          `.trade-lesson:nth-of-type(${i + 1}) .trade-lesson-check`,
          [{ opacity: 0 }, { opacity: 1 }],
          250,
          350 + i * 350,
        );
      });
    } else if (topic === "sizing") {
      root
        .querySelectorAll(".trade-unit")
        .forEach((_, i) => play(`.trade-unit:nth-of-type(${i + 1})`, appear, 350, i * 25));
      play(
        ".trade-unit-risk",
        [
          { opacity: 0, transform: "translateY(0) scale(1)" },
          { opacity: 1, transform: "translateY(-5px) scale(1.12)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        1000,
        650,
      );
    } else if (topic === "journal") {
      root.querySelectorAll(".trade-journal-row").forEach((_, i) => {
        trace(`.trade-journal-row:nth-of-type(${i + 1}) .trade-check`, i * 300);
        play(`.trade-journal-row:nth-of-type(${i + 1}) text`, appear, 450, i * 300);
      });
    } else {
      trace(".trade-price", topic === "education" ? 400 : 0);
      play(".trade-point", [{ opacity: 0 }, { opacity: 1 }], 400, 950);
      if (topic === "levels")
        play(".trade-zone-gain, .trade-zone-loss", [{ opacity: 0 }, { opacity: 1 }], 750, 250);
      if (topic === "context")
        play(
          ".trade-ring",
          [
            { opacity: 0, transform: "scale(0.85)" },
            { opacity: 1, transform: "scale(1.2)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          900,
          700,
        );
      if (topic === "education") {
        play(".trade-paper", [{ transform: "scaleX(0.88)" }, { transform: "scaleX(1)" }], 650);
        trace(".trade-guide", 250);
      }
    }
    const cancel = () => animations.forEach((animation) => animation.cancel());
    const onMotionChange = () => {
      if (media.matches) cancel();
    };
    media.addEventListener("change", onMotionChange);
    return () => {
      cancel();
      media.removeEventListener("change", onMotionChange);
    };
  }, [active, topic]);
  let drawing: ReactNode;
  switch (topic) {
    case "hindi":
      drawing = (
        <>
          <rect x="23" y="15" width="150" height="84" rx="8" className="trade-paper" />
          <path d="M23 36H173" className="trade-guide" />
          <circle cx="35" cy="26" r="2" className="trade-unit-risk" />
          <text x="95" y="73" className="trade-hindi">
            हिंदी
          </text>
          <path d="M40 90H156" className="trade-guide" />
          <PlayerStory x={65} y={67} progressY={88} captionY={111} />
        </>
      );
      break;
    case "pace":
      drawing = (
        <>
          <rect x="23" y="12" width="150" height="90" rx="8" className="trade-paper" />
          <circle cx="98" cy="46" r="19" className="trade-zone-gold" />
          <path d="M40 78H156" className="trade-guide" />
          <PlayerStory x={98} y={46} progressY={76} captionY={96} />
        </>
      );
      break;
    case "path":
      drawing = (
        <>
          <path d="M29 82H85V55H147V28H176" className="trade-guide trade-route" />
          {[
            [17, 62],
            [73, 35],
            [135, 8],
          ].map(([x, y]) => (
            <g key={x} className="trade-lesson">
              <rect x={x} y={y} width="39" height="38" rx="6" className="trade-paper" />
              <circle cx={x + 13} cy={y + 13} r="3" className="trade-unit-risk" />
              <path d={`M${x + 9} ${y + 13}l3 3 6-7`} className="trade-gain trade-lesson-check" />
              <path d={`M${x + 10} ${y + 25}h19M${x + 10} ${y + 29}h12`} className="trade-guide" />
            </g>
          ))}
          <circle cx="181" cy="28" r="3" className="trade-point" />
        </>
      );
      break;
    case "context":
      drawing = (
        <>
          <rect x="17" y="58" width="164" height="19" rx="3" className="trade-zone-gold" />
          <path d="M13 46L40 68L65 35L96 68L122 29L148 43L181 17" className="trade-price" />
          <circle cx="96" cy="68" r="12" className="trade-ring" />
          <path d="M105 77L119 92H174" className="trade-guide" />
          <text x="124" y="105">
            THE CONTEXT
          </text>
        </>
      );
      break;
    case "education":
      drawing = (
        <>
          <path
            d="M98 32C79 19 52 19 28 27V89C52 81 79 81 98 94C117 81 144 81 168 89V27C144 19 117 19 98 32Z"
            className="trade-paper"
          />
          <path d="M98 32V94" className="trade-guide" />
          <path d="M43 43H79M43 54H79M43 65H67" className="trade-guide" />
          <path d="M112 69L124 52L136 60L153 38" className="trade-price" />
          <circle cx="153" cy="38" r="3" className="trade-point" />
        </>
      );
      break;
    case "candles":
      drawing = (
        <>
          {[
            [28, 62, 83, false],
            [54, 48, 67, false],
            [80, 44, 62, true],
            [106, 31, 57, false],
            [132, 23, 42, false],
          ].map(([x, top, bottom, down]) => (
            <g key={Number(x)} className={`trade-candle ${down ? "trade-loss" : "trade-gain"}`}>
              <path d={`M${x} ${Number(top) - 9}V${Number(bottom) + 8}`} />
              <rect
                x={Number(x) - 5}
                y={Number(top)}
                width="10"
                height={Number(bottom) - Number(top)}
                rx="1.5"
                fill="currentColor"
                stroke="none"
              />
            </g>
          ))}
          <path d="M142 23H162M142 42H162" className="trade-guide" />
          <text x="168" y="26">
            C
          </text>
          <text x="168" y="45">
            O
          </text>
        </>
      );
      break;
    case "structure":
      drawing = (
        <>
          <path d="M12 87L45 56L70 72L105 35L132 51L175 14" className="trade-price" />
          <path d="M22 101L162 53" className="trade-guide" />
          <circle cx="105" cy="35" r="3" className="trade-point" />
          <circle cx="132" cy="51" r="3" className="trade-point" />
          <text x="95" y="23" className="trade-gain">
            HH
          </text>
          <text x="128" y="70" className="trade-gain">
            HL
          </text>
        </>
      );
      break;
    case "levels":
      drawing = (
        <>
          <rect x="10" y="22" width="174" height="14" rx="3" className="trade-zone-loss" />
          <rect x="10" y="78" width="174" height="14" rx="3" className="trade-zone-gain" />
          <path d="M14 64L35 30L65 83L94 31L125 84L153 46L180 57" className="trade-price" />
          <text x="12" y="15">
            RESISTANCE
          </text>
          <text x="12" y="106">
            SUPPORT
          </text>
        </>
      );
      break;
    case "sizing":
      drawing = (
        <>
          {Array.from({ length: 20 }, (_, i) => (
            <rect
              key={i}
              x={14 + (i % 10) * 17}
              y={26 + Math.floor(i / 10) * 22}
              width="12"
              height="16"
              rx="2"
              className={i === 19 ? "trade-unit-risk" : "trade-unit"}
            />
          ))}
          <path d="M15 75V81H178V75" className="trade-guide" />
          <text x="14" y="101">
            CAPITAL
          </text>
          <text x="114" y="101" className="trade-gold">
            RISK BUDGET
          </text>
        </>
      );
      break;
    case "journal":
      drawing = (
        <>
          <rect x="29" y="12" width="137" height="91" rx="6" className="trade-paper" />
          <path d="M48 12V103" className="trade-guide" />
          {[34, 58, 82].map((y, i) => (
            <g key={y} className="trade-journal-row">
              <path d={`M59 ${y}l3 3 6-7`} className="trade-gain trade-check" />
              <text x="78" y={y + 2}>
                {["THE SETUP", "THE DECISION", "THE LESSON"][i]}
              </text>
            </g>
          ))}
        </>
      );
  }
  return (
    <svg
      ref={svg}
      className="trading-card-visual"
      viewBox="0 0 196 116"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0 29H196M0 58H196M0 87H196M49 0V116M98 0V116M147 0V116" className="trade-grid" />
      {drawing}
    </svg>
  );
}
