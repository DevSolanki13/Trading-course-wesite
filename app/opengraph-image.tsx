import { ImageResponse } from "next/og";
export const alt = "Market Method: Learn the process. Respect the risk.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        background: "#0B1012",
        color: "#F3F1E9",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 70,
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontSize: 32, display: "flex" }}>
        marketmethod<span style={{ color: "#69D6BC" }}>.</span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 78,
          letterSpacing: -3,
          lineHeight: 1.1,
        }}
      >
        <span>Learn the process.</span>
        <span style={{ color: "#69D6BC" }}>Respect the risk.</span>
      </div>
      <div style={{ fontSize: 22, color: "#A8B3B5", display: "flex" }}>
        Trading education in Hindi · Preview edition
      </div>
    </div>,
    size,
  );
}
