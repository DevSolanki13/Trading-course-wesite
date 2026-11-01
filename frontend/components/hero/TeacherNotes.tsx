import { delay } from "./AnnotatedChart";

export function TeacherNotes() {
  return (
    <div
      className="hero-teacher-notes"
      role="img"
      aria-label="Before you enter: locate support, define your stop and check that the reward is at least three times the risk."
    >
      <svg viewBox="0 0 320 280" aria-hidden="true" focusable="false">
        <text
          className="annotation-write notes-title"
          style={delay(3)}
          x="20"
          y="32"
          transform="rotate(-2 20 32)"
        >
          Before you enter:
        </text>
        <path
          className="annotation-draw"
          style={delay(3.15)}
          pathLength="1"
          d="M20 43Q89 48 166 42"
        />
        {[
          { y: 82, lines: ["1. Where is support?"] },
          { y: 121, lines: ["2. Where is my stop?"] },
          { y: 160, lines: ["3. Is the reward at least", "3x the risk?"] },
        ].map(({ y, lines }, index) => (
          <g key={y}>
            <text
              className="annotation-write"
              style={delay(3.25 + index * 0.6)}
              x="40"
              y={y}
              transform={`rotate(${index - 1} 40 ${y})`}
            >
              {lines.map((line, i) => (
                <tspan x="40" dy={i ? 25 : 0} key={line}>
                  {line}
                </tspan>
              ))}
            </text>
            <path
              className="annotation-draw notes-check"
              style={delay(3.6 + index * 0.6)}
              pathLength="1"
              d={`M15 ${y - 6}L21 ${y}L32 ${y - 15}`}
            />
          </g>
        ))}
        <g className="annotation-write notes-bracket" style={delay(4.65)}>
          <path d="M57 215H64V254H57M64 244H73M64 215H73M64 254H73M86 244H191M86 215H191M86 254H191" />
          <text x="26" y="244">
            1
          </text>
          <text x="25" y="231">
            3
          </text>
          <text x="210" y="240">
            1 : 3
          </text>
        </g>
      </svg>
    </div>
  );
}
