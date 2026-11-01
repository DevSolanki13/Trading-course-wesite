import { useId, type CSSProperties } from "react";

/**
 * Edit CANDLES to change the lesson (OHLC values are illustrative price units).
 * SUPPORT controls the horizontal level; PRICE_TOP and PRICE_SCALE map prices to SVG y.
 * Keep wick lows >= SUPPORT for the first two touches and the final rejection.
 * Annotation copy lives in the SVG text elements below. Timings are seconds in `--delay`.
 */
type Candle = { open: number; high: number; low: number; close: number };
export const SUPPORT = 30;
const PRICE_TOP = 205;
const PRICE_SCALE = 1.8;
export const CANDLES: Candle[] = [
  { open: 109, high: 114, low: 99, close: 102 },
  { open: 102, high: 106, low: 91, close: 94 },
  { open: 94, high: 98, low: 84, close: 87 },
  { open: 87, high: 91, low: 74, close: 77 },
  { open: 77, high: 82, low: 63, close: 67 },
  { open: 67, high: 72, low: 49, close: 53 },
  { open: 53, high: 58, low: 37, close: 41 },
  { open: 41, high: 47, low: 30, close: 44 },
  { open: 44, high: 57, low: 41, close: 54 },
  { open: 54, high: 68, low: 51, close: 64 },
  { open: 64, high: 70, low: 57, close: 59 },
  { open: 59, high: 63, low: 48, close: 51 },
  { open: 51, high: 55, low: 38, close: 41 },
  { open: 41, high: 46, low: 30, close: 43 },
  { open: 43, high: 54, low: 40, close: 51 },
  { open: 51, high: 63, low: 48, close: 60 },
  { open: 60, high: 72, low: 57, close: 68 },
  { open: 68, high: 74, low: 61, close: 64 },
  { open: 64, high: 68, low: 54, close: 57 },
  { open: 57, high: 61, low: 47, close: 50 },
  { open: 50, high: 55, low: 40, close: 43 },
  { open: 43, high: 48, low: 34, close: 38 },
  { open: 38, high: 43, low: 31, close: 36 },
  { open: 36, high: 42, low: 30, close: 39 },
];
const y = (price: number) => PRICE_TOP - (price - SUPPORT) * PRICE_SCALE;
export const delay = (seconds: number): CSSProperties =>
  ({ "--delay": `${seconds}s` }) as CSSProperties;

function candlePath(candle: Candle, index: number) {
  const x = 25 + index * 14;
  const top = y(Math.max(candle.open, candle.close));
  const bottom = y(Math.min(candle.open, candle.close));
  return {
    wick: `M${x} ${y(candle.high)}V${y(candle.low)}`,
    body: `M${x - 4} ${top}H${x + 4}V${bottom}H${x - 4}Z`,
  };
}

export function AnnotatedChart() {
  const filterId = `chalk-${useId().replaceAll(":", "")}`;
  return (
    <div
      className="hero-annotation-chart"
      role="img"
      aria-label="Illustration of a price chart with a support level and a marked decision point; example only"
    >
      <svg viewBox="0 0 480 350" aria-hidden="true" focusable="false">
        <defs>
          <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.025"
              numOctaves="2"
              seed="7"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="1.2"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
        <g className="annotation-grid annotation-enter" style={delay(0)}>
          <path d="M14 68H359M14 116H359M14 164H359M14 238H359M14 48V241M10 68H18M10 116H18M10 164H18M10 205H18M10 238H18" />
        </g>
        <g filter={`url(#${filterId})`}>
          {CANDLES.map((candle, index) => {
            const geometry = candlePath(candle, index);
            return (
              <g
                key={index}
                style={delay(0.3 + index * 0.06)}
                className={
                  candle.close > candle.open ? "annotation-candle is-up" : "annotation-candle"
                }
              >
                <path className="annotation-draw candle-wick" pathLength="1" d={geometry.wick} />
                <path className="annotation-draw candle-body" pathLength="1" d={geometry.body} />
              </g>
            );
          })}
          <g className="annotation-write" style={delay(2)}>
            <path className="annotation-support" d={`M18 ${y(SUPPORT)}H370`} />
          </g>
          <path
            className="annotation-draw"
            pathLength="1"
            style={delay(2.35)}
            d="M43 260Q60 235 80 212M72 217L80 212L80 222"
          />
          {[
            { x: 123, n: 1 },
            { x: 207, n: 2 },
          ].map(({ x, n }) => (
            <g
              key={n}
              className="annotation-bounce annotation-enter"
              style={delay(2.7 + (n - 1) * 0.13)}
            >
              <circle cx={x} cy="225" r="10" />
              <text x={x} y="231" textAnchor="middle">
                {n}
              </text>
            </g>
          ))}
          <g className="annotation-accent annotation-decision">
            <path
              className="annotation-draw"
              pathLength="1"
              style={delay(3.3)}
              d="M331 180C349 166 371 178 368 201C366 222 335 222 332 203C328 187 339 177 354 178"
            />
          </g>
          <path
            className="annotation-draw"
            pathLength="1"
            style={delay(3.55)}
            d="M350 221Q358 249 338 268M339 259L338 268L346 265"
          />
          <g className="annotation-write" style={delay(4.1)}>
            <path className="annotation-projection" d="M350 187Q369 172 374 153T397 111T416 79" />
            <path className="annotation-accent" d="M416 93V62L437 66L416 75" />
            <path d="M338 232L361 232M368 232H377M372 232V79H380M368 193H377" />
          </g>
        </g>
        <text
          className="annotation-write"
          style={delay(2.35)}
          x="22"
          y="282"
          transform="rotate(-2 22 282)"
        >
          Support
        </text>
        <text className="annotation-write annotation-small" style={delay(2.6)} x="22" y="304">
          buyers stepped in twice
        </text>
        <text
          className="annotation-write"
          style={delay(3.65)}
          x="228"
          y="288"
          transform="rotate(1 228 288)"
        >
          Decision point:
        </text>
        <text className="annotation-write annotation-small" style={delay(3.85)} x="228" y="309">
          wait for the candle to close
        </text>
        <text className="annotation-write annotation-accent" style={delay(4.4)} x="413" y="53">
          Target
        </text>
        <text className="annotation-write annotation-small" style={delay(4.3)} x="326" y="254">
          Stop
        </text>
        <text className="annotation-write" style={delay(4.5)} x="384" y="160">
          1 : 3
        </text>
        <text className="annotation-footer annotation-enter" style={delay(4.8)} x="22" y="340">
          EXAMPLE ONLY · NOT A SIGNAL
        </text>
      </svg>
    </div>
  );
}
